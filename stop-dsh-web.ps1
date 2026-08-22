# stop-dsh-web.ps1 - 停止 dsh web 后台进程 (port 3080)
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File stop-dsh-web.ps1
# 注意: 用 netstat 而非 Get-NetTCPConnection，因为 DSH 沙盒下 WMI/CIM 被隔离，
#       Get-NetTCPConnection 永远返回空。
$ErrorActionPreference = 'Stop'

# netstat 输出: "  TCP    127.0.0.1:3080  0.0.0.0:0  LISTENING  63364"
$listenerPid = netstat -ano | Select-String ":3080.*LISTENING" | ForEach-Object {
    $fields = $_.Line -split '\s+'
    # fields: ['', 'TCP', '127.0.0.1:3080', '0.0.0.0:0', 'LISTENING', '63364']
    if ($fields.Count -ge 6 -and $fields[-1] -match '^\d+$') { [int]$fields[-1] }
} | Select-Object -First 1

if (-not $listenerPid) { Write-Host 'dsh web not running.'; exit 0 }

try {
    $proc = Get-Process -Id $listenerPid -ErrorAction Stop
    Stop-Process -Id $listenerPid -Force
    Write-Host "Stopped dsh web (pid ${listenerPid}, $($proc.ProcessName))"
} catch {
    Write-Host "Failed to stop pid ${listenerPid}: $_"
    exit 1
}
