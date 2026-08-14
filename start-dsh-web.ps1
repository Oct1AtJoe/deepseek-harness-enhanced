# start-dsh-web.ps1 — 后台隐藏启动 `dsh web`，关掉终端不退出。
# 等价于 `pnpm dsh web`（后者即 node --import tsx/esm apps/cli/src/bin.ts web）。
# 日志: logs\dsh-web.out.log / logs\dsh-web.err.log
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File start-dsh-web.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 防重复启动：3080 已在监听则直接退出（端口冲突会让新实例启动即死）
$listener = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Write-Host "dsh web already running (pid $($listener[0].OwningProcess))"; exit 0 }

New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null
Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList '--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root 'logs\dsh-web.out.log') `
  -RedirectStandardError (Join-Path $root 'logs\dsh-web.err.log')
Write-Host 'dsh web started. URL: http://127.0.0.1:3080  Logs: logs\dsh-web.out.log / logs\dsh-web.err.log'
