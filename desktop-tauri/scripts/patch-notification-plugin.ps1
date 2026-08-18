# Re-apply the local patch for dsh-notification: notification body uses the
# session title instead of the model reply text. Reinstalling the plugin
# (dsh plugin --profile web add ...) restores node_modules, so run this script
# again after a reinstall.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\patch-notification-plugin.ps1
$ErrorActionPreference = 'Stop'
$file = Join-Path $env:USERPROFILE '.dsh\profiles\web\node_modules\dsh-notification\lib\client.js'
if (-not (Test-Path $file)) { Write-Error "plugin bundle not found: $file"; exit 1 }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$text = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8)
$old = 'body: projection?.body ?? title ?? "",'
$new = 'body: title ?? "",'
if ($text.Contains($new)) { Write-Host 'already patched, nothing to do'; exit 0 }
if (-not $text.Contains($old)) { Write-Error 'original definition not found, source may have changed'; exit 1 }
$text = $text.Replace($old, $new)
[IO.File]::WriteAllText($file, $text, $utf8)
Write-Host "patch applied: $file"