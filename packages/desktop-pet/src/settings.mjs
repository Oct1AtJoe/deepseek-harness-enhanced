// Desktop pet settings schema + registration.
// Registers a "desktop-pet" namespace with the DSH settings system.
import { z } from 'zod'

export const NAMESPACE = 'desktop-pet'

export const DEFAULTS = {
  enabled: true,
  size: 200,
  opacity: 1,
  character: 'whale-girl',
  sleepAfterMs: 60000,
}

export function buildSchema() {
  return z.object({
    enabled: z.boolean().default(DEFAULTS.enabled).describe('启用桌面宠物'),
    size: z.number().min(64).max(400).default(DEFAULTS.size).describe('宠物尺寸 (px)'),
    opacity: z.number().min(0.2).max(1).default(DEFAULTS.opacity).describe('透明度'),
    character: z.enum(['whale-girl', 'kanye']).default(DEFAULTS.character).describe('角色'),
    sleepAfterMs: z.number().min(10000).max(600000).default(DEFAULTS.sleepAfterMs).describe('空闲休眠时间 (ms)'),
  })
}

export async function registerSettings(settings) {
  if (!settings || typeof settings.register !== 'function') return null
  const scope = settings.register(NAMESPACE, buildSchema(), {
    applies: 'live',
    validate: () => true,
  })
  return scope
}
