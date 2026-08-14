/**
 * dsh-desktop — the DeepSeek Harness Web GUI in an Electron window.
 *
 * Backend resolution, in order:
 *   1. `DSH_DESKTOP_URL` — load that exact URL; nothing is spawned.
 *   2. The default port (`DSH_DESKTOP_PORT`, default 3080) already serving a
 *      dsh GUI — attach to the running server.
 *   3. Otherwise spawn the backend (`dsh web --port 0`, so the OS picks a
 *      free port), parse the `dsh web: http://...` URL line it prints, and
 *      load that URL. The spawned backend is killed when the app quits.
 *
 * The renderer is a plain web page: `nodeIntegration` off, `contextIsolation`
 * on, sandboxed, no preload. External http(s) links open in the system
 * browser.
 *
 * `--smoke` runs headless: the window is never shown and the app quits with
 * exit code 0 once the page finishes loading (or 1 on any failure), printing
 * `DSH_DESKTOP_SMOKE_OK` / `DSH_DESKTOP_SMOKE_FAIL: <reason>`.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'

const DEFAULT_PORT = Number(process.env.DSH_DESKTOP_PORT ?? 3080)
const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const SMOKE = process.argv.includes('--smoke')
const URL_LINE = /dsh web: (https?:\/\/[^\s]+)/
const BACKEND_START_TIMEOUT_MS = 120_000

/** The spawned backend process while it is owned by this app; null once released. */
let backend = null
let mainWindow = null
let failed = false

function log(...parts) {
  console.log('[dsh-desktop]', ...parts)
}

/** Report a fatal failure once: an error box in a real session, a machine-readable line in smoke. */
function fatal(message) {
  if (failed) return
  failed = true
  if (SMOKE) {
    console.error(`DSH_DESKTOP_SMOKE_FAIL: ${message}`)
    killBackend()
    app.exit(1)
  } else {
    dialog.showErrorBox('DeepSeek Harness', message)
    app.quit()
  }
}

/** Whether a URL serves the dsh GUI (index.html carries the injected boot graph). */
async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return (await response.text()).includes('__DSH_BOOT__')
  } catch {
    return false
  }
}

/** Parse `DSH_DESKTOP_BACKEND`: a JSON array of argv, else whitespace-split. */
function parseCommand(value) {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return { command: parsed[0], args: parsed.slice(1).map(String) }
    }
  } catch {
    // fall through to whitespace splitting
  }
  const [command, ...args] = value.trim().split(/\s+/)
  return { command, args }
}

/**
 * Start the dsh web backend. From a source checkout the repo CLI runs on
 * Electron's own Node (`ELECTRON_RUN_AS_NODE`); a packaged build expects a
 * `dsh` CLI on PATH unless `DSH_DESKTOP_BACKEND` names one.
 * @returns the process handle; `backend` owns it until killed.
 */
function spawnBackend() {
  const override = process.env.DSH_DESKTOP_BACKEND
  let command
  let args
  let env
  if (override !== undefined) {
    ({ command, args } = parseCommand(override))
    env = process.env
  } else if (app.isPackaged) {
    command = 'dsh'
    args = []
    env = process.env
  } else {
    command = process.execPath
    args = ['--import', 'tsx/esm', path.join(REPO_ROOT, 'apps', 'cli', 'src', 'bin.ts')]
    env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  }
  const proc = spawn(command, [...args, 'web', '--port', '0'], {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Only the PATH-resolved packaged `dsh` (a .cmd on Windows) needs a shell.
    shell: process.platform === 'win32' && app.isPackaged && override === undefined,
  })
  const handle = { proc }
  backend = handle
  proc.stdout.on('data', chunk => process.stdout.write(chunk))
  proc.stderr.on('data', chunk => process.stderr.write(chunk))
  proc.on('error', error => {
    if (backend === handle) backend = null
    fatal(`failed to launch the dsh web backend: ${error.message}`)
  })
  proc.on('exit', (code, signal) => {
    if (backend !== handle) return // released by killBackend while quitting — not a failure
    backend = null
    fatal(`the dsh web backend exited unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'})`)
  })
  return handle
}

/** Resolve the URL line the backend prints once its web server is up. */
function waitForBackendUrl(handle, timeoutMs) {
  return new Promise(resolve => {
    let buffer = ''
    const timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)
    const onData = chunk => {
      buffer += chunk.toString()
      if (buffer.length > 512 * 1024) buffer = buffer.slice(-128 * 1024)
      const match = buffer.match(URL_LINE)
      if (match) {
        cleanup()
        resolve(match[1])
      }
    }
    const onExit = () => {
      cleanup()
      resolve(null)
    }
    const onError = () => {
      cleanup()
      resolve(null)
    }
    function cleanup() {
      clearTimeout(timer)
      handle.proc.stdout.off('data', onData)
      handle.proc.off('exit', onExit)
      handle.proc.off('error', onError)
    }
    handle.proc.stdout.on('data', onData)
    handle.proc.on('exit', onExit)
    handle.proc.on('error', onError)
  })
}

/** Kill the spawned backend, tree-wide on Windows (dsh web may own children). */
function killBackend() {
  const handle = backend
  backend = null
  if (handle === null) return
  try {
    handle.proc.kill()
  } catch {
    // already gone
  }
  if (process.platform === 'win32' && handle.proc.pid !== undefined) {
    spawn('taskkill', ['/pid', String(handle.proc.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

function installMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(url) {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#101418',
    title: 'DeepSeek Harness',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window
  window.once('ready-to-show', () => {
    if (!SMOKE) window.show()
  })
  window.webContents.on('did-finish-load', () => {
    if (SMOKE) {
      log('smoke: page loaded')
      app.quit()
    }
  })
  window.webContents.on('did-fail-load', (_event, code, description) => {
    fatal(`the web UI failed to load (${code}: ${description})`)
  })
  // New windows (target=_blank) and out-of-app navigation go to the browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) void shell.openExternal(target)
    return { action: 'deny' }
  })
  const appOrigin = new URL(url).origin
  window.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith('http://') && !target.startsWith('https://')) return
    if (new URL(target).origin !== appOrigin) {
      event.preventDefault()
      void shell.openExternal(target)
    }
  })
  window.on('closed', () => {
    mainWindow = null
  })
  void window.loadURL(url)
}

async function main() {
  installMenu()
  const explicit = process.env.DSH_DESKTOP_URL
  if (explicit !== undefined) {
    log(`loading ${explicit} (DSH_DESKTOP_URL)`)
    createWindow(explicit)
    return
  }
  const defaultUrl = `http://127.0.0.1:${DEFAULT_PORT}`
  if (await probe(defaultUrl)) {
    log(`attaching to the running dsh server at ${defaultUrl}`)
    createWindow(defaultUrl)
    return
  }
  log('no dsh server found; starting the backend')
  const handle = spawnBackend()
  const url = await waitForBackendUrl(handle, BACKEND_START_TIMEOUT_MS)
  if (url === null) {
    fatal(`the dsh web backend did not print a URL within ${Math.round(BACKEND_START_TIMEOUT_MS / 1000)}s`)
    return
  }
  log(`backend ready at ${url}`)
  createWindow(url)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', killBackend)
  void app.whenReady().then(main)
}
