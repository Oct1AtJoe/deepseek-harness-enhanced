/**
 * Tech-theme preference row registered into the General section item slot
 * beside the official Appearance row (id `appearance-custom`, after it).
 * Two cubes — aurora and nebula — rendered only when this plugin mounts, so
 * the official ui-theme package never references the custom theme ids.
 * Selection follows the persisted preference, never the resolved active
 * theme; the ids persist through the official settings scope because
 * `THEME_PREFERENCES` includes them.
 */
import clsx from 'clsx'
import { IconSparkle16, IconThinkOutline16, IconAgentPresetOutline16, IconBrowseOutline16, IconGoalOutline16, IconEnhanceOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings section's SlotMap entry behind PropsRuntime.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { TechThemeKey } from './locales.ts'
import type { createTechThemeStore } from './settings-store.ts'
import css from './TechThemeRow.module.css'

/** Locale namespace registered by this plugin (see src/client/index.ts). */
export const SETTINGS_NS = 'settings.theme.custom'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface TechThemeRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type TechThemeRowProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createTechThemeStore>>
  & PropsLocale<typeof SETTINGS_NS> & TechThemeRowInjected

/** Cube order and icons. Id must match a registered theme id. */
const CUBES: readonly { id: string; labelKey: TechThemeKey; Icon: typeof IconSparkle16 }[] = [
  { id: 'aurora', labelKey: 'tech-theme.aurora', Icon: IconSparkle16 },
  { id: 'nebula', labelKey: 'tech-theme.nebula', Icon: IconThinkOutline16 },
  { id: 'void', labelKey: 'tech-theme.void', Icon: IconAgentPresetOutline16 },
  { id: 'jade', labelKey: 'tech-theme.jade', Icon: IconBrowseOutline16 },
  { id: 'solar', labelKey: 'tech-theme.solar', Icon: IconGoalOutline16 },
  { id: 'glacial', labelKey: 'tech-theme.glacial', Icon: IconEnhanceOutline16 },
]

/**
 * Render the tech-theme row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function TechThemeRow({ t, setTheme, useStore }: TechThemeRowProps) {
  const preference = useStore(s => s.preference)
  return (
    <div className={css.group}>
      <div className={css.title}>{t('tech-theme.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id as ThemePreference) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
