/**
 * Tech-theme row dictionaries. A separate namespace from the official
 * 'settings.theme' pair: this plugin owns its own cubes' copy.
 */
export const zh = {
  'tech-theme.title': '科技主题',
  'tech-theme.aurora': '极光',
  'tech-theme.nebula': '星云',
} satisfies Record<string, string>

export const en = {
  'tech-theme.title': 'Tech themes',
  'tech-theme.aurora': 'Aurora',
  'tech-theme.nebula': 'Nebula',
} satisfies Record<TechThemeKey, string>

/** Copy keys shared by both dictionaries. */
export type TechThemeKey = keyof typeof zh
