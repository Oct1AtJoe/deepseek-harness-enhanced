// Desktop pet web renderer for DSH GUI.
// Simplified version that integrates into the existing web GUI.
import { parseCharacters, getCharacter, stateOf, listCharacters } from './character.mjs'
import { pickState, nextBlinkAt, nextFacingAt, shouldWake, wakeFromInteraction, TRANSIENT_MS, WAKE_MS, JOY_MS } from './logic.mjs'

const ASSETS_PATH = '/desktop-pet/assets'
const MANIFEST_URL = `${ASSETS_PATH}/manifest.json`

const CFG_DEFAULTS = {
  enabled: true, size: 110, opacity: 1,
  sleepAfterMs: 60000, pollMs: 3000, bubbleMs: 2500,
}

const TICK_MS = 200
const DRAG_RELEASE_MS = 1500

export function apply(ctx = {}) {
  if (document.querySelector('[data-desktop-pet]') !== null return () => {}

  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const host = document.createElement('div')
  host.setAttribute('data-desktop-pet', '')
  host.style.cssText = `position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
    width: var(--pet-size, 110px); height: var(--pet-size, 110px);
    font-family: system-ui, sans-serif; user-select: none; touch-action: none;
    opacity: var(--pet-opacity, 1);`

  const stage = document.createElement('div')
  stage.className = 'pet-stage'
  const sprite = document.createElement('div')
  sprite.className = 'pet-sprite'
  stage.appendChild(sprite)

  const bubbleLayer = document.createElement('div')
  bubbleLayer.className = 'pet-bubbles'

  const hitarea = document.createElement('div')
  hitarea.className = 'pet-hitarea'
  hitarea.style.cssText = `position: absolute; inset: 0; cursor: grab; touch-action: none; z-index: 3; border-radius: 8px;`

  host.append(stage, bubbleLayer, hitarea)
  document.body.appendChild(host)

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
  let transient = null, transientUntil = 0
  let joyUntil = 0, dragReleaseUntil = 0
  let sleeping = false
  let dragging = false, pressed = false
  let idleSince = 0
  let celebrateUntil = 0
  let activeBubble = null

  function showBubble(text) {
    if (activeBubble) activeBubble.remove()
    const bubble = document.createElement('div')
    bubble.className = 'pet-bubble'
    bubble.textContent = text
    bubble.style.cssText = `position: absolute; left: 50%; bottom: calc(100% + 12px); transform: translateX(-50%);
      background: rgba(24,28,38,.94); color: #E8EBF2; font-size: 11px; padding: 4px 8px; border-radius: 10px;
      white-space: nowrap; pointer-events: none; animation: pet-bubble-in .25s ease-out; z-index: 10;`
    bubbleLayer.appendChild(bubble)
    activeBubble = bubble
    setTimeout(() => { bubble.remove(); activeBubble = null }, cfg.bubbleMs)
  }

  const sheetKey = (sheet) => `${characterId}:${sheet}`
  const sheetUrl = (sheet) => `${ASSETS_PATH}/characters/${characterId}/${sheet}`

  function showSprite(name, anim) {
    const key = sheetKey(anim.sheet)
    const size = sheetSize.get(key)
    if (!size || size.w <= 0 || size.h <= 0) return
    stage.replaceChildren(sprite)
    const frameW = size.w / anim.frames
    const target = host.offsetWidth || 110
    const scale = Math.min(target / frameW, target / size.h, 1)
    sprite.className = 'pet-sprite ready'
    sprite.style.cssText = `position: absolute; left: 50%; top: 50%; display: block;
      background-image: url("${sheetUrl(anim.sheet)}"); background-size: ${size.w}px ${size.h}px;
      width: ${frameW}px; height: ${size.h}px; transform: translate(-50%, -50%) scale(${scale}) scaleX(${flip});`
    applyFrame(frameW, frame)
  }

  function applyFrame(frameW, idx) { sprite.style.backgroundPosition = `-${frameW * idx}px 0` }

  function setState(name) {
    if (name === animState) return
    animState = name; frame = 0; frameDirection = 1; blinkAt = 0; blinkActive = false; facingAt = 0; lastFrameAt = 0
    const c = stateOf(character, name)
    if (c && loaded.has(sheetKey(c.sheet))) showSprite(name, c)
  }

  const loadImageWithRetry = (src, retries = 3) => new Promise((resolve) => {
    let attempts = 0
    const attempt = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => { attempts++; if (attempts < retries) setTimeout(attempt, 250 * attempts); else resolve(null) }; img.src = src }
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
      for (const [n, c] of states) if (n !== 'idle') preload(n, c)
    } catch { if (attempt < 3) setTimeout(() => loadAssets(attempt + 1), 500 * attempt) }
  }

  const tick = () => {
    const now = Date.now()
    if (transient !== null && now >= transientUntil) { const w = transient === 'eat' || transient === 'play'; transient = null; transientUntil = 0; if (w) joyUntil = now + JOY_MS }
    const target = pickState({ activity, dragging, transient, sleeping, joyUntil, dragReleaseUntil, now, celebrateUntil })
    if (shouldWake(animState, target, { dragging, transient })) { transient = 'wake'; transientUntil = now + WAKE_MS; setState(pickState({ activity, dragging, transient, sleeping, joyUntil, dragReleaseUntil, now, celebrateUntil })); return }
    setState(target)
    const c = stateOf(character, animState)
    if (c && loaded.has(sheetKey(c.sheet))) {
      const size = sheetSize.get(sheetKey(c.sheet))
      const frameW = size.w / c.frames
      if (c.frames > 1 && now - lastFrameAt >= 1000 / c.fps) {
        if (c.playback === 'blink') {
          if (blinkActive) { lastFrameAt = now; frame++; if (frame >= c.frames) { frame = 0; blinkActive = false; blinkAt = nextBlinkAt({ now }) } applyFrame(frameW, frame) }
          else { if (frame !== 0) { frame = 0; applyFrame(frameW, frame) } if (blinkAt === 0) blinkAt = nextBlinkAt({ now }); if (now >= blinkAt) blinkActive = true }
          return
        }
        lastFrameAt = now; frame += frameDirection
        if (c.playback === 'pingpong' && c.frames > 1) { if (frame >= c.frames - 1 || frame <= 0) frameDirection *= -1; frame = Math.max(0, Math.min(c.frames - 1, frame)) }
        else if (frame >= c.frames) { if (c.playback === 'loop') frame = 0; else frame = c.frames - 1 }
        applyFrame(frameW, frame)
      }
    }
  }

  hitarea.addEventListener('pointerdown', (e) => { pressed = true })
  hitarea.addEventListener('pointermove', (e) => { if (!pressed || dragging) return; if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) dragging = true; if (dragging) host.style.right = `${parseInt(host.style.right || 16) - e.movementX}px` })
  hitarea.addEventListener('pointerup', () => { pressed = false; if (dragging) { dragging = false; dragReleaseUntil = Date.now() + DRAG_RELEASE_MS } })

  loadAssets()
  const tickInterval = setInterval(tick, TICK_MS)
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInterval(tickInterval); else setInterval(tick, TICK_MS) })

  return () => { clearInterval(tickInterval); host.remove(); style.remove() }
}

const CSS = `
[data-desktop-pet] { transition: opacity .2s; }
[data-desktop-pet] .pet-stage { position: relative; width: var(--pet-size, 110px); height: var(--pet-size, 110px); display: grid; place-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,.25)); pointer-events: none; }
[data-desktop-pet] .pet-sprite.ready { display: block; }
[data-desktop-pet] .pet-bubbles { position: absolute; left: 0; top: 0; width: var(--pet-size, 110px); height: var(--pet-size, 110px); pointer-events: none; overflow: visible; z-index: 10; }
@keyframes pet-bubble-in { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
[data-desktop-pet][data-pet-inert] { opacity: .25; pointer-events: none; }
[data-desktop-pet][data-pet-hidden] { display: none; }
`
