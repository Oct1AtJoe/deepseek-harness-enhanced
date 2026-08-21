/** The kanye-pet card: desktop pet toggle, character, size/opacity. */

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { KanyeCardFace } from './kanye-card-controller.ts'
import type { KanyeLocaleKey } from './locales.ts'
import css from './KanyeCard.module.css'

/** Props the renderer binds for the kanye-pet card. */
export type KanyeCardProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'kanye-pet'>
  & InjectFace<KanyeCardFace>

/** One numeric field row with a reset control. */
function NumberField({
  id, label, hint, value, disabled, onEdit, onReset, t,
}: {
  id: string
  label: string
  hint: string
  value: { text: string; invalid: boolean }
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
  t: (key: KanyeLocaleKey) => string
}): ReactNode {
  return (
    <div className={css.fieldRow}>
      <label className={css.fieldLabel} htmlFor={id}>
        <span className={css.rowTitle}>{label}</span>
        <span className={css.rowHint}>{hint}</span>
      </label>
      <div className={css.fieldControl}>
        <input
          id={id}
          className={css.fieldInput}
          type="text"
          inputMode="decimal"
          value={value.text}
          disabled={disabled}
          aria-invalid={value.invalid}
          onChange={(event) => { onEdit(event.target.value) }}
        />
        <button type="button" className={css.button} disabled={disabled} onClick={onReset}>
          {t('reset')}
        </button>
      </div>
      {value.invalid ? <span className={css.fieldError}>{t('invalidNumber')}</span> : null}
    </div>
  )
}

/** Render the kanye-pet card. */
export function KanyeCard(props: KanyeCardProps): ReactNode {
  const { t } = props
  const state = props.useKanyeCard(snapshot => snapshot)
  const disabled = !state.writable
  if (!state.available) return null

  return (
    <section className={css.section}>
      <div className={css.heading}>
        <h3 className={css.cardTitle}>{t('cardTitle')}</h3>
        <p className={css.cardDescription}>{t('cardDescription')}</p>
      </div>
      <div className={css.row}>
        <div className={css.rowLabel}>
          <span className={css.rowTitle}>{t('desktopPet')}</span>
          <span className={css.rowHint}>{t('desktopPetHint')}</span>
        </div>
        <button
          type="button"
          className={css.switch}
          data-on={String(state.desktopPetEnabled)}
          aria-pressed={state.desktopPetEnabled}
          disabled={disabled}
          onClick={props.toggleDesktopPet}
        />
      </div>
      <div className={css.row}>
        <div className={css.rowLabel}>
          <span className={css.rowTitle}>{t('character')}</span>
          <span className={css.rowHint}>{t('characterHint')}</span>
        </div>
        <select
          className={css.fieldInput}
          value={state.character}
          disabled={disabled || !state.charactersLoaded || state.characters.length === 0}
          onChange={(event) => { props.edit('character', event.target.value) }}
        >
          {state.charactersLoaded && state.characters.length === 0
            ? <option value={state.character}>{state.character}</option>
            : state.characters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
        </select>
      </div>
      <NumberField
        id="plugin-config-kanye-size"
        label={t('size')}
        hint={t('sizeHint')}
        value={state.size}
        disabled={disabled}
        onEdit={(text) => { props.edit('size', text) }}
        onReset={() => { props.edit('size', '150') }}
        t={t}
      />
      <NumberField
        id="plugin-config-kanye-opacity"
        label={t('opacity')}
        hint={t('opacityHint')}
        value={state.opacity}
        disabled={disabled}
        onEdit={(text) => { props.edit('opacity', text) }}
        onReset={() => { props.edit('opacity', '1') }}
        t={t}
      />
      <div className={css.actions}>
        <button
          type="button"
          className={css.button}
          data-tone="primary"
          disabled={disabled || !state.dirty || state.invalid || state.saving}
          onClick={props.save}
        >
          {state.saving ? '...' : t('save')}
        </button>
        <button
          type="button"
          className={css.button}
          disabled={disabled || (!state.dirty && !state.saving)}
          onClick={props.discard}
        >
          {t('discard')}
        </button>
      </div>
    </section>
  )
}
