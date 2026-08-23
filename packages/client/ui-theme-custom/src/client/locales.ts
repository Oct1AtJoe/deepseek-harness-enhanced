/**
 * Tech-theme row dictionaries. A separate namespace from the official
 * 'settings.theme' pair: this plugin owns its own cubes' copy.
 */
export const zh = {
  'tech-theme.title': '科技主题',
  'tech-theme.aurora': '极光',
  'tech-theme.nebula': '星云',
  'tech-theme.void': '冥夜',
  'tech-theme.jade': '翠渊',
  'tech-theme.solar': '灼日',
  'tech-theme.glacial': '寒渊',
} satisfies Record<string, string>

/** English dictionary checked against the Chinese key set. */
export const en = {
  'tech-theme.title': 'Tech themes',
  'tech-theme.aurora': 'Aurora',
  'tech-theme.nebula': 'Nebula',
  'tech-theme.void': 'Void',
  'tech-theme.jade': 'Jade',
  'tech-theme.solar': 'Solar',
  'tech-theme.glacial': 'Glacial',
} satisfies Record<TechThemeKey, string>

/** Copy keys shared by both dictionaries. */
export type TechThemeKey = keyof typeof zh
