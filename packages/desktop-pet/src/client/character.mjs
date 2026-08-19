// Desktop pet character manifest parser.
// Migrated from whale-girl — adapted for built-in DSH integration.
//契约：manifest 形状兼容两种格式：
// - { characters: { <id>: { meta?, states } }, default } （多角色）
// - { states: {...} } （单角色简写，旧格式）
export const DEFAULT_ROLE_ID = 'whale-girl'
export const ROLE_ID_RE = /^[a-z0-9-]+$/

export function parseCharacters(manifest) {
  const raw = manifest?.characters
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const characters = {}
    for (const [id, ch] of Object.entries(raw)) {
      if (ch === null || typeof ch !== 'object') continue
      characters[id] = {
        id,
        name: typeof ch.name === 'string' ? ch.name : id,
        credit: typeof ch.credit === 'string' ? ch.credit : undefined,
        meta: ch.meta !== null && typeof ch.meta === 'object' ? ch.meta : {},
        states: ch.states !== null && typeof ch.states === 'object' ? ch.states : {},
      }
    }
    const defaultId = typeof manifest.default === 'string' && manifest.default in characters
      ? manifest.default
      : Object.keys(characters)[0] ?? DEFAULT_ROLE_ID
    return { characters, defaultId }
  }
  return {
    characters: {
      [DEFAULT_ROLE_ID]: {
        id: DEFAULT_ROLE_ID,
        name: DEFAULT_ROLE_ID,
        credit: undefined,
        meta: {},
        states: manifest?.states !== null && typeof manifest?.states === 'object' ? manifest.states : {},
      },
    },
    defaultId: DEFAULT_ROLE_ID,
  }
}

export function listCharacters(manifest) {
  return Object.keys(parseCharacters(manifest).characters)
}

export function defaultCharacter(manifest) {
  return parseCharacters(manifest).defaultId
}

export function getCharacter(manifest, id) {
  return parseCharacters(manifest).characters[id] ?? null
}

export function stateOf(character, stateName) {
  return character?.states?.[stateName]
}

export const STATE_NAMES = Object.freeze([
  'idle', 'working', 'celebrate', 'error', 'disappointed', 'joy', 'eat', 'play',
  'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait',
])

export function isKnownState(stateName) {
  return STATE_NAMES.includes(stateName)
}
