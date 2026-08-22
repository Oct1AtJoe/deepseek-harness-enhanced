/**
 * Node navigation rail for the conversation view: vertical dash strip on the
 * right edge, hover preview panel, click-to-jump with highlight line.
 *
 * Portaled to document.body, positioned beside the conversation scroll area.
 * All CSS class names use the dsnv- prefix (dsnv = deepseek node view) to
 * avoid collisions with the host page.
 */
import React from 'react'
import { createPortal } from 'react-dom'
import type { ConversationSnapshot, UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'

/** Props: the session-snapshot selector plus the projection read seat (composer dock kit). */
export interface NavRailProps {
  sessionId?: string | undefined
  useSession: SnapshotSelectorHook<ConversationSnapshot>
  useProjection: UseProjection
}

// ── CSS (inline injection, unchanged from v0.2.0 of dsh-plugin-msg-nav) ────
const CSS = [
  '.dsnv-rail{position:fixed;z-index:50;width:34px;pointer-events:none;opacity:0;overflow:hidden;transition:opacity .18s ease-out}',
  '.dsnv-rail.dsnv-on{opacity:1;pointer-events:auto}',
  '.dsnv-list{position:absolute;top:3px;left:0;width:34px;will-change:transform;transition:transform .12s ease-out,opacity .15s ease-out}',
  '.dsnv-rail.dsnv-pop .dsnv-list{opacity:0;pointer-events:none}',
  '.dsnv-dot{position:absolute;left:50%;width:14px;height:3px;margin-left:-7px;border:0;padding:0;border-radius:2px;background:rgba(15,17,21,.28);cursor:pointer;transition:background-color .15s,transform .15s}',
  '.dsnv-dot:hover{background:rgba(15,17,21,.52);transform:scale(2)}',
  '.dsnv-dot:focus-visible{background:rgba(15,17,21,.52);transform:scale(2)}',
  'body[data-ds-dark-theme] .dsnv-dot{background:rgba(255,255,255,.45)}',
  'body[data-ds-dark-theme] .dsnv-dot:hover{background:rgba(255,255,255,.75)}',
  'body[data-ds-dark-theme] .dsnv-dot:focus-visible{background:rgba(255,255,255,.75)}',
  '.dsnv-dot.dsnv-on{background:var(--dsw-static-deepseek-500, #4176E6)}',
  'body[data-ds-dark-theme] .dsnv-dot.dsnv-on{background:#fff}',
  '.dsnv-panel{position:fixed;z-index:51;box-sizing:border-box;width:272px;overflow:hidden;background:var(--dsw-specific-menu, var(--dsw-alias-bg-overlay, #2C2C2E));border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));border-radius:16px;box-shadow:var(--dsw-shadow-lv3, 0 0 1px 0 rgba(0,0,0,.2), 0 12px 32px 0 rgba(0,0,0,.08));transform-origin:right center;animation:dsnv-panel-in .18s ease-out}',
  '@keyframes dsnv-panel-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}',
  '.dsnv-panel-scroll{position:relative;transition:transform .12s ease-out}',
  '.dsnv-panel-row{position:absolute;left:0;right:0;height:24px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 10px 0 18px;border:0;border-radius:8px;background:transparent;cursor:pointer;font-size:13px;line-height:24px;color:var(--dsw-alias-label-secondary, rgba(255,255,255,.72));white-space:nowrap}',
  '.dsnv-panel-row:hover{color:var(--dsw-alias-label-primary, #ECECF1);background:var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05))}',
  '.dsnv-panel-text{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dsnv-panel-dash{flex:none;width:14px;height:3px;border-radius:2px;background:rgba(15,17,21,.28)}',
  'body[data-ds-dark-theme] .dsnv-panel-dash{background:rgba(255,255,255,.45)}',
  '.dsnv-panel-row:hover .dsnv-panel-dash{background:rgba(15,17,21,.52)}',
  'body[data-ds-dark-theme] .dsnv-panel-row:hover .dsnv-panel-dash{background:rgba(255,255,255,.75)}',
  '.dsnv-panel-row.dsnv-panel-on{color:var(--dsw-static-deepseek-500, #4176E6)}',
  'body[data-ds-dark-theme] .dsnv-panel-row.dsnv-panel-on{color:#fff}',
  '.dsnv-panel-row.dsnv-panel-on .dsnv-panel-dash{background:var(--dsw-static-deepseek-500, #4176E6)}',
  'body[data-ds-dark-theme] .dsnv-panel-row.dsnv-panel-on .dsnv-panel-dash{background:#fff}',
  '.dsnv-highlight{position:relative}',
  '.dsnv-highlight::after{content:"";position:absolute;left:0;right:0;top:-9px;height:2px;border-radius:1px;background:var(--dsw-alias-state-business-primary, #4176E6);animation:dsnv-line 1.4s ease-out forwards}',
  '@keyframes dsnv-line{0%{opacity:0;transform:scaleX(.5)}25%{opacity:1;transform:scaleX(1)}70%{opacity:1}100%{opacity:0}}',
  '.dsnv-dot.dsnv-pending{cursor:default;background:var(--dsw-static-deepseek-500, #4176E6);animation:dsnv-pulse 1.2s ease-in-out infinite}',
  '.dsnv-dot.dsnv-pending:hover{transform:none;background:var(--dsw-static-deepseek-500, #4176E6)}',
  'body[data-ds-dark-theme] .dsnv-dot.dsnv-pending{background:#fff}',
  'body[data-ds-dark-theme] .dsnv-dot.dsnv-pending:hover{background:#fff}',
  '.dsnv-panel-row.dsnv-panel-loading{cursor:default;color:var(--dsw-alias-label-secondary, rgba(255,255,255,.55))}',
  '.dsnv-panel-row.dsnv-panel-loading:hover{color:var(--dsw-alias-label-secondary, rgba(255,255,255,.55));background:transparent}',
  '.dsnv-panel-row.dsnv-panel-loading .dsnv-panel-dash{background:var(--dsw-static-deepseek-500, #4176E6);animation:dsnv-pulse 1.2s ease-in-out infinite}',
  'body[data-ds-dark-theme] .dsnv-panel-row.dsnv-panel-loading .dsnv-panel-dash{background:#fff}',
  '@keyframes dsnv-pulse{0%,100%{opacity:.12}50%{opacity:.65}}',
  '@media (prefers-reduced-motion:reduce){.dsnv-list{transition:none}.dsnv-rail{transition:none}.dsnv-dot{transition:none}.dsnv-highlight::after{animation-duration:.6s}}',
].join('\n')

const CSS_TAG_ID = 'dsh-client-ui-msg-nav/style.css'
let cssInjected = false
function ensureCssInjected(): void {
  if (cssInjected) return
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') !== null) {
    cssInjected = true
    return
  }
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-client-ui-msg-nav'
  tag.dataset.pluginCss = CSS_TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
  cssInjected = true
}

// ── shared helpers ────────────────────────────────────────────────────────
const GAP = 20
const MAX_VIS = 10
const FULL_LOAD_PAGES = 120
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

interface UserEntry {
  key: string | null | undefined
  id: string | undefined
  seq: number | undefined
  time: number | undefined
  text: string
}

function isUserish(n: Record<string, unknown> | null | undefined): boolean {
  if (n === undefined || n === null) return false
  return n.kind === 'user' || n.kind === 'steering'
}

function previewOf(data: Record<string, unknown> | null | undefined): string {
  if (!data || !Array.isArray(data.content)) return ''
  let text = ''
  let hasImage = false
  for (const b of data.content) {
    if (!b) continue
    const block = b as Record<string, unknown>
    if (block.type === 'text' && typeof block.text === 'string') {
      text += block.text + '\n'
      if (text.length > 420) break
    } else if (block.type === 'image') hasImage = true
  }
  const cleaned = text.replace(/^\s*<\s*goal_[a-z_]*\s*>\s*/i, '')
  const trimmed = cleaned.trim()
  if (trimmed !== '') return trimmed.length > 420 ? trimmed.slice(0, 420) + '…' : trimmed
  return hasImage ? '[图片消息]' : ''
}

// ── makeNavRail: produces the NavRail component with session access ──

/** The sessions service face the rail needs: binding → live session handle. */
interface SessionsBindingFace {
  binding(sessionId: string): { session: Record<string, unknown> } | undefined
}

export function makeNavRail(sessionsSvc: object): React.FC<NavRailProps> {
  ensureCssInjected()

  let railEl: HTMLElement | null = null
  let wiredScroller: HTMLElement | null = null
  let wiredWheelEl: HTMLElement | null = null
  let scrollerEl: HTMLElement | null = null
  let winEl: Window | null = null
  let resizeObs: ResizeObserver | null = null
  let rowsCache: Record<string, Element> = {}
  let currentUsers: UserEntry[] = []
  let ringTimer: number | null = null
  let ringEl: HTMLElement | null = null
  let activeIdx = -1
  let lastRowCount = -1
  let lastGeo: { right: number; railH: number; top: number } | null = null
  const setters: {
    active: ((v: number) => void) | null
    rowCount: ((v: number) => void) | null
    geo: ((v: { right: number; railH: number; top: number } | null) => void) | null
    fullLoading: ((v: boolean) => void) | null
  } = { active: null, rowCount: null, geo: null, fullLoading: null }
  const latest: Record<string, (() => void) | null> = { spy: null, measure: null, wheel: null }

  // ── full-history auto-load ──────────────────────────────────────────────
  let loadAllGen = 0

  function stopLoadAll(): void {
    loadAllGen++
  }

  async function loadAllOlder(face: Record<string, unknown>, gen: number): Promise<void> {
    let pages = 0
    let guard = 0
    while (gen === loadAllGen && guard++ < 600) {
      let snap: Record<string, unknown> | null = null
      try { snap = (face.getSnapshot as () => Record<string, unknown>)() } catch { return }
      if (snap === undefined || snap === null) return
      if (snap.openState === 'error') return
      if (snap.openState !== 'open') { await delay(120); continue }
      if (snap.hasMore !== true) return
      if (snap.loadingOlder === true) { await delay(50); continue }
      try { await (face.loadOlder as () => Promise<void>)() } catch { return }
      if (++pages >= FULL_LOAD_PAGES) return
    }
  }

  async function loadUntilKeyLoaded(face: Record<string, unknown>, key: string): Promise<void> {
    let pages = 0
    let guard = 0
    while (guard++ < 300) {
      let snap: Record<string, unknown> | null = null
      try { snap = (face.getSnapshot as () => Record<string, unknown>)() } catch { return }
      if (snap === undefined || snap === null) return
      if (snap.openState === 'error') return
      if (snap.openState !== 'open') { await delay(120); continue }
      let has = false
      try {
        const chat = snap.chat as Record<string, unknown> | undefined
        has = chat !== undefined && (chat.nodes as Map<string, unknown>)?.get(key) !== undefined
      } catch { return }
      if (has) return
      if (snap.hasMore !== true) return
      if (snap.loadingOlder === true) { await delay(50); continue }
      try { await (face.loadOlder as () => Promise<void>)() } catch { return }
      if (++pages >= FULL_LOAD_PAGES) return
    }
  }

  function windowHasId(snap: Record<string, unknown>, id: string): boolean {
    try {
      const chat = snap.chat as Record<string, unknown> | undefined
      if (chat === undefined) return false
      const order = chat.order as string[] | undefined
      const nodes = chat.nodes as Map<string, Record<string, unknown>> | undefined
      if (order === undefined || nodes === undefined) return false
      for (const k of order) {
        const n = nodes.get(k)
        if (n !== undefined && n !== null && String(n.id) === String(id)) return true
      }
    } catch { /* fall through */ }
    return false
  }

  function keyForIdInWindow(face: Record<string, unknown>, id: string): string | null {
    try {
      const snap = (face.getSnapshot as () => Record<string, unknown>)()
      if (snap === undefined || snap === null) return null
      const chat = snap.chat as Record<string, unknown> | undefined
      if (chat === undefined) return null
      const order = chat.order as string[] | undefined
      const nodes = chat.nodes as Map<string, Record<string, unknown>> | undefined
      if (order === undefined || nodes === undefined) return null
      for (const k of order) {
        const n = nodes.get(k)
        if (n !== undefined && n !== null && String(n.id) === String(id)) return String(k)
      }
    } catch { /* fall through */ }
    return null
  }

  async function loadUntilIdLoaded(face: Record<string, unknown>, id: string): Promise<void> {
    let pages = 0
    let guard = 0
    while (guard++ < 300) {
      let snap: Record<string, unknown> | null = null
      try { snap = (face.getSnapshot as () => Record<string, unknown>)() } catch { return }
      if (snap === undefined || snap === null) return
      if (snap.openState === 'error') return
      if (snap.openState !== 'open') { await delay(120); continue }
      if (windowHasId(snap, id)) return
      if (snap.hasMore !== true) return
      if (snap.loadingOlder === true) { await delay(50); continue }
      try { await (face.loadOlder as () => Promise<void>)() } catch { return }
      if (++pages >= FULL_LOAD_PAGES) return
    }
  }

  function startLoadAll(sessionId: string): void {
    stopLoadAll()
    const gen = loadAllGen
    if (setters.fullLoading) setters.fullLoading(true)
    const finish = () => {
      if (gen === loadAllGen && setters.fullLoading) setters.fullLoading(false)
    }
    const run = async () => {
      try {
        let guard = 0
        while (gen === loadAllGen && guard++ < 200) {
          let face: Record<string, unknown> | null = null
          try {
            const binding = (sessionsSvc as SessionsBindingFace).binding(sessionId)
            face = binding?.session ?? null
          } catch { face = null }
          if (face === null) { await delay(250); continue }
          await loadAllOlder(face, gen)
          break
        }
      } finally {
        finish()
      }
    }
    run().catch(() => {})
  }

  // ── imperative helpers ──────────────────────────────────────────────────
  function rowFor(key: string): Element | null {
    const row = rowsCache[key]
    return row === undefined ? null : row
  }

  function clearRing(): void {
    if (ringTimer !== null) { clearTimeout(ringTimer); ringTimer = null }
    if (ringEl !== null) { ringEl.classList.remove('dsnv-highlight'); ringEl = null }
  }

  function onScroll(): void {
    if (latest.spy) latest.spy()
  }

  function onResize(): void {
    scheduleResize()
  }

  let resizePending = false
  function scheduleResize(): void {
    if (resizePending || winEl === null) return
    resizePending = true
    const win = winEl
    const raf: (fn: () => void) => void = win.requestAnimationFrame ?? ((fn: () => void) => { win.setTimeout(fn, 16) })
    raf(() => {
      resizePending = false
      if (latest.measure) latest.measure()
    })
  }

  function onWheelNative(event: WheelEvent): void {
    if (latest.wheel) (latest.wheel as (e: WheelEvent) => void)(event)
  }

  function unwire(): void {
    if (wiredScroller !== null && winEl !== null) {
      wiredScroller.removeEventListener('scroll', onScroll)
      winEl.removeEventListener('resize', onResize)
      if (resizeObs !== null) { resizeObs.disconnect(); resizeObs = null }
    }
    if (wiredWheelEl !== null) {
      wiredWheelEl.removeEventListener('wheel', onWheelNative)
      wiredWheelEl = null
    }
    wiredScroller = null
    scrollerEl = null
    winEl = null
  }

  function ensureWired(): boolean {
    const el = railEl
    if (el === null) return false
    const doc = el.ownerDocument
    const win = doc.defaultView
    if (win === null) return false
    const sc = doc.querySelector('[data-conversation-scroll]')
    if (sc === null) return false
    if (wiredScroller !== sc) {
      if (wiredScroller !== null && winEl !== null) {
        wiredScroller.removeEventListener('scroll', onScroll)
        winEl.removeEventListener('resize', onResize)
        if (resizeObs !== null) { resizeObs.disconnect(); resizeObs = null }
      }
      scrollerEl = sc as HTMLElement
      winEl = win
      sc.addEventListener('scroll', onScroll, { passive: true })
      win.addEventListener('resize', onResize)
      if (typeof win.ResizeObserver === 'function') {
        resizeObs = new win.ResizeObserver(onResize)
        resizeObs.observe(sc)
      }
      wiredScroller = sc as HTMLElement
      if (latest.measure) latest.measure()
    } else {
      scrollerEl = sc as HTMLElement
    }
    if (wiredWheelEl !== el) {
      if (wiredWheelEl !== null) wiredWheelEl.removeEventListener('wheel', onWheelNative)
      el.addEventListener('wheel', onWheelNative, { passive: false })
      wiredWheelEl = el
    }
    return true
  }

  function tick(): void {
    if (railEl === null) return
    if (ensureWired() && latest.spy) latest.spy()
  }

  // Cleanup on unmount — returned from the effect below
  const cleanup = () => {
    unwire()
    clearRing()
    stopLoadAll()
  }

  // ── The NavRail React component ─────────────────────────────────────────
  return function NavRail(props: NavRailProps) {
    const snapshot = props.useSession(s => s)
    const projected = props.useProjection('msgNavMessages')

    const [active, setActive] = React.useState(-1)
    const [geo, setGeo] = React.useState<{ right: number; railH: number; top: number } | null>(null)
    const [rowCount, setRowCount] = React.useState(-1)
    const [listScroll, setListScroll] = React.useState(0)
    const [railHot, setRailHot] = React.useState(false)
    const [fullLoading, setFullLoading] = React.useState(false)
    const railHotRef = React.useRef(false)

    // Derive window users from the conversation snapshot
    const winUsers: UserEntry[] = []
    const winOrphans: UserEntry[] = []
    try {
      const chat = (snapshot as unknown as Record<string, unknown> | null | undefined)?.chat as Record<string, unknown> | undefined
      if (chat !== undefined) {
        const order = chat.order as string[] | undefined
        const nodes = chat.nodes as Map<string, Record<string, unknown>> | undefined
        if (Array.isArray(order) && nodes !== undefined) {
          for (const key of order) {
            const n = nodes.get(key)
            if (n !== undefined && n !== null && isUserish(n)) {
              const data = n.data as Record<string, unknown> | undefined
              const w: UserEntry = {
                key: String(key),
                id: n.id !== undefined && n.id !== null ? String(n.id) : undefined,
                seq: typeof n.anchorSeq === 'number' ? n.anchorSeq : undefined,
                time: data !== undefined && typeof data.time === 'number' ? data.time : undefined,
                text: previewOf(data),
              }
              winUsers.push(w)
              if (w.id === undefined) winOrphans.push(w)
            }
          }
        }
      }
    } catch { /* skip */ }

    const projectionActive = Array.isArray(projected) && projected.length > 0

    let users: UserEntry[]
    if (projectionActive) {
      const byId = new Map<string, UserEntry>()
      for (const w of winUsers) if (w.id !== undefined) byId.set(w.id, w)
      users = []
      for (const m of projected as unknown as Array<Record<string, unknown>>) {
        if (m === null || typeof m !== 'object' || typeof m.seq !== 'number') continue
        const id = typeof m.id === 'string' ? m.id : undefined
        const w = id !== undefined ? byId.get(id) : undefined
        if (w !== undefined && id !== undefined) {
          users.push(w)
          byId.delete(id)
        } else {
          users.push({ key: null, id, seq: m.seq as number, time: typeof m.time === 'number' ? m.time as number : undefined, text: typeof m.text === 'string' ? m.text as string : '' })
        }
      }
      for (const w of byId.values()) users.push(w)
      for (const w of winOrphans) users.push(w)
      users.sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity))
    } else {
      users = winUsers
    }
    currentUsers = users
    setters.active = setActive
    setters.rowCount = setRowCount
    setters.geo = setGeo
    setters.fullLoading = setFullLoading
    const N = users.length

    // Measure: compute rail position
    const measure = () => {
      if (!scrollerEl || !winEl) return
      let right: number, top: number, railH: number
      try {
        const srect = scrollerEl.getBoundingClientRect()
        const dpr = winEl.devicePixelRatio || 1
        right = Math.round((Math.max(0, winEl.innerWidth - srect.right) + 14) * dpr) / dpr
        const m = currentUsers.length
        railH = Math.max(Math.min(m, MAX_VIS) * GAP + 3, 3)
        top = Math.max(8, Math.round((srect.height - railH) / 2 + srect.top))
        top = Math.round(top * dpr) / dpr
      } catch { return }
      if (lastGeo !== null && lastGeo.right === right && lastGeo.railH === railH && lastGeo.top === top) return
      lastGeo = { right, railH, top }
      if (setters.geo) setters.geo(lastGeo)
    }
    latest.measure = measure

    // Scroll spy: track which user message is at the reading position
    const scrollspy = () => {
      if (!scrollerEl) return
      try {
        const srect = scrollerEl.getBoundingClientRect()
        const line = srect.top + srect.height * 0.33
        rowsCache = {}
        const all = scrollerEl.querySelectorAll('[data-chat-anchor-key]')
        for (let i = 0; i < all.length; i++) {
          const node = all[i]
          if (node === undefined) continue
          const anchor = (node as HTMLElement).dataset.chatAnchorKey
          if (anchor === undefined) continue
          rowsCache[anchor] = node
        }
        let idx = -1
        let found = 0
        for (let i = 0; i < currentUsers.length; i++) {
          const cu = currentUsers[i]
          if (cu === undefined || cu.key === undefined || cu.key === null) continue
          const row = rowsCache[cu.key]
          if (row === undefined) continue
          found++
          const r = row.getBoundingClientRect()
          if (r.top <= line) idx = i
        }
        if (found !== lastRowCount) { lastRowCount = found; if (setters.rowCount) setters.rowCount(found) }
        if (idx !== activeIdx) { activeIdx = idx; if (setters.active) setters.active(idx) }
      } catch { /* skip */ }
    }
    latest.spy = scrollspy

    // Effects
    React.useEffect(() => {
      ensureWired()
    }, [])

    React.useEffect(() => {
      const sid = props.sessionId as string | undefined
      if (sid === undefined || sid === null || projectionActive) {
        stopLoadAll()
        return
      }
      startLoadAll(sid)
      return stopLoadAll
    }, [props.sessionId, projectionActive])

    React.useEffect(() => {
      ensureWired()
      measure()
      scrollspy()
      if (!railHotRef.current) {
        const rh = Math.max(Math.min(N, MAX_VIS) * GAP + 3, 3)
        const maxScroll = Math.max(0, (N - 1) * GAP + 3 - rh)
        const centerIdx = activeIdx >= 0 ? activeIdx : 0
        const centered = Math.min(Math.max(centerIdx * GAP - rh / 2, 0), maxScroll)
        setListScroll(centered)
      }
    }, [N, fullLoading])

    // Periodic tick for scroll spy
    React.useEffect(() => {
      const iv = setInterval(tick, 700)
      const t0 = setTimeout(tick, 150)
      return () => {
        clearInterval(iv)
        clearTimeout(t0)
        cleanup()
      }
    }, [])

    if (snapshot === undefined || snapshot === null || (snapshot as unknown as Record<string, unknown>).removed === true) return null

    const shown = N >= 2 && (projectionActive || rowCount === N)
    const railH = geo !== null ? geo.railH : 160
    const rightPx = geo !== null ? geo.right : 24
    const topPx = geo !== null ? geo.top : 120
    const dpr = (winEl && winEl.devicePixelRatio) || 1
    const yOf = (i: number) => Math.round(i * GAP * (dpr as number)) / (dpr as number)
    const contentH = (N - 1) * GAP + 3 + (fullLoading ? GAP : 0)
    const maxScroll = Math.max(0, contentH - railH)
    const offset = Math.min(listScroll, maxScroll)

    const onWheel = (event: WheelEvent) => {
      if (maxScroll <= 0) return
      event.preventDefault()
      const next = Math.min(Math.max(listScroll + event.deltaY, 0), maxScroll)
      if (next !== listScroll) setListScroll(next)
    }
    latest.wheel = onWheel as unknown as () => void

    const jumpTo = (i: number) => {
      const u = currentUsers[i]
      if (u === undefined) return
      if (scrollerEl === null) return
      void (async () => {
        let row = u.key !== null && u.key !== undefined ? rowFor(u.key) : null
        if (row === null) {
          let face: Record<string, unknown> | null = null
          try {
            const binding = (sessionsSvc as SessionsBindingFace).binding(props.sessionId as string)
            face = binding?.session ?? null
          } catch { face = null }
          if (face !== null) {
            if (u.key !== null && u.key !== undefined) {
              await loadUntilKeyLoaded(face, u.key)
              if (latest.spy) latest.spy()
              let tries = 0
              while (tries++ < 20 && (row = rowFor(u.key)) === null) await delay(60)
            } else if (u.id !== null && u.id !== undefined) {
              await loadUntilIdLoaded(face, u.id)
              let tries = 0
              while (tries++ < 20 && row === null) {
                if (latest.spy) latest.spy()
                const k = keyForIdInWindow(face, u.id)
                if (k !== null) row = rowFor(k)
                if (row === null) await delay(60)
              }
            }
          }
        }
        if (row === null || scrollerEl === null) return
        let target = 0
        try {
          const srect = scrollerEl.getBoundingClientRect()
          const rrect = row.getBoundingClientRect()
          const offset2 = Math.min(160, Math.max(80, Math.round(srect.height * 0.25)))
          target = Math.max(0, scrollerEl.scrollTop + (rrect.top - srect.top) - offset2)
        } catch { return }

        const before = scrollerEl.scrollTop
        try {
          scrollerEl.scrollTo({ top: target, behavior: 'smooth' })
        } catch {
          scrollerEl.scrollTop = target
        }
        setTimeout(() => {
          if (scrollerEl === null) return
          if (Math.abs(scrollerEl.scrollTop - before) < 2) {
            try { scrollerEl.scrollTo({ top: target, behavior: 'smooth' }) } catch { scrollerEl.scrollTop = target }
          }
        }, 220)
        setTimeout(() => {
          if (scrollerEl === null) return
          if (Math.abs(scrollerEl.scrollTop - before) < 8) {
            scrollerEl.scrollTop = target
          }
        }, 850)
        clearRing()
        row.classList.add('dsnv-highlight')
        ringEl = row as HTMLElement
        ringTimer = window.setTimeout(clearRing, 1500)
        const centered = Math.min(Math.max(yOf(i) - railH / 2, 0), maxScroll)
        setListScroll(centered)
      })()
    }

    const railStyle: React.CSSProperties = {
      right: rightPx + 'px',
      top: (topPx - 3) + 'px',
      height: (railH + 6) + 'px',
    }

    const panelStyle: React.CSSProperties = {
      right: rightPx + 'px',
      top: (topPx - 3 + (railH + 6) / 2 - (Math.min(N, MAX_VIS) * 24 + 16) / 2) + 'px',
      height: (Math.min(N, MAX_VIS) * 24 + 16) + 'px',
    }

    return createPortal(
      <div
        ref={(el) => { railEl = el }}
        className={'dsnv-rail' + (shown ? ' dsnv-on' : '') + (railHot ? ' dsnv-pop' : '')}
        role="navigation"
        aria-label="消息导航"
        style={railStyle}
        onPointerEnter={() => { railHotRef.current = true; setRailHot(true) }}
        onPointerLeave={() => {
          railHotRef.current = false
          setRailHot(false)
          const centered = Math.min(Math.max(yOf(activeIdx >= 0 ? activeIdx : 0) - railH / 2, 0), maxScroll)
          setListScroll(centered)
        }}
      >
        {/* Rail dash strip */}
        <div
          className="dsnv-list"
          style={{ transform: 'translateY(' + (-offset) + 'px)' }}
        >
          {users.map((u, i) => (
            <button
              key={u.key !== null && u.key !== undefined ? u.key : (u.id !== undefined ? 'id-' + u.id : 'proj-' + i)}
              type="button"
              className={'dsnv-dot' + (i === active ? ' dsnv-on' : '')}
              style={{ top: yOf(i) + 'px' }}
              aria-label={'跳转到第 ' + (i + 1) + ' 条用户消息'}
              onClick={() => jumpTo(i)}
            />
          ))}
          {fullLoading ? (
            <span
              className="dsnv-dot dsnv-pending"
              style={{ top: yOf(N) + 'px' }}
              aria-hidden={true}
            />
          ) : null}
        </div>

        {/* Hover preview panel */}
        {railHot && shown ? (
          <div className="dsnv-panel" style={panelStyle}>
            <div
              className="dsnv-panel-scroll"
              style={{ transform: 'translateY(' + (-offset * 1.2) + 'px)' }}
            >
              {users.map((u, i) => (
                <button
                  key={u.key !== null && u.key !== undefined ? u.key : (u.id !== undefined ? 'id-' + u.id : 'proj-' + i)}
                  type="button"
                  className={'dsnv-panel-row' + (i === active ? ' dsnv-panel-on' : '')}
                  style={{ top: (8 + i * 24) + 'px' }}
                  aria-label={'跳转到第 ' + (i + 1) + ' 条用户消息'}
                  onClick={() => jumpTo(i)}
                >
                  <span className="dsnv-panel-text">{u.text !== '' ? u.text : '(无文本内容)'}</span>
                  <span className="dsnv-panel-dash" />
                </button>
              ))}
              {fullLoading && N >= MAX_VIS ? (
                <div
                  className="dsnv-panel-row dsnv-panel-loading"
                  style={{ top: (8 + N * 24) + 'px' }}
                >
                  <span className="dsnv-panel-text">正在加载更早消息…</span>
                  <span className="dsnv-panel-dash" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>,
      document.body,
    )
  }
}
