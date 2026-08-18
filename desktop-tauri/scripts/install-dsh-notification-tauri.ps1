<#
.SYNOPSIS
    Install the Tauri-patched dsh-notification plugin from the local tarball.
.DESCRIPTION
    dsh plugin update rebuilds node_modules, wiping any manual patches.
    Installing from this tarball puts the Tauri bridge + session-title patches
    into a pinned version (0.1.2-tauri.1) that dsh plugin update will not touch.
.EXAMPLE
    powershell -File scripts\install-dsh-notification-tauri.ps1
#>
$tarball = Join-Path $PSScriptRoot '..\dsh-notification-tauri.tar.gz'
if (-not (Test-Path $tarball)) {
    Write-Error "Tarball not found: $tarball"
    exit 1
}
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dsh) {
    Write-Error "dsh CLI not found in PATH."
    exit 1
}
Write-Host "Installing Tauri-patched dsh-notification from $tarball ..."
& dsh plugin --profile web add $tarball
Write-Host 'Done. Restart dsh web and the desktop shell for it to take effect.'
