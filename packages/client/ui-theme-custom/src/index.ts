/**
 * Aurora, nebula, and custom tech themes, node half. Injects a boot script
 * that reads the user's localStorage preference and overrides the initial
 * theme before the first paint, so the saved custom theme (e.g. void/jade)
 * is visible from the start with no flash. The browser half (./client)
 * completes the theme registration and handles subsequent switches.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'

/** Self-executing boot script. */
const BOOT_SCRIPT = `(function(){
try {
  var s = typeof localStorage !== 'undefined' && localStorage.getItem('dsh-theme-preference');
  if (s && s !== 'light' && s !== 'dark' && s !== 'system') {
    document.documentElement.style.colorScheme = 'dark';
    document.body.setAttribute('data-ds-dark-theme', '');
  }
} catch(e){}
})()`

/**
 * Inject the boot script after the official ui-theme boot script so it
 * overrides the host-persisted preference when a custom theme was saved.
 * @param ctx - Host context.
 */
export function apply(ctx: Context): void {
  ctx.on('webserver/index-inject', (table: IndexInjection[]) => {
    table.push({ kind: 'script', placement: 'body', text: BOOT_SCRIPT })
  })
}
