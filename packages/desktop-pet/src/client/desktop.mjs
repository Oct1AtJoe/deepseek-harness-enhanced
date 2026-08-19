// Desktop pet renderer for Tauri2 shell.
// Renders pet on transparent window, shows notification bubbles, handles click-to-switch.
import { parseCharacters, getCharacter, stateOf, listCharacters } from './character.mjs'
import { pickState, nextBlinkAt, nextFacingAt, shouldWake, wakeFromInteraction, nextWorkingRhythm, deriveSessionMood, detectTurnCompleted, TRANSIENT_MS, WAKE_MS, JOY_MS } from './logic.mjs'

const ASSETS_PATH = '/desktop-pet/assets'
const MANIFEST_URL = `${ASSETS_PATH}/manifest.json`

const CFG_DEFAULTS = {
  enabled: true, size: 200, opacity: 1,
  walk: { enabled: true, minWaitMs: 18000, maxWaitMs: 40000, minMs: 3000, maxMs: 6000, speedPxPerSec: 45 },
  sleepAfterMs: 60000, pollMs: 3000, bubbleMs: 5000,
}

const TICK_MS = 200
const DRAG_RELEASE_MS = 1500

export function apply(ctx = {}) {
  if (document.querySelector('[data-desktop-pet]') !== null) {
    console.warn('[desktop-pet] already mounted')
    return () => {}
  }

  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const host = document.createElement('div')
  host.setAttribute('data-desktop-pet', '')
  host.style.cssText = `position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    width: var(--pet-size, 200px); height: var(--pet-size, 200px);
    font-family: system-ui, sans-serif; user-select: none; touch-action: none;
    opacity: var(--pet-opacity, 1);`

  const stage = document.createElement('div')
  stage.className = 'pet-stage'
  const sprite = document.createElement('div')
  sprite.className = 'pet-sprite'
  stage.appendChild(sprite)

  // Notification bubble layer
  const bubbleLayer = document.createElement('div')
  bubbleLayer.className = 'pet-bubbles'

  // Click area
  const hitarea = document.createElement('div')
  hitarea.className = 'pet-hitarea'
  hitarea.style.cssText = `position: absolute; inset: 0; cursor: grab; touch-action: none; z-index: 3; border-radius: 8px;`

  host.append(stage, bubbleLayer, hitarea)
  document.body.appendChild(host)

  // Runtime state
  let pet = null
  let activity = { name: 'idle', until: 0 }
  let manifest = { states: {} }
  let character = { id: 'whale-girl', states: {} }
  let characterId = 'whale-girl'
  let cfg = { ...CFG_DEFAULTS }
  const loaded = new Set()
  const sheetSize = new Map()
  let animState = null
  let frame = 0
  let frameDirection = 1
  let blinkAt = 0, blinkActive = false
  let facingAt = 0, flip = 1
  let lastFrameAt = 0
  let working = { active: false, until: 0 }
  let sessionMood = { thinking: false, waiting: false, titles: [] }
  let transient = null, transientUntil = 0
  let joyUntil = 0, dragReleaseUntil = 0
  let sleeping = false
  let dragging = false, pressed = false, moved = false
  let idleSince = 0
  let celebrateUntil = 0
  let walking = false, walkDir = 1
  let wanderTimer = null, walkRaf = null
  let prevRunning = new Map()
  let activeBubble = null
  let bubbleQueue = []

  // --- Bubble notification ---
  const EVENT_MESSAGES = {
    celebrate: () => ['🎉 任务完成！', '🌟 升级了！', '🏆 获得新称号！'],
    error: () => ['😢 任务失败了', '⚠️ 出错了'],
    welcome: () => ['👋 新会话开始', '💬 新的对话'],
    session: () => ['💬 会话更新'],
    failure: () => ['😢 任务失败'],
    levelUp: () => ['🌟 升级了！'],
  }

  function showBubble(text, sessionId) {
    // Clear existing bubble
    if (activeBubble) { activeBubble.remove(); activeBubble = null }

    const bubble = document.createElement('div')
    bubble.className = 'pet-bubble'
    bubble.textContent = text
    if (sessionId) bubble.dataset.sessionId = sessionId
    bubble.style.cssText = `
      position: absolute; left: 50%; bottom: calc(100% + 12px);
      transform: translateX(-50%);
      background: rgba(24, 28, 38, .94); color: #E8EBF2;
      font-size: 12px; padding: 8px 12px; border-radius: 10px;
      white-space: nowrap; cursor: pointer; pointer-events: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,.3); z-index: 10;
      animation: pet-bubble-in .25s ease-out;
    `
    bubble.addEventListener('click', () => {
      handleBubbleClick(sessionId)
      bubble.remove()
      activeBubble = null
      showNextBubble()
    })
    bubbleLayer.appendChild(bubble)
    activeBubble = bubble

    // Auto-dismiss
    setTimeout(() => {
      if (activeBubble === bubble) {
        bubble.style.animation = 'pet-bubble-out .2s ease-in forwards'
        setTimeout(() => { bubble.remove(); activeBubble = null; showNextBubble() }, 200)
      }
    }, cfg.bubbleMs)
  }

  function showNextBubble() {
    if (bubbleQueue.length > 0) {
      const next = bubbleQueue.shift()
      showBubble(next.text, next.sessionId)
    }
  }

  function handleBubbleClick(sessionId) {
    // Bring DSH window to foreground + switch to conversation
    if (sessionId) {
      // Use Tauri IPC if available, otherwise postMessage to parent
      if (window.__TAURI_INTERNALS__) {
        // Tauri v2 IPC
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('switch_session', { sessionId }).catch(() => {
            // Fallback: try to find DSH window and focus it
            window.parent?.postMessage({ type: 'switch-session', sessionId }, '*')
          })
        }).catch(() => {
          window.parent?.postMessage({ type: 'switch-session', sessionId }, '*')
        })
      } else {
        // Web context: try to navigate parent window
        window.parent?.postMessage({ type: 'switch-session', sessionId }, '*')
      }
    } else {
      // No session ID — just bring window to front
      if (window.__TAURI_INTERNALS__) {
        import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
          getCurrentWindow().show()
          getCurrentWindow().setFocus()
        }).catch(() => {})
      }
    }
  }

  function notify(eventType, payload = {}) {
    const msgs = EVENT_MESSAGES[eventType]
    if (!msgs) return
    const text = msgs[0]
    const sessionId = payload.sessionId || payload.id || null
    if (activeBubble) {
      bubbleQueue.push({ text, sessionId })
    } else {
      showBubble(text, sessionId)
    }
  }

  // --- SSE Event handling ---
  function connectSSE() {
    const eventsUrl = `${window.location.origin}/desktop-pet/events`
    const es = new EventSource(eventsUrl)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        handleEvent(data)
      } catch {}
    }
    es.onerror = () => {
      es.close()
      setTimeout(connectSSE, 3000)
    }
    return es
  }

  function handleEvent(data) {
    switch (data.type) {
      case 'celebrate':
        notify('celebrate', data)
        celebrateUntil = Math.max(celebrateUntil, Date.now() + 6000)
        break
      case 'error':
        notify('error', data)
        break
      case 'welcome':
        notify('welcome', data)
        break
      case 'session':
        notify('session', data)
        break
      case 'failure':
        notify('failure', data)
        break
      case 'levelUp':
        notify('levelUp', data)
        break
      case 'task-done':
        notify('celebrate', data)
        celebrateUntil = Math.max(celebrateUntil, Date.now() + 6000)
        break
      case 'task-failed':
        notify('error', data)
        break
    }
  }

  // --- Asset loading ---
  const sheetKey = (sheet) => `${characterId}:${sheet}`
  const sheetUrl = (sheet) => `${ASSETS_PATH}/characters/${characterId}/${sheet}`

  function showSprite(name, anim) {
    const key = sheetKey(anim.sheet)
    const size = sheetSize.get(key)
    if (!size || size.w <= 0 || size.h <= 0) return
    stage.replaceChildren(sprite)
    const frameW = size.w / anim.frames
    const target = host.offsetWidth || 200
    const scale = Math.min(target / frameW, target / size.h, 1)
    sprite.className = 'pet-sprite ready'
    sprite.style.cssText = `
      position: absolute; left: 50%; top: 50%; display: block;
      background-image: url("${sheetUrl(anim.sheet)}");
      background-size: ${size.w}px ${size.h}px;
      width: ${frameW}px; height: ${size.h}px;
      transform: translate(-50%, -50%) scale(${scale}) scaleX(${flip});
    `
    applyFrame(frameW, frame)
  }

  function applyFrame(frameW, idx) {
    sprite.style.backgroundPosition = `-${frameW * idx}px 0`
  }

  function setState(name) {
    if (name === animState) return
    animState = name
    frame = 0; frameDirection = 1
    blinkAt = 0; blinkActive = false
    facingAt = 0; lastFrameAt = 0
    const cfg = stateOf(character, name)
    if (cfg && loaded.has(sheetKey(cfg.sheet))) {
      showSprite(name, cfg)
    }
  }

  const loadImageWithRetry = (src, retries = 3) => new Promise((resolve) => {
    let attempts = 0
    const attempt = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => { attempts++; if (attempts < retries) setTimeout(attempt, 250 * attempts); else resolve(null) }
      img.src = src
    }
    attempt()
  })

  const preload = (name, cfg) => loadImageWithRetry(sheetUrl(cfg.sheet)).then((img) => {
    if (!img) return
    sheetSize.set(sheetKey(cfg.sheet), { w: img.naturalWidth, h: img.naturalHeight })
    loaded.add(sheetKey(cfg.sheet))
  })

  const loadAssets = async (attempt = 1) => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) throw new Error(`manifest ${res.status}`)
      const next = await res.json()
      if (next === null || typeof next !== 'object') return
      manifest = next
      const pref = (() => { try { return localStorage.getItem('desktop-pet:character') ?? null } catch { return null } })()
      const roles = parseCharacters(manifest)
      const nextId = pref !== null && pref in roles.characters ? pref : roles.defaultId
      characterId = nextId
      character = getCharacter(manifest, nextId) ?? { id: nextId, states: {} }
      const stageSize = character.meta?.stageSize
      if (typeof stageSize === 'number') host.style.setProperty('--pet-size', `${stageSize}px`)
      const states = Object.entries(character.states)
      const idleEntry = states.find(([n]) => n === 'idle')
      if (idleEntry) await preload(idleEntry[0], idleEntry[1])
      for (const [n, cfg] of states) if (n !== 'idle') preload(n, cfg)
    } catch {
      if (attempt < 3) setTimeout(() => loadAssets(attempt + 1), 500 * attempt)
    }
  }

  // --- Main loop ---
  const tick = () => {
    const now = Date.now()
    if (transient !== null && now >= transientUntil) {
      const wasFun = transient === 'eat' || transient === 'play'
      transient = null; transientUntil = 0
      if (wasFun) joyUntil = now + JOY_MS
    }
    const target = pickState({ activity, dragging, walking, transient, sleeping, joyUntil, dragReleaseUntil, now, sessionThink: sessionMood.thinking, sessionWait: sessionMood.waiting, workingActive: working.active, celebrateUntil })
    if (shouldWake(animState, target, { dragging, transient })) {
      transient = 'wake'; transientUntil = now + WAKE_MS
      setState(pickState({ activity, dragging, walking, transient, sleeping, joyUntil, dragReleaseUntil, now, sessionThink: sessionMood.thinking, sessionWait: sessionMood.waiting, workingActive: working.active, celebrateUntil }))
      return
    }
    setState(target)
    const cfg = stateOf(character, animState)
    if (cfg && loaded.has(sheetKey(cfg.sheet))) {
      const size = sheetSize.get(sheetKey(cfg.sheet))
      const frameW = size.w / cfg.frames
      if (cfg.frames > 1 && now - lastFrameAt >= 1000 / cfg.fps) {
        if (cfg.playback === 'blink') {
          if (blinkActive) { lastFrameAt = now; frame += 1; if (frame >= cfg.frames) { frame = 0; blinkActive = false; blinkAt = nextBlinkAt({ now }) } applyFrame(frameW, frame) }
          else { if (frame !== 0) { frame = 0; applyFrame(frameW, frame) } if (blinkAt === 0) blinkAt = nextBlinkAt({ now }); if (now >= blinkAt) blinkActive = true }
          return
        }
        lastFrameAt = now; frame += frameDirection
        if (cfg.playback === 'pingpong' && cfg.frames > 1) { if (frame >= cfg.frames - 1 || frame <= 0) frameDirection *= -1; frame = Math.max(0, Math.min(cfg.frames - 1, frame)) }
        else if (frame >= cfg.frames) { if (cfg.playback === 'loop') frame = 0; else frame = cfg.frames - 1 }
        applyFrame(frameW, frame)
      }
    }
  }

  // --- Drag handling ---
  hitarea.addEventListener('pointerdown', (e) => { pressed = true; moved = false })
  hitarea.addEventListener('pointermove', (e) => {
    if (!pressed) return
    if (!dragging && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) { dragging = true; moved = true }
    if (dragging) host.style.right = `${parseInt(host.style.right || 16) - e.movementX}px`
  })
  hitarea.addEventListener('pointerup', () => { pressed = false; if (dragging) { dragging = false; dragReleaseUntil = Date.now() + DRAG_RELEASE_MS } })

  // --- Feed / play ---
  function interact(action) {
    transient = action === 'feed' ? 'eat' : 'play'
    transientUntil = Date.now() + TRANSIENT_MS
  }

  // --- Init ---
  loadAssets()
  const tickInterval = setInterval(tick, TICK_MS)
  const sse = connectSSE()

  // Visibility pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(tickInterval)
    else setInterval(tick, TICK_MS)
  })

  return () => {
    clearInterval(tickInterval)
    sse.close()
    host.remove()
    style.remove()
  }
}

const CSS = `
[data-desktop-pet] { transition: opacity .2s; }
[data-desktop-pet] .pet-stage { position: relative; width: var(--pet-size, 200px); height: var(--pet-size, 200px); display: grid; place-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,.25)); pointer-events: none; }
[data-desktop-pet] .pet-sprite.ready { display: block; }
[data-desktop-pet] .pet-bubbles { position: absolute; left: 0; top: 0; width: var(--pet-size, 200px); height: var(--pet-size, 200px); pointer-events: none; overflow: visible; z-index: 10; }
@keyframes pet-bubble-in { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
@keyframes pet-bubble-out { to { opacity: 0; transform: translateX(-50%) translateY(-4px); } }
[data-desktop-pet][data-pet-inert] { opacity: .25; pointer-events: none; }
[data-desktop-pet][data-pet-hidden] { display: none; }
`
