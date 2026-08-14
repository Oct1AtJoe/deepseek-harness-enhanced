# dsh-web-restart.ps1 — 重启 dsh web 以加载新构建的 host lib / client bundle / 组合。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dsh-web-restart.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$listener = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $oldPid = $listener[0].OwningProcess
  Write-Output "stopping old dsh web (pid $oldPid)"
  Stop-Process -Id $oldPid -Force
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (-not (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue)) { break }
  }
}
Start-Sleep -Seconds 1
New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null
Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList '--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root 'logs\dsh-web.out.log') `
  -RedirectStandardError (Join-Path $root 'logs\dsh-web.err.log')
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  if (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "dsh web restarted OK on 3080"
    exit 0
  }
}
Write-Error 'dsh web failed to come back on 3080'
exit 1
