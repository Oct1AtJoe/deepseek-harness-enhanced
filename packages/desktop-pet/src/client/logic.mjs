// Desktop pet state machine + timing logic.
// Migrated from whale-girl — pure functions, no DOM, testable.

export const TRANSIENT_MS = 1500
export const WAKE_MS = 3000
export const JOY_MS = 1600

export const PLAYBACK_MODES = Object.freeze(['loop', 'pingpong', 'once', 'blink'])
export const PLAYBACK_MIN_FRAMES = Object.freeze({ loop: 1, pingpong: 2, once: 1, blink: 2 })

// State priority table (first match wins)
export const STATE_TABLE = [
  { state: 'drag', when: (c) => c.dragging },
  { state: 'idle', when: (c) => c.dragReleaseUntil > c.now },
  { state: 'burst', when: (c) => c.activity.name !== 'idle' && c.activity.name !== 'working' && c.activity.until > c.now, resolve: (c) => c.activity.name },
  { state: 'eat', when: (c) => c.transient === 'eat' },
  { state: 'play', when: (c) => c.transient === 'play' },
  { state: 'wake', when: (c) => c.transient === 'wake' },
  { state: 'wait', when: (c) => c.sessionWait },
  { state: 'celebrate', when: (c) => c.celebrateUntil > c.now },
  { state: 'working', when: (c) => c.workingActive },
  { state: 'think', when: (c) => c.sessionThink },
  { state: 'joy', when: (c) => c.now < c.joyUntil },
  { state: 'sleep', when: (c) => c.sleeping },
  { state: 'walk', when: (c) => c.walking },
  { state: 'idle', when: () => true },
]

export function pickState(input) {
  const ctx = {
    ...input,
    now: input.now ?? Date.now(),
    joyUntil: input.joyUntil ?? 0,
    sessionThink: input.sessionThink ?? false,
    sessionWait: input.sessionWait ?? false,
    dragReleaseUntil: input.dragReleaseUntil ?? 0,
    workingActive: input.workingActive ?? false,
    celebrateUntil: input.celebrateUntil ?? 0,
  }
  for (const row of STATE_TABLE) {
    if (row.when(ctx)) return row.resolve ? row.resolve(ctx) : row.state
  }
  return 'idle'
}

export function deriveSessionMood(snapshot) {
  const byId = snapshot?.byId ?? {}
  let thinking = false
  let waiting = false
  const titles = []
  for (const id of Object.keys(byId)) {
    const s = byId[id]
    if (s === undefined || s === null) continue
    if (s.running === true) { thinking = true; titles.push(s.displayTitle ?? id) }
    if (s.pendingInteraction !== undefined) waiting = true
  }
  return { thinking, waiting, titles }
}

// Timing parameters (L2 semantic layer)
export const WORKING_MIN_WAIT_MS = 12000
export const WORKING_MAX_WAIT_MS = 30000
export const WORKING_MIN_DUR_MS = 2500
export const WORKING_MAX_DUR_MS = 6000
export const BLINK_MIN_INTERVAL_MS = 3000
export const BLINK_MAX_INTERVAL_MS = 9000
export const FACING_MIN_INTERVAL_MS = 10000
export const FACING_MAX_INTERVAL_MS = 25000

export function nextBlinkAt({ now, random = Math.random }) {
  return now + BLINK_MIN_INTERVAL_MS + random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
}

export function nextFacingAt({ now, random = Math.random }) {
  return now + FACING_MIN_INTERVAL_MS + random() * (FACING_MAX_INTERVAL_MS - FACING_MIN_INTERVAL_MS)
}

export function nextWorkingRhythm({ now, sessionThink, working, random = Math.random }) {
  if (!sessionThink) return { active: false, until: 0 }
  if (working.active) {
    const dur = WORKING_MIN_DUR_MS + random() * (WORKING_MAX_DUR_MS - WORKING_MIN_DUR_MS)
    return { active: false, until: now + dur }
  }
  const wait = WORKING_MIN_WAIT_MS + random() * (WORKING_MAX_WAIT_MS - WORKING_MIN_WAIT_MS)
  return { active: true, until: now + wait }
}

export function shouldWake(prevState, nextState, ctx = {}) {
  return prevState === 'sleep' && nextState !== 'sleep' && !ctx.dragging && (ctx.transient ?? null) === null
}

export function wakeFromInteraction({ sleeping }) {
  return { sleeping: false, wake: sleeping === true }
}

export function detectTurnCompleted(snapshot, prevRunning) {
  const byId = snapshot?.byId ?? {}
  const nextPrev = new Map(prevRunning)
  const flips = []
  for (const id of Object.keys(byId)) {
    const s = byId[id]
    if (s === null || typeof s !== 'object') continue
    const running = s.running === true
    if (nextPrev.get(id) === true && !running) flips.push({ id, title: s.displayTitle ?? id })
    nextPrev.set(id, running)
  }
  for (const id of nextPrev.keys()) {
    if (!(id in byId)) nextPrev.delete(id)
  }
  return { flips, prevRunning: nextPrev }
}
