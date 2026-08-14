# stop-dsh-web.ps1 — 停止后台运行的 dsh web（与 start 脚本同一端口判定）
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File stop-dsh-web.ps1
$ErrorActionPreference = 'Stop'
$listener = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) { Write-Host 'dsh web not running'; exit 0 }
Stop-Process -Id $listener[0].OwningProcess -Force
Write-Host "dsh web stopped (pid $($listener[0].OwningProcess))"
