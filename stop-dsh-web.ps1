# stop-dsh-web.ps1 — 停止 `dsh web` 后台进程。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File stop-dsh-web.ps1
$ErrorActionPreference = 'Stop'

$listener = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) { Write-Host 'dsh web not running.'; exit 0 }

$pids = $listener.OwningProcess | Sort-Object -Unique
foreach ($pid in $pids) {
    try {
        $proc = Get-Process -Id $pid -ErrorAction Stop
        Stop-Process -Id $pid -Force
        Write-Host "Stopped dsh web (pid $pid, $($proc.ProcessName))"
    } catch {
        Write-Host "Failed to stop pid $pid: $_"
    }
}
