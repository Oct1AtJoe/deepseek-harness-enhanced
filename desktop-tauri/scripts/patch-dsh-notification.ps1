# Patch dsh-notification plugin for the Tauri desktop shell (idempotent).
# Why: dsh-notification uses the Web Notification API, which cannot get
# permission inside the Tauri WebView2. This patch routes notifications
# through window.__dshNotifyBridge (injected by the shell) to system toasts.
# NOTE: `dsh plugin add/update` reinstalls the plugin and wipes this patch;
# re-run this script after any reinstall.
$target = Join-Path $env:USERPROFILE '.dsh\profiles\web\node_modules\dsh-notification\lib\client.js'
if (-not (Test-Path $target)) {
    Write-Error "Plugin bundle not found: $target"
    exit 1
}
$text = [System.IO.File]::ReadAllText($target)

$apiOld = 'function notificationsApi() {
  return typeof Notification === "undefined" ? void 0 : Notification;
}'
$apiNew = @'
function notificationsApi() {
  if (window.__dshNotifyBridge) {
    return { permission: "granted", requestPermission: () => Promise.resolve("granted") };
  }
  return typeof Notification === "undefined" ? void 0 : Notification;
}
'@

$showOld = @'
  const show = (title, body, tag, requireInteraction) => {
    const api = notificationsApi();
    if (api === void 0 || api.permission !== "granted") return;
    const notification = new api(title, { body, tag, requireInteraction });
    notification.onclick = () => {
      window.focus();
    };
  };
'@
$showNew = @'
  const show = (title, body, tag, requireInteraction) => {
    const bridge = window.__dshNotifyBridge;
    if (bridge !== void 0 && bridge.fire) {
      try {
        bridge.fire({ type: "dsh-notification", title, body, tag, requireInteraction, force: true });
        return;
      } catch (e) {
        console.error("[dsh-notification] bridge fire failed, falling back to Web Notification", e);
      }
    }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notification = new Notification(title, { body, tag, requireInteraction });
    notification.onclick = () => {
      window.focus();
    };
  };
'@

$titleOld1 = '            t(titleKey(plan.reason)),'
$titleNew1 = '            summary.displayTitle || summary.title || t(titleKey(plan.reason)),'
$titleOld2 = '            t(pendingTitleKey(plan.kind)),'
$titleNew2 = '            summary.displayTitle || summary.title || t(pendingTitleKey(plan.kind)),'

$changes = 0
if ($text.Contains($apiOld)) { $text = $text.Replace($apiOld, $apiNew); $changes++ }
if ($text.Contains($showOld)) { $text = $text.Replace($showOld, $showNew); $changes++ }
if ($text.Contains($titleOld1)) { $text = $text.Replace($titleOld1, $titleNew1); $changes++ }
if ($text.Contains($titleOld2)) { $text = $text.Replace($titleOld2, $titleNew2); $changes++ }

if ($changes -eq 0) {
    Write-Host 'Patch already applied or up to date; nothing to do.'
} else {
    [System.IO.File]::WriteAllText($target, $text)
    Write-Host "Applied $changes patch(es) to $target"
    Write-Host 'Restart dsh web and the desktop shell for it to take effect.'
}
