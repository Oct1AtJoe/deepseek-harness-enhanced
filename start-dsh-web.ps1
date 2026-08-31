# start-dsh-web.ps1 - 启动 dsh web (port 3080)，后台运行并等待就绪
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File start-dsh-web.ps1
# 注意: 与 stop-dsh-web.ps1 同风格，netstat 而非 Get-NetTCPConnection（DSH 沙盒下 WMI/CIM 被隔离）。
$ErrorActionPreference = 'Stop'

$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\web'
$logDir = Join-Path $env:USERPROFILE '.dsh\logs'
$logFile = Join-Path $logDir 'dsh-web.log'

# 已在运行则直接退出（避免 EADDRINUSE）
$already = netstat -ano | Select-String ':3080.*LISTENING'
if ($already) {
    Write-Host 'dsh web already running on http://127.0.0.1:3080'
    exit 0
}

# 用 repo 源码版后端（与桌面 exe 的 DSH_DESKTOP_BACKEND 同款命令），全局 dsh CLI 已卸载
$repo = 'E:\vibeCoding\deepseek-harness'
$node = 'C:\Users\Administrator\.local\bin\nodejs24\node.exe'
$backend = Join-Path $repo 'apps\cli\src\bin.ts'
if (-not (Test-Path $backend)) { Write-Host "backend not found: $backend"; exit 1 }
if (-not (Test-Path $profileDir)) { Write-Host "profile not found: $profileDir"; exit 1 }
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "Starting dsh web from repo source ($repo) ..."
$proc = Start-Process -FilePath $node -ArgumentList '--import', 'file:///E:/vibeCoding/deepseek-harness/node_modules/tsx/dist/esm/index.mjs', "`"$backend`"", 'web', '--host', '127.0.0.1', '--port', '3080' `
    -WorkingDirectory $repo -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err" `
    -WindowStyle Hidden -PassThru

# 轮询直到就绪（最多 30s）
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if ($proc.HasExited) { break }
    try {
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/' -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}

if ($ready) {
    Write-Host "dsh web ready: http://127.0.0.1:3080 (log: $logFile)"
    Start-Process 'http://127.0.0.1:3080'
    exit 0
}

Write-Host "dsh web failed to start (log: $logFile)"
if (Test-Path $logFile) { Get-Content $logFile -Tail 20 }
exit 1