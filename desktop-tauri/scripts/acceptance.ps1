# dsh-desktop-tauri 验收脚本（Windows）：A/B/C 三路径。
# 前置：退出所有 dsh-desktop 实例（单实例锁会把验收进程静默转交并立即退出，
#       造成假通过）；A 路径要求 127.0.0.1:3080 已有 dsh 服务在跑。
param(
  [string]$Exe = "$PSScriptRoot\..\src-tauri\target\debug\dsh-desktop.exe",
  [string]$Repo = "E:\vibeCoding\deepseek-harness"
)

$ErrorActionPreference = 'Stop'

function Run-Accept([string]$name, [hashtable]$extra, [string]$expect, [int]$quitSecs = 8) {
  $log = Join-Path $env:TEMP "dsh-desktop-accept-$([guid]::NewGuid()).log"
  $env:DSH_DESKTOP_AUTO_QUIT = [string]$quitSecs
  foreach ($k in $extra.Keys) { Set-Item "Env:$k" $extra[$k] }
  # WebView2 退出时会在 stderr 打无害的 Chromium 噪音（Error 1412），
  # PS 5.1 在 EAP=Stop 下会把原生 stderr 当终止异常，故调用期间降级
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Exe *> $log
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldEap
    Remove-Item Env:DSH_DESKTOP_AUTO_QUIT -ErrorAction SilentlyContinue
    foreach ($k in $extra.Keys) { Remove-Item "Env:$k" -ErrorAction SilentlyContinue }
  }
  $content = [IO.File]::ReadAllText($log, [Text.Encoding]::UTF8)
  if ($code -ne 0) { throw "$name 退出码 $code (期望 0)`n$content" }
  if ($content -notmatch $expect) { throw "$name 日志缺少期望输出 [$expect]`n$content" }
  "PASS $name : $expect"
}

Push-Location $Repo
try {
  # A 复用：3080 已有服务（当前 dsh web），直接挂载，退出不杀
  Run-Accept 'A-reuse' @{} '已有服务在监听，直接复用'

  # B 拉起+回收：3081 空闲，按 DSH_DESKTOP_BACKEND 拉起 repo dev CLI，退出回收子进程
  $backend = '["node","--import","tsx/esm","apps/cli/src/bin.ts"]'
  $isolated = Join-Path $env:TEMP 'dsh-accept-home'
  Run-Accept 'B-spawn' @{ DSH_DESKTOP_PORT = '3081'; DSH_DESKTOP_BACKEND = $backend; DSH_HOME = $isolated } '正在停止 dsh 子进程' 25

  # C 受限 PATH（模拟资源管理器双击）：PATH 只剩系统目录，BACKEND 覆盖（node 绝对路径）仍应拉起并导航
  $sys = "$env:SystemRoot\system32;$env:SystemRoot"
  $nodeAbs = (Get-Command node).Source
  $nodeJson = $nodeAbs.Replace('\','\\')
  $backendAbs = "[`"$nodeJson`",`"--import`",`"tsx/esm`",`"apps/cli/src/bin.ts`"]"
  Run-Accept 'C-restricted-path' @{ PATH = $sys; DSH_DESKTOP_PORT = '3082'; DSH_DESKTOP_BACKEND = $backendAbs; DSH_HOME = $isolated } '已导航到 http://127.0.0.1:3082' 25
} finally {
  Pop-Location
}
"ALL ACCEPTANCE PASSED"
