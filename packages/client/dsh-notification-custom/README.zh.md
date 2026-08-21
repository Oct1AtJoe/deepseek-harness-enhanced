# @deepseek-ai/dsh-notification-custom

[English](README.md) | 中文

[omdsh-dev/dsh-notification](https://github.com/omdsh-dev/dsh-notification)（v0.1.2）的本地 fork。DeepSeek Harness Web GUI 的桌面通知：会话结束一轮时，浏览器弹出系统通知，切走也能知道 DSH 已完成。按结束状态开关 + 包含/排除关键词规则，精确控制哪些完成要提醒。

无需改动 harness：host 侧贡献一个会话投影（每个会话最近完成一轮的有界摘要），client 侧监听会话列表的完成提醒，并应用自己持久化的偏好设置。

```
host:   notification projection (last turn's reason/text/tools)  --session/projection-->  browser
client: session list completion reminder (live, dedup) + persisted settings
        -> permission + current-session visibility gate
        -> new Notification("DSH finished", { body: title })
```

## 本地补丁（相对上游）

- **通知正文使用会话标题而非模型回复内容**：`src/client/runner.ts` 返回 `body: title ?? ''`。标题为空时使用空正文兜底文案。
- **桌面壳集成**：本仓库的 Tauri 壳（`desktop-tauri/`）注入 WebView2 shim（`window.Notification` 恒报 `permission: granted`，构造器触发壳子本地 HTTP 通知桥），浏览器半代码零改动即可弹 Windows toast。本 fork 另把会话 id 透传到通知 options：点击 toast 时壳子聚焦窗口，并向页面派发本插件监听的 `dsh:open-session` 事件，在 GUI 里打开对应会话。见 `desktop-tauri/README.md`。

## 挂载

本包是 workspace 插件，由 web profile 的 `cordis.patch.yml` 按名挂载：

```yaml
- insert:
    - id: dsh-notification-custom
      name: '@deepseek-ai/dsh-notification-custom'
```

上游市场安装（`dsh-notification`）已从 profile `package.json` 移除，由本 fork 原位替代。

## 设置

| 设置项 | 默认 | 作用 |
| --- | --- | --- |
| 启用通知 | 开 | 总开关；关闭后不再弹出，规则与偏好保留。 |
| 正常完成 / 出错 / 中止 / 阻塞 / 达 Token 上限 | 完成 + 出错开，其余关 | 哪些结束状态触发通知（host 投影会报告结束原因）。 |
| 关键词规则 | 无 | 针对会话标题、该轮回复文本与调用过的工具名做包含/排除匹配。包含规则：至少命中一条才通知；排除规则：命中即不通知。支持字面量或正则，可区分大小写。 |
| 需要手动关闭 | 关 | 通知保持显示直到手动关闭。 |
| 仅在任务不在眼前时通知 | 开 | 只有完成任务所属会话正显示在眼前时才不提醒；页面在后台，或正在查看其他会话、其他工作区时仍会提醒。关闭后，即使正在观看该会话也会通知。同一会话的通知会互相替换。 |

偏好保存在浏览器（localStorage）。设置段内还可授予权限并发送测试通知。

## 配置

Host 侧可调参数在 `cordis.yml` 的插件行上：

```yaml
- id: dsh-notification-custom
  name: '@deepseek-ai/dsh-notification-custom'
  config:
    maxBodyChars: 400      # projection body budget; longer replies are ellipsized host-side
```

## 对模型的影响

| 方面 | 效果 |
| --- | --- |
| Token 开销 | 无 —— 通知纯属 UI，绝不进入请求。 |
| 工具调用 | 无 —— 模型没有新增任何工具。 |
| 会话日志 | 不变 —— 投影只读已有日志，不新增事件。 |
| 提示词 | 不变 —— 不注册任何 system prompt 段。 |

## 权限边界

- host 侧对会话日志做纯投影折叠（轮次原因、有界的回复文本、工具名），由投影通道交付给浏览器；插件不写日志，不注册面向模型的工具。
- client 侧监听会话列表的完成提醒（运行时已计算的"未选中会话已完成"实时去重信号），仅在权限可用时弹通知。
- 规则匹配在 client 侧针对投影内容进行；回复正文不超过 `maxBodyChars`。

## 开发

```sh
pnpm --filter @deepseek-ai/dsh-notification-custom typecheck
pnpm run test:gui        # includes this package's vitest specs
pnpm --filter @deepseek-ai/dsh-notification-custom bundle
```

## 已知限制

- 通知需要页面处于打开状态（页面在后台时可弹，但关闭标签页后不再弹）。桌面壳下通知走壳子的通知桥，以 Windows toast 呈现。
- 通知在每轮结束（任意会话的 running→idle 边沿）触发一次；断线期间完成的轮次在重连后不会补发。
- 规则匹配对象为会话标题 + 最近一轮的回复文本与工具名，不匹配更早的轮次。
- 通知正文是纯文本摘要；点击通知会聚焦窗口，携带会话 id 时还会在 GUI 里选中该会话（不深链到具体轮次）。

## License

MIT