//! DeepSeek Harness 桌面壳（Tauri 2，Windows）。
//!
//! 职责：
//! 1. 启动时探测本地 dsh 服务（默认 127.0.0.1:3080），已有则复用，空闲则拉起 `dsh web`；
//! 2. 服务就绪后把主窗口从加载页导航到 Web GUI；
//! 3. 托盘常驻：关闭窗口仅隐藏，托盘菜单显示/退出/开机自启；
//! 4. 退出时只回收本次启动的 dsh 子进程，复用的实例不动。

use std::{
    io::{BufRead, BufReader},
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_notification::NotificationExt;

/// 与 dsh 服务的约定端口（可用 `DSH_DESKTOP_PORT` 覆盖）。
fn app_port() -> u16 {
    std::env::var("DSH_DESKTOP_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3080)
}

/// 等待服务就绪的超时时间。
const READY_TIMEOUT: Duration = Duration::from_secs(60);

/// nvm 版本目录名（如 v22.12.0）按 semver 比较；字符串排序会把 v9.11.0 排在 v22.12.0 之后。
fn version_key(path: &std::path::Path) -> (u64, u64, u64) {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let parts: Vec<u64> = name
        .trim_start_matches('v')
        .split('.')
        .map(|p| p.parse().unwrap_or(0))
        .collect();
    (
        parts.first().copied().unwrap_or(0),
        parts.get(1).copied().unwrap_or(0),
        parts.get(2).copied().unwrap_or(0),
    )
}

/// spawn dsh 的失败原因：NotFound 供错误页提示"未找到"，其余归为其它失败。
enum SpawnError {
    NotFound(String),
    Other(String),
}

impl std::fmt::Display for SpawnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpawnError::NotFound(m) | SpawnError::Other(m) => f.write_str(m),
        }
    }
}

/// 桌面壳的共享运行时状态。
struct DshState {
    /// 本次运行 spawn 的 dsh 子进程（None = 复用了已有实例）。
    child: Mutex<Option<Child>>,
    /// 子进程是否由本次运行启动（决定退出时是否回收）。
    spawned_this_run: AtomicBool,
    /// spawn 失败标志（立即终止等待并跳错误页）。
    spawn_failed: AtomicBool,
    /// 托盘"退出"标志（置位后放行窗口关闭与应用退出）。
    quitting: AtomicBool,
    /// 是否已提示过"隐藏到托盘"。
    tray_tip_shown: AtomicBool,
    /// 未读任务完成数（Dock 角标）。
    unread: AtomicU32,
    /// 托盘"开机自启"菜单项（点击切换后同步 label）。
    autostart_item: Mutex<Option<tauri::menu::MenuItem<tauri::Wry>>>,
}

/// 解析 `DSH_DESKTOP_BACKEND`：JSON argv 数组，否则空格分隔；返回 (command, args)。
fn parse_command(value: &str) -> (String, Vec<String>) {
    if let Ok(parsed) = serde_json::from_str::<Vec<String>>(value) {
        if let Some((first, rest)) = parsed.split_first() {
            return (first.clone(), rest.to_vec());
        }
    }
    let mut parts = value.split_whitespace().map(String::from);
    let first = parts.next().unwrap_or_default();
    (first, parts.collect())
}

/// 探测 127.0.0.1:port 是否已有服务在监听。
fn port_open(port: u16) -> bool {
    TcpStream::connect_timeout(
        &SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(300),
    )
    .is_ok()
}

/// 判断 URL 是否为本应用 origin（`http://127.0.0.1:<port>`）。
fn is_app_origin(url: &tauri::Url, port: u16) -> bool {
    url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(port)
}

/// 用系统默认浏览器打开 URL（ShellExecuteW；不经 cmd 解析，URL 含 `&`/`%` 不会被破坏）。
fn open_in_browser(url: &str) {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    let result = unsafe {
        ShellExecuteW(
            None,
            windows::core::w!("open"),
            PCWSTR(wide.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as usize <= 32 {
        // SE_ERR_* 错误码区间 0..=32
        log::warn!("外部链接打开失败（{url}）：error={}", result.0 as usize);
    } else {
        log::info!("外部链接已交由系统默认浏览器打开：{url}");
    }
}

/// 定位 node.exe（DSH_NODE / PATH / nvm-windows / 官方安装器）。
fn find_node() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("DSH_NODE") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            let pb = dir.join("node.exe");
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut nvm_roots: Vec<PathBuf> = Vec::new();
    if let Ok(h) = std::env::var("NVM_HOME") {
        nvm_roots.push(PathBuf::from(h));
    }
    if let Ok(a) = std::env::var("APPDATA") {
        nvm_roots.push(PathBuf::from(&a).join("nvm"));
    }
    for root in &nvm_roots {
        if let Ok(entries) = std::fs::read_dir(root) {
            let mut dirs: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
            dirs.sort_by_key(|d| version_key(d));
            for d in dirs.iter().rev() {
                candidates.push(d.join("node.exe"));
            }
        }
        candidates.push(root.join("node.exe"));
    }
    if let Ok(s) = std::env::var("NVM_SYMLINK") {
        candidates.push(PathBuf::from(s).join("node.exe"));
    }
    for p in [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ] {
        candidates.push(PathBuf::from(p));
    }
    candidates.into_iter().find(|p| p.is_file())
}

/// 定位 dsh 的 bin.js（npm/pnpm/nvm 全局安装位置），支持 DSH_BIN 直接指向任意可执行文件。
fn find_dsh_bin_js() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("DSH_BIN") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    const REL: &str = "node_modules\\@deepseek-ai\\dsh\\lib\\bin.js";
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(a) = std::env::var("APPDATA") {
        roots.push(PathBuf::from(&a).join("npm"));
        roots.push(PathBuf::from(&a).join("pnpm"));
        let nvm_dir = PathBuf::from(&a).join("nvm");
        roots.push(nvm_dir.clone());
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for e in entries.flatten() {
                if e.path().is_dir() {
                    roots.push(e.path());
                }
            }
        }
    }
    if let Ok(l) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&l).join("pnpm"));
    }
    if let Ok(h) = std::env::var("NVM_HOME") {
        roots.push(PathBuf::from(&h));
        if let Ok(entries) = std::fs::read_dir(&h) {
            for e in entries.flatten() {
                if e.path().is_dir() {
                    roots.push(e.path());
                }
            }
        }
    }
    if let Ok(s) = std::env::var("NVM_SYMLINK") {
        roots.push(PathBuf::from(s));
    }
    roots.push(PathBuf::from(r"C:\Program Files\nodejs"));
    roots.push(PathBuf::from(r"C:\Program Files (x86)\nodejs"));
    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            roots.push(dir);
        }
    }
    roots
        .into_iter()
        .map(|root| root.join(REL))
        .find(|p| p.is_file())
}

/// spawn 任意命令，stdout/stderr 逐行转发日志，CREATE_NO_WINDOW 防闪黑窗。
fn spawn_child(command: &str, args: &[String]) -> Result<Child, SpawnError> {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let mut child = cmd
        .spawn()
        .map_err(|e| SpawnError::Other(format!("spawn {command} 失败：{e}")))?;
    if let Some(out) = child.stdout.take() {
        thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                log::info!("[dsh] {line}");
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                log::warn!("[dsh] {line}");
            }
        });
    }
    Ok(child)
}

/// spawn `dsh web --host 127.0.0.1 --port <port>`。
///
/// 默认 `node <bin.js>` 直跑（dsh.cmd shim 有引号转义坑）；`DSH_DESKTOP_BACKEND`
/// 提供完整 argv 覆盖（dev 场景跑仓库源码 CLI）。
/// 开发模式：自动检测源码仓库（E:\vibeCoding\deepseek-harness）优先使用。
fn spawn_dsh(port: u16) -> Result<Child, SpawnError> {
    let port = port.to_string();
    if let Ok(override_cmd) = std::env::var("DSH_DESKTOP_BACKEND") {
        let (command, args) = parse_command(&override_cmd);
        let mut args = args;
        args.push("web".into());
        args.push("--host".into());
        args.push("127.0.0.1".into());
        args.push("--port".into());
        args.push(port);
        log::info!("按 DSH_DESKTOP_BACKEND 启动：{command} {}", args.join(" "));
        return spawn_child(&command, &args);
    }
    // 开发模式：源码仓库 CLI 优先（config/schema 改动立即生效）
    let checkout_cli = PathBuf::from(r"E:\vibeCoding\deepseek-harness\apps\cli\src\bin.ts");
    if checkout_cli.is_file() {
        let node = find_node().ok_or_else(|| {
            SpawnError::NotFound("未找到 node.exe。".to_string())
        })?;
        let args = vec![
            "--import".into(),
            "tsx/esm".into(),
            checkout_cli.to_string_lossy().into_owned(),
            "web".into(),
            "--host".into(),
            "127.0.0.1".into(),
            "--port".into(),
            port,
        ];
        log::info!("dev 模式：源码仓库 CLI {}", args.join(" "));
        return spawn_child(&node.to_string_lossy(), &args);
    }
    let node = find_node().ok_or_else(|| {
        SpawnError::NotFound("未找到 node.exe。请安装 Node.js 或设置 DSH_NODE 环境变量。".to_string())
    })?;
    let bin_js = find_dsh_bin_js().ok_or_else(|| {
        SpawnError::NotFound(
            "未找到 @deepseek-ai/dsh。请执行 `npm i -g @deepseek-ai/dsh`，或设置 DSH_BIN 指向 bin.js。"
                .to_string(),
        )
    })?;
    let args = vec![
        bin_js.to_string_lossy().into_owned(),
        "web".into(),
        "--host".into(),
        "127.0.0.1".into(),
        "--port".into(),
        port,
    ];
    spawn_child(&node.to_string_lossy(), &args)
}

/// 生成本地通知服务器的访问 token（防本机其它进程误触发；非加密学强度）。
fn random_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("dsh{:x}{:x}", nanos, std::process::id())
}

/// 启动本地 HTTP 通知服务器（127.0.0.1 随机端口），返回 (端口, token)。
fn start_notify_server(app: AppHandle) -> (u16, String) {
    let token = random_token();
    let listener = match std::net::TcpListener::bind(("127.0.0.1", 0)) {
        Ok(l) => l,
        Err(e) => {
            log::warn!("通知服务器启动失败：{e}");
            return (0, token);
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    listener.set_nonblocking(true).ok();
    let handle = app.clone();
    let tok = token.clone();
    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(l) => l,
            Err(_) => return,
        };
        loop {
            let (mut sock, _) = match listener.accept().await {
                Ok(x) => x,
                Err(_) => continue,
            };
            let handle = handle.clone();
            let tok = tok.clone();
            tauri::async_runtime::spawn(async move {
                handle_notify_conn(&mut sock, &handle, &tok).await;
            });
        }
    });
    log::info!("任务完成通知服务器已启动：127.0.0.1:{port}");
    (port, token)
}

/// CORS 响应头：注入脚本从 `127.0.0.1:3080` 跨源 fetch 到本桥（随机端口），
/// `Content-Type: application/json` + `Authorization` 头会触发浏览器 preflight；
/// 不回 OPTIONS 与 `Access-Control-Allow-*` 头，浏览器会直接拦截实际请求。
const CORS_HEADERS: &str = "Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: POST, OPTIONS\r\n\
Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
Access-Control-Max-Age: 86400\r\n";

/// 处理单条通知连接：先应答 CORS 预检，再校验 Bearer token、解析 JSON body、触发通知。
async fn handle_notify_conn(sock: &mut tokio::net::TcpStream, app: &AppHandle, token: &str) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buf = [0u8; 4096];
    let n = match sock.read(&mut buf).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req = String::from_utf8_lossy(&buf[..n]).to_string();
    if req.starts_with("OPTIONS ") {
        let _ = sock
            .write_all(
                format!("HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n{CORS_HEADERS}\r\n")
                    .as_bytes(),
            )
            .await;
        return;
    }
    if !req.contains(&format!("Bearer {token}")) {
        let _ = sock
            .write_all(b"HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
            .await;
        return;
    }
    log::info!("收到通知桥请求");
    let body = req.split("\r\n\r\n").nth(1).unwrap_or("").trim().to_string();
    let payload = parse_notify_payload(&body);
    notify_completed(
        app,
        payload.title.as_deref(),
        &payload.body,
        payload.force,
        payload.session_id.as_deref(),
    );
    let _ = sock
        .write_all(
            format!("HTTP/1.1 204 No Content\r\nConnection: close\r\nContent-Length: 0\r\n{CORS_HEADERS}\r\n")
                .as_bytes(),
        )
        .await;
    let _ = sock.flush().await;
}

/// 通知桥请求体的解析结果（dsh-notification 插件经 shim 上报）。
#[derive(Debug, PartialEq)]
struct NotifyPayload {
    title: Option<String>,
    body: String,
    force: bool,
    /// 会话 id：toast 被点击后跳转到该会话；缺省 = 仅聚焦窗口。
    session_id: Option<String>,
}

/// 解析通知桥 JSON 请求体；缺字段取默认值，整体非 JSON 时回退到全默认。
fn parse_notify_payload(body: &str) -> NotifyPayload {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return NotifyPayload {
            title: None,
            body: "任务已完成".to_string(),
            force: false,
            session_id: None,
        };
    };
    NotifyPayload {
        title: v.get("title").and_then(|x| x.as_str()).map(str::to_string),
        body: v
            .get("body")
            .and_then(|x| x.as_str())
            .unwrap_or("任务已完成")
            .to_string(),
        force: v.get("force").and_then(|x| x.as_bool()).unwrap_or(false),
        session_id: v
            .get("sessionId")
            .and_then(|x| x.as_str())
            .map(str::to_string),
    }
}

/// 通知点击后的会话跳转脚本：派发 `dsh:open-session` CustomEvent，
/// dsh-notification-custom 插件（浏览器半）监听后调用 `ctx.sessions.open`。
fn open_session_script(session_id: &str) -> String {
    let quoted = serde_json::to_string(session_id).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        "window.dispatchEvent(new CustomEvent('dsh:open-session', {{ detail: {{ sessionId: {quoted} }} }}));"
    )
}

/// 通知被点击：聚焦主窗口，并把会话跳转事件派发给页面。
fn open_session(app: &AppHandle, session_id: &str) {
    if let Some(w) = app.get_webview_window("main") {
        if let Err(e) = w.eval(&open_session_script(session_id)) {
            log::warn!("会话跳转事件派发失败：{e}");
        }
    }
}

/// 桌宠气泡点击：显示主窗口并跳转到会话（与 Windows 通知点击同一行为）。
#[tauri::command]
fn pet_open_session(app: AppHandle, session_id: String) {
    let handle = app.clone();
    let dispatched = app.run_on_main_thread(move || {
        let Some(w) = handle.get_webview_window("main") else {
            log::warn!("pet_open_session：未找到 main 窗口");
            return;
        };
        log::info!("pet_open_session：window visible={:?}", w.is_visible());
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_always_on_top(true);
        let _ = w.set_focus();
        // open_session 必须在主线程执行：eval 依赖主线程的 webview 上下文
        if !session_id.is_empty() {
            let quoted = serde_json::to_string(&session_id).unwrap_or_else(|_| "\"\"".to_string());
            let script = format!(
                "console.log('[kanye-pet] eval executing, sid=', {quoted});\
                 window.dispatchEvent(new CustomEvent('dsh:open-session', {{ detail: {{ sessionId: {quoted} }} }}));\
                 console.log('[kanye-pet] event dispatched');"
            );
            log::info!("pet_open_session eval: session_id={session_id}");
            if let Err(e) = w.eval(&script) {
                log::warn!("pet_open_session eval 失败：{e}");
            } else {
                log::info!("pet_open_session eval OK");
            }
        }
    });
    if let Err(e) = dispatched {
        log::warn!("pet_open_session 主线程派发失败：{e}");
    }
    // 延时收尾
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;
        if let Some(win) = handle.get_webview_window("main") {
            let _ = win.set_always_on_top(false);
            let _ = win.set_focus();
        }
    });
}

/// 桌宠本体点击：显示主窗口（弹到桌面最上层）。
#[tauri::command]
fn pet_show_main(app: AppHandle) {
    show_main(&app);
}

/// 收到任务完成信号后的壳侧动作：未读数 +1；默认仅窗口失焦/隐藏时弹通知（force 时无条件弹）。
/// 携带 session_id 时给 toast 挂点击回调：点击后聚焦窗口并跳转到对应会话。
fn notify_completed(app: &AppHandle, title: Option<&str>, body: &str, force: bool, session_id: Option<&str>) {
    let distracted = app
        .get_webview_window("main")
        .map(|w| {
            let focused = w.is_focused().unwrap_or(true);
            let visible = w.is_visible().unwrap_or(true);
            !focused || !visible
        })
        .unwrap_or(true);
    let state = app.state::<DshState>();
    let unread = state.unread.fetch_add(1, Ordering::SeqCst) + 1;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_badge_count(Some(unread as i64));
        if distracted || force {
            // ponytail: tauri-winrt-notification 直连（notify-rust 在 Windows 上忽略 icon 字段）。
            // 不设 appLogoOverride 图标：Win11 会把它渲染成内容区大图；左上角图标由
            // AUMID 解析（注册表 IconUri / 快捷方式图标）提供。
            let mut toast = tauri_winrt_notification::Toast::new("ai.deepseek.harness.desktop")
                .title(title.unwrap_or("DeepSeek Harness · 任务完成"))
                .text1(body);
            if let Some(sid) = session_id {
                let handle = app.clone();
                let target = sid.to_string();
                toast = toast.on_activated(move |_action| {
                    log::info!("toast 点击激活（session={target}）");
                    show_main(&handle);
                    // 空 id（测试通知等无真实会话）只弹窗，不派发跳转——避免无意义的
                    // unknown-session 失败；真实会话才触发 open_session。
                    if !target.is_empty() {
                        open_session(&handle, &target);
                    }
                    Ok(())
                });
            }
            match toast.show() {
                Ok(()) => log::info!("toast 已发送（title={:?}, force={force}）", title),
                Err(e) => log::error!("toast 发送失败：{e}"),
            }
            if distracted {
                let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
            }
        }
    }
    log::info!("任务完成通知：{}（未读 {unread}，失焦={distracted}）", body);
}

/// WebView2 初始化脚本：文档解析前（页面脚本执行前）注入 Notification API shim 与通知桥。
/// Windows 底层等价 AddScriptToExecuteOnDocumentCreated，跨所有导航（含远程 URL）持久生效。
fn bridge_init_script(port: u16, token: &str) -> String {
    let js = r#"
(function(){
  if (window.__dshNotifyShim) return;
  window.__dshNotifyShim = true;
  var PORT = __PORT__, TOKEN = "__TOKEN__";
  // 通知桥：页面与壳子本地 HTTP 桥（POST /notify + Bearer token，4s 节流去重）
  window.__dshNotifyBridge = {
    port: PORT,
    token: TOKEN,
    _last: 0,
    fire: function(payload) {
      var now = Date.now();
      if (now - this._last < 4000) return;
      this._last = now;
      try {
        fetch('http://127.0.0.1:'+PORT+'/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
          body: JSON.stringify(payload)
        });
      } catch(e){}
    }
  };
  // WebView2 无 Web Notification 权限机制：替换为恒 granted 的 shim，
  // 构造器直接触发通知桥——原版插件（new Notification(...)）无需任何改动即可弹系统 toast。
  function ShimNotification(title, options) {
    this.title = title;
    this.options = options || {};
    this.onclick = null;
    var bridge = window.__dshNotifyBridge;
    if (!bridge || !bridge.fire) return;
    var payload = {
      type: 'dsh-notification',
      title: title,
      body: (options && options.body) || '',
      tag: (options && options.tag) || '',
      sessionId: (options && options.sessionId) || '',
      requireInteraction: !!(options && options.requireInteraction),
      force: true
    };
    // 所有通知（含 pending 审批/提问）都查桌宠开关：
    // 启用时由 kanye-pet 气泡接管（抑制 Windows Toast），关闭时走 Windows。
    // 查询失败（DSH 未就绪）兜底走 Windows。
    var fire = function() { bridge.fire(payload); };
    try {
      fetch('http://127.0.0.1:3080/kanye-pet/config', { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(b) {
          var cfg = (b && b.config) || b || {};
          // desktopPetEnabled 缺省视为启用（与 config.mjs default(true) 一致）
          if (cfg.desktopPetEnabled === false) fire();
          // pet 启用：直接抑制，由 kanye-pet turn 检测 + 轮询驱动气泡
        })
        .catch(function() { fire(); });  // 查询失败兜底走 Windows
    } catch (e) { fire(); }
  }
  ShimNotification.permission = 'granted';
  ShimNotification.requestPermission = function() { return Promise.resolve('granted'); };
  window.Notification = ShimNotification;
})();
"#;
    js.replace("__PORT__", &port.to_string())
        .replace("__TOKEN__", token)
}

/// 生成页面侧任务完成监听脚本：轮询"忙碌→空闲"翻转，翻转即弹桌面通知。
/// 走 `new Notification` 而非直接 `bridge.fire()`，让 ShimNotification 统一决策
/// （桌宠启用时抑制 Windows 通知、由 pet 气泡接管）。
fn task_notifier_script() -> String {
    let js = r#"
(function(){
  if (window.__dshNotifyHeuristic) return;
  window.__dshNotifyHeuristic = true;
  var wasBusy = false;
  function isBusy() {
    try {
      if (document.querySelector('[data-state="ongoing"]')) return true;
      if (document.querySelector('[aria-busy="true"]')) return true;
    } catch(e){}
    return false;
  }
  setInterval(function(){
    var b = isBusy();
    if (wasBusy && !b) {
      try { new Notification('DeepSeek Harness', { body: '任务已完成，回来看看吧' }); } catch(e){}
    }
    wasBusy = b;
  }, 1000);
})();
"#;
    js.to_string()
}

/// 导航完成后注入任务完成启发式监听（桥与 shim 已由初始化脚本注入，脚本自带守卫，重复注入无害）。
fn inject_task_notifier(app: AppHandle, port: u16) {
    if port == 0 {
        return;
    }
    let handle = app.clone();
    let script = task_notifier_script();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(2500)).await;
        if let Some(w) = handle.get_webview_window("main") {
            if let Err(e) = w.eval(&script) {
                log::warn!("任务完成监听注入失败：{e}");
            } else {
                log::info!("任务完成监听已注入（忙碌→空闲检测）");
            }
        }
    });
}

/// 轮询等待服务就绪，然后把主窗口导航到 Web GUI；失败则跳错误页。
async fn wait_ready_and_navigate(app: AppHandle, port: u16, nport: u16) {
    let state = app.state::<DshState>();
    let url = format!("http://127.0.0.1:{port}/");
    let deadline = Instant::now() + READY_TIMEOUT;
    loop {
        if state.spawn_failed.load(Ordering::SeqCst) {
            // 错误页已由 setup 按具体原因（not-found / spawn-failed）显示，这里不再二次导航
            return;
        }
        if port_open(port) {
            if let Some(w) = app.get_webview_window("main") {
                let script = format!("window.location.replace({url:?});");
                if let Err(e) = w.eval(&script) {
                    log::warn!("窗口导航失败：{e}");
                    show_error(&app, "spawn-failed");
                    return;
                }
                // 导航后注入启发式监听：桥与 shim 已由初始化脚本在文档创建时注入
                inject_task_notifier(app.clone(), nport);
            }
            log::info!("本地服务就绪，已导航到 {url}");
            return;
        }
        if Instant::now() >= deadline {
            log::error!("等待本地服务就绪超时（{}s）", READY_TIMEOUT.as_secs());
            show_error(&app, "timeout");
            return;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// 主窗口跳转到本地错误页并发系统通知。
fn show_error(app: &AppHandle, reason: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let target = format!("error.html?reason={reason}");
        let _ = w.eval(&format!("window.location.replace({target:?});"));
    }
    let body = match reason {
        "not-found" => "未找到 dsh 命令，请按错误页提示安装。",
        "spawn-failed" => "dsh 进程启动失败，详见日志。",
        "timeout" => "等待本地服务就绪超时，详见日志。",
        _ => "未知错误，详见日志。",
    };
    let _ = app
        .notification()
        .builder()
        .title("DeepSeek Harness 启动失败")
        .body(body)
        .show();
}

/// 显示并聚焦主窗口，并把窗口置顶到 Z 序最前。
/// toast 点击回调运行在 winrt 事件线程，窗口操作必须经 run_on_main_thread
/// 派发到主线程执行；show/unminimize/set_focus 的返回与窗口状态落日志，
/// 供"点击通知不弹窗"场景定位。置顶瞬闪（TOPMOST → 取消）绕开后台进程
/// SetForegroundWindow 被前台锁拒绝、窗口恢复后仍压在别的窗口后的问题。
fn show_main(app: &AppHandle) {
    let handle = app.clone();
    let dispatched = app.run_on_main_thread(move || {
        let Some(w) = handle.get_webview_window("main") else {
            log::warn!("show_main：未找到 main 窗口");
            return;
        };
        log::info!("show_main 前：visible={:?} focused={:?}", w.is_visible(), w.is_focused());
        let show = w.show();
        let unmin = w.unminimize();
        // 置顶优先于 set_focus：SetWindowPos(HWND_TOPMOST) 直接跳 Z 序最前并争取焦点，
        // 不依赖 Alt 键模拟在前台锁下的效果。
        let topmost = w.set_always_on_top(true);
        let focus = w.set_focus();
        log::info!(
            "show_main 结果：show={} unminimize={} topmost={} set_focus={}",
            show.is_ok(),
            unmin.is_ok(),
            topmost.is_ok(),
            focus.is_ok()
        );
    });
    if let Err(e) = dispatched {
        log::warn!("show_main 主线程派发失败：{e}");
    }
    // 延时收尾：窗口已显示并置顶抢到前台后取消 TOPMOST（恢复普通 Z 序语义，
    // 窗口保持最前），再补一次 set_focus 兜底前台锁。
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;
        if let Some(win) = handle.get_webview_window("main") {
            let _ = win.set_always_on_top(false);
            let _ = win.set_focus();
        }
    });
}

/// 开机自启菜单项文案（实时反映当前状态）。
fn autostart_item_label(enabled: bool) -> &'static str {
    if enabled {
        "开机自启：已开启"
    } else {
        "开机自启：已关闭"
    }
}

/// 切换开机自启（Windows 注册表 Run 键），并同步托盘菜单文案。
fn toggle_autostart(app: &AppHandle) {
    let on = app.autolaunch().is_enabled().unwrap_or(false);
    let result = if on {
        app.autolaunch().disable()
    } else {
        app.autolaunch().enable()
    };
    match result {
        Ok(()) => log::info!("开机自启已切换为{}", if on { "关闭" } else { "开启" }),
        Err(e) => log::error!("切换开机自启失败：{e}"),
    }
    if let Some(item) = app
        .state::<DshState>()
        .autostart_item
        .lock()
        .unwrap()
        .as_ref()
    {
        let _ = item.set_text(autostart_item_label(!on));
    }
}

/// 构建托盘：左键显示窗口，菜单提供显示/开机自启（实时状态）/退出。
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = MenuItem::with_id(app, "autostart", autostart_item_label(enabled), true, None::<&str>)?;
    app.state::<DshState>()
        .autostart_item
        .lock()
        .unwrap()
        .replace(autostart.clone());
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let devtools = MenuItem::with_id(app, "devtools", "开发者工具", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &autostart, &devtools, &quit])?;
    TrayIconBuilder::with_id("dsh-tray")
        .icon(app.default_window_icon().expect("缺少应用图标").clone())
        .tooltip("DeepSeek Harness")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "autostart" => toggle_autostart(app),
            "devtools" => {
                if let Some(w) = app.get_webview_window("main") {
                    w.open_devtools();
                }
            }
            "quit" => {
                app.state::<DshState>().quitting.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// 注册当前进程 AUMID + 注册表 DisplayName/IconUri（builder 前调用，logger 未初始化，用 eprintln）。
fn register_aumid() {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    extern "system" {
        fn RegCreateKeyExW(hkey: isize, sub: *const u16, res: u32, cls: *const u16, opt: u32, sam: u32, sec: *const u8, out: *mut isize, disp: *mut u32) -> i32;
        fn RegSetValueExW(hkey: isize, name: *const u16, res: u32, kind: u32, data: *const u8, len: u32) -> i32;
        fn RegCloseKey(hkey: isize) -> i32;
    }
    let aumid = "ai.deepseek.harness.desktop";
    let display_name = "DeepSeek Harness";

    let aumid_w: Vec<u16> = aumid.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(PCWSTR(aumid_w.as_ptr()));
    }

    let icon_bytes = include_bytes!("../icons/128x128.png");
    let icon_path = std::env::var("LOCALAPPDATA")
        .map(|d| std::path::PathBuf::from(d).join("ai.deepseek.harness.desktop").join("icon.png"))
        .unwrap_or_else(|_| std::path::PathBuf::from("icon.png"));
    let _ = std::fs::create_dir_all(icon_path.parent().unwrap_or(std::path::Path::new(".")));
    let _ = std::fs::write(&icon_path, icon_bytes);

    const HKCU: isize = 0x8000_0001u32 as isize;
    const KEY_WRITE: u32 = 0x20006;
    const REG_SZ: u32 = 1;
    let sub: Vec<u16> = format!("Software\\Classes\\AppUserModelId\\{aumid}\0").encode_utf16().collect();
    let dn_name: Vec<u16> = "DisplayName\0".encode_utf16().collect();
    let dn_val: Vec<u16> = format!("{display_name}\0").encode_utf16().collect();
    let icon_name: Vec<u16> = "IconUri\0".encode_utf16().collect();
    let icon_val: Vec<u16> = icon_path.to_string_lossy().encode_utf16().chain(std::iter::once(0)).collect();
    let mut hkey: isize = 0;
    unsafe {
        RegCreateKeyExW(HKCU, sub.as_ptr(), 0, std::ptr::null(), 0, KEY_WRITE, std::ptr::null(), &mut hkey, std::ptr::null_mut());
        if hkey != 0 {
            RegSetValueExW(hkey, dn_name.as_ptr(), 0, REG_SZ, dn_val.as_ptr() as *const u8, (dn_val.len() * 2) as u32);
            RegSetValueExW(hkey, icon_name.as_ptr(), 0, REG_SZ, icon_val.as_ptr() as *const u8, (icon_val.len() * 2) as u32);
            RegCloseKey(hkey);
            eprintln!("[dsh] AUMID 注册表已写入：{aumid}，图标：{}", icon_path.display());
        }
    }
}

/// 创建/更新开始菜单快捷方式并写入 AppUserModelID（setup 中调用，logger 可用）。
/// 每次启动重写，保证便携版挪动后快捷方式仍指向最新 exe。
fn ensure_shortcut() {
    use windows::core::*;
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, IPersistFile,
    };
    use windows::Win32::System::Variant::VT_LPWSTR;
    use windows::Win32::UI::Shell::PropertiesSystem::{
        GPS_READWRITE, IPropertyStore, SHGetPropertyStoreFromParsingName,
    };
    use windows::Win32::UI::Shell::{SHGetKnownFolderPath, FOLDERID_Programs, IShellLinkW, ShellLink};
    use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;

    let shortcut_path = match unsafe { SHGetKnownFolderPath(&FOLDERID_Programs, Default::default(), None) } {
        Ok(p) => std::path::PathBuf::from(unsafe { p.to_string() }.unwrap_or_default()).join("DeepSeek Harness.lnk"),
        Err(_) => {
            log::warn!("无法获取开始菜单路径，跳过快捷方式创建");
            return;
        }
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        // 1) IShellLink 创建/更新快捷方式（SetPath + Save）
        let link_result: windows::core::Result<()> = (|| {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            let exe = std::env::current_exe().unwrap_or_default();
            link.SetPath(&HSTRING::from(exe.to_string_lossy().as_ref()))?;
            link.SetDescription(&HSTRING::from("DeepSeek Harness"))?;
            let persist: IPersistFile = link.cast()?;
            persist.Save(&HSTRING::from(shortcut_path.to_string_lossy().as_ref()), true)?;
            Ok(())
        })();
        if let Err(e) = link_result {
            log::warn!("快捷方式创建失败：{e}");
            CoUninitialize();
            return;
        }
        // 2) SHGetPropertyStoreFromParsingName 打开 .lnk 文件的属性存储写 AppUserModelID
        //    （IShellLink 自带的 IPropertyStore 不落盘，官方推荐路径是解析文件属性存储）
        let prop_result: windows::core::Result<()> = (|| {
            let store: IPropertyStore = SHGetPropertyStoreFromParsingName(
                &HSTRING::from(shortcut_path.to_string_lossy().as_ref()),
                None,
                GPS_READWRITE,
            )?;
            // ponytail: 字节级构造 PROPVARIANT（vt=31 LPWSTR + 偏移8 指针），
            // 绕开 windows-rs union/ManuallyDrop 字段赋值限制。
            let key = PKEY_AppUserModel_ID;
            let aumid_w: Vec<u16> = "ai.deepseek.harness.desktop".encode_utf16().chain(std::iter::once(0)).collect();
            let mut pv_bytes = [0u8; 24];
            pv_bytes[..2].copy_from_slice(&VT_LPWSTR.0.to_le_bytes());
            pv_bytes[8..16].copy_from_slice(&(aumid_w.as_ptr() as usize).to_le_bytes());
            let pv_ptr = pv_bytes.as_ptr() as *const PROPVARIANT;
            store.SetValue(&key, &*pv_ptr)?;
            store.Commit()?;
            Ok(())
        })();
        match prop_result {
            Ok(()) => log::info!("快捷方式已更新：{}", shortcut_path.display()),
            Err(e) => log::warn!("快捷方式 AUMID 写入失败：{e}"),
        }
        CoUninitialize();
    }
}

pub fn run() {
    register_aumid();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("dsh-desktop".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log::info!("收到第二实例请求（args={args:?}），显示主窗口");
            show_main(app);
        }))
        .invoke_handler(tauri::generate_handler![pet_open_session, pet_show_main])
        .manage(DshState {
            child: Mutex::new(None),
            spawned_this_run: AtomicBool::new(false),
            spawn_failed: AtomicBool::new(false),
            quitting: AtomicBool::new(false),
            tray_tip_shown: AtomicBool::new(false),
            unread: AtomicU32::new(0),
            autostart_item: Mutex::new(None),
        })
        .setup(|app| {
            // 通知桥先起：端口/token 要写进窗口初始化脚本，窗口创建前必须就绪
            let (nport, ntoken) = start_notify_server(app.handle().clone());
            let port = app_port();
            // 主窗口改为代码创建：initialization_script 在文档解析前注入
            // Notification shim + 通知桥（WebView2 无 Web Notification 权限机制）
            // 外部链接处理与 Electron 版对齐：target=_blank/新窗口请求与跨源导航
            // 一律交给系统默认浏览器，壳内不允许打开应用 origin 之外的页面。
            let _window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("DeepSeek Harness")
            .inner_size(1440.0, 900.0)
            .min_inner_size(900.0, 600.0)
            .center()
            // 文件拖放走 DOM HTML5 拖拽（dsh-file-upload 插件依赖 drag 事件）：
            // 必须同时关掉 tao 窗口拖放目标 和 tauri 默认的 wry 拖放 handler——wry 一装
            // handler 就会把 WebView2 AllowExternalDrop 置 false 并自行接管，DOM 收不到
            // 任何 drag 事件（光标 X / 无反应）。两处都关后 AllowExternalDrop 保持默认
            // TRUE，WebView2 原生处理拖放，页面才能收到 dragenter/dragover/drop。
            .drag_and_drop(false)
            .disable_drag_drop_handler()
            .initialization_script(bridge_init_script(nport, &ntoken))
            .on_navigation(move |url| {
                if is_app_origin(url, port) {
                    return true;
                }
                // Windows 上 Tauri 应用协议（内置页面）呈现为 http://tauri.localhost，属应用内
                if url.host_str() == Some("tauri.localhost") {
                    return true;
                }
                if url.scheme() == "http" || url.scheme() == "https" {
                    open_in_browser(url.as_str());
                    false
                } else {
                    true
                }
            })
            .on_new_window(move |url, _features| {
                if url.scheme() == "http" || url.scheme() == "https" {
                    open_in_browser(url.as_str());
                }
                tauri::webview::NewWindowResponse::Deny
            })
            .build()?;
            let state = app.state::<DshState>();
            if port_open(port) {
                log::info!("127.0.0.1:{port} 已有服务在监听，直接复用现有实例");
            } else {
                match spawn_dsh(port) {
                    Ok(child) => {
                        log::info!("dsh 子进程已启动（PID {}）", child.id());
                        *state.child.lock().unwrap() = Some(child);
                        state.spawned_this_run.store(true, Ordering::SeqCst);
                    }
                    Err(SpawnError::NotFound(e)) => {
                        log::error!("启动 dsh 失败：{e}");
                        state.spawn_failed.store(true, Ordering::SeqCst);
                        show_error(app.handle(), "not-found");
                    }
                    Err(SpawnError::Other(e)) => {
                        log::error!("启动 dsh 失败：{e}");
                        state.spawn_failed.store(true, Ordering::SeqCst);
                        show_error(app.handle(), "spawn-failed");
                    }
                }
            }
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                wait_ready_and_navigate(handle, port, nport).await;
            });
            // 测试钩子：DSH_DESKTOP_AUTO_QUIT=1 时 8 秒后自动走退出流程（模拟托盘退出，
            // 验证子进程回收）；设为其它数字 N 时 N 秒后退出（冷启动验收需要更长等待）。
            if let Some(v) = std::env::var("DSH_DESKTOP_AUTO_QUIT").ok() {
                let secs = if v == "1" { 8 } else { v.parse::<u64>().unwrap_or(8) };
                if secs > 0 {
                    let handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(secs)).await;
                        log::info!("[auto-quit] 测试钩子触发退出");
                        handle
                            .state::<DshState>()
                            .quitting
                            .store(true, Ordering::SeqCst);
                        handle.exit(0);
                    });
                }
            }
            // 测试钩子：DSH_DESKTOP_NOTIFY_TEST=1 时延迟触发一次通知（验证通知链路）
            if std::env::var("DSH_DESKTOP_NOTIFY_TEST").as_deref() == Ok("1") {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(6)).await;
                    notify_completed(&handle, None, "这是测试通知：任务完成链路验证", false, None);
                });
            }
            // 桌面宠物：透明置顶小窗，右下角悬浮，加载本地 pet.html。
            // pet.js 轮询 DSH /pet/config（host-pet 插件）跟随设置（启用/角色/尺寸/透明度），
            // 从 /pet/assets 加载角色素材；设置 tab 关闭时 pet.js 隐藏自身。
            // 桌面宠物：透明置顶小窗。开关由 DSH settings 的 kanye-pet.desktopPetEnabled 控制。
            let pet_enabled = matches!(
                std::env::var("DSH_DESKTOP_PET_ENABLED").as_deref(),
                Ok("1") | Ok("true") | Err(_) // 缺省启用（未设 env 时启用）
            );
            if pet_enabled {
                log::info!("[pet] creating desktop pet window");
                let (pet_w, pet_h) = (150.0f64, 255.0f64);
                let pet_pos = app
                    .primary_monitor()
                    .ok()
                    .flatten()
                    .map(|monitor| {
                        let size = monitor.size();
                        let scale = monitor.scale_factor();
                        let sx = size.width as f64 / scale;
                        let sy = size.height as f64 / scale;
                        // 右下角
                        (sx - pet_w - 24.0, sy - pet_h - 24.0)
                    })
                    .unwrap_or((100.0, 100.0));
                let _pet_window = tauri::WebviewWindowBuilder::new(
                    app,
                    "pet",
                    tauri::WebviewUrl::App("pet.html".into()),
                )
                .title("桌宠 Kanye")
                .inner_size(pet_w, pet_h)
                .position(pet_pos.0, pet_pos.1)
                .always_on_top(true)
                .decorations(false)
                .resizable(true)
                .transparent(true)
                .shadow(false)
                .skip_taskbar(true)
                .build()?;
                log::info!("[pet] desktop pet window created successfully");
            } else {
                log::info!("[pet] desktop pet disabled");
            }
            build_tray(app)?;
            ensure_shortcut();
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<DshState>();
                if state.quitting.load(Ordering::SeqCst) {
                    return; // 托盘退出流程：放行关闭
                }
                api.prevent_close();
                let _ = window.hide();
                if !state.tray_tip_shown.swap(true, Ordering::SeqCst) {
                    let _ = window
                        .app_handle()
                        .notification()
                        .builder()
                        .title("DeepSeek Harness 仍在运行")
                        .body("窗口已隐藏到系统托盘，点击托盘图标可重新打开；托盘菜单可退出。")
                        .show();
                }
            } else if let WindowEvent::Focused(true) = event {
                // 用户回到窗口：清零角标与未读数
                let state = window.state::<DshState>();
                state.unread.store(0, Ordering::SeqCst);
                let _ = window.set_badge_count(None);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            RunEvent::ExitRequested { api, .. } => {
                let quitting = app.state::<DshState>().quitting.load(Ordering::SeqCst);
                if !quitting {
                    api.prevent_exit();
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
            }
            RunEvent::Exit => {
                let state = app.state::<DshState>();
                if state.spawned_this_run.load(Ordering::SeqCst) {
                    if let Some(mut child) = state.child.lock().unwrap().take() {
                        let pid = child.id();
                        log::info!("正在停止 dsh 子进程（PID {pid}）");
                        let _ = child.kill();
                        let _ = child.wait();
                        log::info!("dsh 子进程已退出");
                    }
                }
            }
            _ => {}
        });
}

#[tauri::command]
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_key_parses_semver() {
        assert_eq!(version_key(std::path::Path::new("v22.12.0")), (22, 12, 0));
        assert_eq!(version_key(std::path::Path::new("not-a-version")), (0, 0, 0));
    }

    #[test]
    fn version_key_orders_correctly() {
        // 字符串排序会把 v9.11.0 排在 v22.12.0 之后（'9' > '2'）
        let v9 = version_key(std::path::Path::new("v9.11.0"));
        let v22 = version_key(std::path::Path::new("v22.12.0"));
        assert!(v9 < v22);
    }

    #[test]
    fn is_app_origin_matches_app_only() {
        assert!(is_app_origin(&tauri::Url::parse("http://127.0.0.1:3080/chat").unwrap(), 3080));
        // 端口不同（其它本地服务）不是应用 origin
        assert!(!is_app_origin(&tauri::Url::parse("http://127.0.0.1:9999/").unwrap(), 3080));
        // 外部站点、https、非 http 协议都不是
        assert!(!is_app_origin(&tauri::Url::parse("https://example.com/").unwrap(), 3080));
        assert!(!is_app_origin(&tauri::Url::parse("https://127.0.0.1:3080/").unwrap(), 3080));
        assert!(!is_app_origin(&tauri::Url::parse("tauri://localhost/").unwrap(), 3080));
    }

    #[test]
    fn parse_command_json_and_plain() {
        let (cmd, args) = parse_command(r#"["node","--import","tsx/esm"]"#);
        assert_eq!(cmd, "node");
        assert_eq!(args, vec!["--import", "tsx/esm"]);
        let (cmd, args) = parse_command("node --import tsx/esm");
        assert_eq!(cmd, "node");
        assert_eq!(args, vec!["--import", "tsx/esm"]);
    }

    #[test]
    fn random_token_nonempty_and_unique() {
        let a = random_token();
        let b = random_token();
        assert!(!a.is_empty());
        assert_ne!(a, b);
    }

    #[test]
    fn parse_notify_payload_reads_all_fields() {
        let p = parse_notify_payload(r#"{"title":"t","body":"b","force":true,"sessionId":"s-1"}"#);
        assert_eq!(
            p,
            NotifyPayload {
                title: Some("t".into()),
                body: "b".into(),
                force: true,
                session_id: Some("s-1".into()),
            }
        );
    }

    #[test]
    fn parse_notify_payload_defaults_and_rejects_non_json() {
        let p = parse_notify_payload(r#"{"body":"b"}"#);
        assert_eq!(
            p,
            NotifyPayload {
                title: None,
                body: "b".into(),
                force: false,
                session_id: None,
            }
        );
        let p = parse_notify_payload("not json");
        assert_eq!(
            p,
            NotifyPayload {
                title: None,
                body: "任务已完成".into(),
                force: false,
                session_id: None,
            }
        );
    }

    #[test]
    fn open_session_script_quotes_session_id() {
        assert_eq!(
            open_session_script("s-1"),
            "window.dispatchEvent(new CustomEvent('dsh:open-session', { detail: { sessionId: \"s-1\" } }));"
        );
        // 引号/反斜杠走 JSON 转义，不会破坏脚本字符串。
        let escaped = open_session_script("a\"b");
        assert!(escaped.contains("sessionId: \"a\\\"b\""));
    }
}
