// Prevents additional console window on Windows (debug 构建同样生效，避免打开 exe 时弹出 cmd)
#![windows_subsystem = "windows"]

fn main() {
    dsh_desktop_lib::run()
}
