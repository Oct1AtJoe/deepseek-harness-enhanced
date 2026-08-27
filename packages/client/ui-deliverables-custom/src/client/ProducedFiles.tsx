// ProducedFiles: the produced-file row a finished turn ends with. The paths
// come pre-matched by the turn-tail chain from the mutation tools'
// follow-along locations, never from the closing prose. Clicking a chip's
// name goes through the same openFile the tool rows use — the Host's own
// opener, on the Host machine. The row wraps to multiple lines when chips
// overflow the available width, so all files remain visible without
// single-line truncation.

import { useState } from 'react'
import type { HostDescriptionSource } from '@deepseek-ai/dsh-client-connection/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, IconChevronUpOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { DiffBlock } from './DiffBlock.tsx'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { basename, diffStats, dirname, type ProducedFileMatch } from './turn-deliverables.ts'
import type { NS } from './locales.ts'
import css from './ProducedFiles.module.css'

/** Cap for produced-file chips. The row wraps to multiple lines, so this
 *  limit exists mainly to bound measurement and prevent pathological counts;
 *  30 covers all realistic single-turn file sets. */
const SHOWN_LIMIT = 30

/**
 * Select the largest prefix whose measured chips and exact remainder fit.
 * @param available - usable width of the one-line file lane.
 * @param gap - computed flex gap between adjacent visible items.
 * @param chipWidths - measured widths for the candidate file chips.
 * @param moreWidthsByShown - exact localized remainder width for each shown count.
 * @returns Number of leading chips to render.
 */
export function fitProducedFiles(
  available: number,
  gap: number,
  chipWidths: readonly number[],
  moreWidthsByShown: readonly (number | undefined)[],
): number {
  if (available <= 0) return chipWidths.length
  const prefix = [0]
  let prefixWidth = 0
  for (const width of chipWidths) {
    prefixWidth += width
    prefix.push(prefixWidth)
  }
  let largestFit = 0
  for (const [shown, width] of prefix.entries()) {
    const more = moreWidthsByShown[shown]
    const items = shown + (more === undefined ? 0 : 1)
    const needed = width + (more ?? 0) + Math.max(0, items - 1) * gap
    if (needed <= available) largestFit = shown
  }
  return largestFit
}

/** Registration-side Host capability facts. */
export interface ProducedFilesInjected {
  /** Whether the browser itself is connected over loopback. */
  isLoopback: boolean
  hooks: {
    /** Current generation's Host description, bound by the slot renderer. */
    hostDescription: HostDescriptionSource
  }
}

/** Matched paths plus the opener, locale, and injected Host capability. */
export type ProducedFilesProps = Pick<TurnTailOwnerProps, 'openFile'> & {
  matched: readonly ProducedFileMatch[]
} & PropsLocale<typeof NS> & InjectFace<ProducedFilesInjected>

function moreLabel(t: ProducedFilesProps['t'], count: number): string {
  return count === 1 ? t('produced.moreOne') : t('produced.more', { count: String(count) })
}

/** The `+A -R` badge of one chip's conversation totals. */
function Stats({ added, removed }: { added: number; removed: number }) {
  return (
    <span className={css.stats}>
      <span className={css.added}>+{added}</span>
      <span className={css.removed}>-{removed}</span>
    </span>
  )
}

/**
 * The expanded change below the row: one card, a title bar over the diff
 * primitive's body. The bar carries the path (name plus dimmed directory, both
 * ellipsized; like every path in this row it opens the file), the +/- totals,
 * and its own collapse control; the primitive's path headers and footer stay
 * off inside the panel.
 */
function ChangePanel({ match, openFile, t, close }: {
  match: ProducedFileMatch
  openFile: (path: string) => void
  t: ProducedFilesProps['t']
  close: () => void
}) {
  const stats = diffStats(match.hunks)
  return (
    <div className={css.diff} data-produced-diff>
      <div className={css.diffHeader}>
        <button
          type="button"
          className={css.diffPath}
          title={match.path}
          aria-label={t('produced.open', { name: match.path })}
          onClick={() => { openFile(match.path) }}
        >
          <span className={css.diffName}>{basename(match.path)}</span>
          {dirname(match.path) !== '' && <span className={css.diffDir}>{dirname(match.path)}</span>}
        </button>
        <Stats added={stats.added} removed={stats.removed} />
        <button
          type="button"
          className={css.diffCollapse}
          aria-label={t('produced.collapsePanel')}
          onClick={close}
        >
          <IconChevronUpOutline14 size={12} />
        </button>
      </div>
      <DiffBlock
        diffs={match.hunks.map(hunk => ({ path: match.path, ...hunk }))}
        showPathHeaders={false}
        showFooter={false}
        className={css.diffBody}
      />
    </div>
  )
}

/**
 * Render one turn's produced files as openable chips.
 * @param props - selector-matched paths, the chat view's file opener, and the locale seat.
 * @returns The produced-files row.
 */
export function ProducedFiles({
  matched: paths, openFile, isLoopback, useHostDescription, t,
}: ProducedFilesProps) {
  const hostCanOpenPath = useHostDescription(description => description?.canOpenPath === true)
  const canOpenPath = isLoopback && hostCanOpenPath
  const [expandedPath, setExpandedPath] = useState<string | null>(null)

  const shown = paths.slice(0, SHOWN_LIMIT)
  const hidden = paths.length - shown.length
  const expanded = paths.find(match => match.path === expandedPath) ?? null

  // One chip: the name opens the file; the cumulative badge (totalHunks)
  // shows the conversation's total +/- for the file, and the chevron
  // (visible only when this turn has its own hunks) expands the turn's
  // change below the row.
  const chip = (match: ProducedFileMatch) => {
    const { path, hunks, totalHunks } = match
    const stats = totalHunks.length === 0 ? null : diffStats(totalHunks)
    const open = expandedPath === path
    return (
      <span key={path} className={css.chip}>
        <button
          type="button"
          className={css.file}
          // The full path is the disambiguator when two turns produce files
          // that share a basename; the chip itself stays short.
          title={path}
          aria-label={t('produced.open', { name: path })}
          onClick={() => { openFile(path) }}
        >
          {basename(path)}
        </button>
        {stats !== null && (
          <>
            <Stats added={stats.added} removed={stats.removed} />
            {hunks.length > 0 && (
              <button
                type="button"
                className={css.toggle}
                aria-expanded={open}
                aria-label={t(open ? 'produced.collapse' : 'produced.expand', { name: path })}
                onClick={() => { setExpandedPath(open ? null : path) }}
              >
                {open ? <IconChevronUpOutline14 size={12} /> : <IconChevronDownOutline14 size={12} />}
              </button>
            )}
          </>
        )}
      </span>
    )
  }

  return (
    <div className={css.root}>
      <span className={css.label}>{t('produced.label')}</span>
      <div className={css.row} data-produced-files-row>
        {shown.map(chip)}
        {hidden > 0 && <span className={css.more}>{moreLabel(t, hidden)}</span>}
      </div>
      {expanded !== null && expanded.hunks.length > 0 && (
        <ChangePanel
          match={expanded}
          openFile={openFile}
          t={t}
          close={() => { setExpandedPath(null) }}
        />
      )}
      {paths.length > 0 && canOpenPath && (
        <button type="button" className={css.showFolder} onClick={() => { openFile('.') }}>
          {t('produced.showInFolder')}
        </button>
      )}
    </div>
  )
}
