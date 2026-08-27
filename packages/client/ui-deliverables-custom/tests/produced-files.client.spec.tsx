// @vitest-environment jsdom
/**
 * ui-deliverables browser half: the derivation contract of
 * `producedForClosing` over engine-published Turn data, the row's rendering
 * and opener wiring, and the plugin registrations' fiber-teardown removal
 * (HMR safety) against the real SlotRegistry.
 */
import { Context } from '@deepseek-ai/cordis'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConversationEventRegistry, ConversationNodeAssembler, SlotRegistry,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationEventInput, ConversationLocationDataStore, ConversationMatch, ConversationNodeDefinition,
  ConversationTimelineSnapshot, ConversationTurnDataMap, ConversationViewDefinition,
  ConversationViewNode, ToolResultNode, TurnLocation,
} from '@deepseek-ai/dsh-client-runtime/client'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import type { ChatFileMentions, TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import {
  fitProducedFiles, ProducedFiles, type ProducedFilesProps,
} from '../src/client/ProducedFiles.tsx'
import {
  basename, deliverablesDefinition, diffStats, dirname, producedFileMentions, producedForClosing, selectProducedFiles,
  type DeliverablesTurnData,
} from '../src/client/turn-deliverables.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyInvariant } from '../src/invariant.ts'
import { en, zh } from '../src/client/locales.ts'

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalClientWidth === undefined) {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  } else {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  }
})

class TestTurnDataStore implements ConversationLocationDataStore<ConversationTurnDataMap> {
  private readonly values = new Map<string, unknown>()

  get<Key extends Extract<keyof ConversationTurnDataMap, string>>(
    key: Key,
  ): Readonly<ConversationTurnDataMap[Key]> | undefined {
    return this.values.get(key) as Readonly<ConversationTurnDataMap[Key]> | undefined
  }

  set<Key extends Extract<keyof ConversationTurnDataMap, string>>(
    key: Key,
    value: ConversationTurnDataMap[Key],
  ): void {
    this.values.set(key, value)
  }
}

const turnLocation = (turn: number, deliverables?: DeliverablesTurnData): TurnLocation => {
  const data = new TestTurnDataStore()
  if (deliverables !== undefined) data.set('deliverables', deliverables)
  return { turn, start: undefined, end: undefined, status: 'closed', steps: [], data }
}

const produced = (
  ...values: ReadonlyArray<readonly [seq: number, path: string]>
): DeliverablesTurnData => ({
  produced: values.map(([seq, path]) => ({ seq, path })),
  history: new Map(),
  turnHunks: new Map(),
})

function tailOwner(
  data: DeliverablesTurnData | undefined,
  seq: number,
  openFile: (path: string) => void = () => {},
  turn = 1,
): TurnTailOwnerProps {
  return { seq, openFile, turn: turnLocation(turn, data) }
}

interface TimelineSnapshot {
  readonly timeline: ConversationTimelineSnapshot
}

class TestEventDefinitions {
  entries(): readonly ConversationNodeDefinition[] { return [deliverablesDefinition] }
  fallbackEntry(): ConversationNodeDefinition | undefined { return undefined }
}

class TestViewDefinitions {
  entries(): readonly ConversationViewDefinition[] { return [timelineViewDefinition] }
}

const timelineViewDefinition: ConversationViewDefinition<ConversationViewNode, TimelineSnapshot> = {
  target: 'test',
  create: () => {
    let current: TimelineSnapshot = { timeline: { turnOrder: [], turns: new Map() } }
    return {
      empty: current,
      replace: ({ timeline }) => (current = { timeline }),
      apply: ({ timeline }) => (current = { timeline }),
    }
  },
}

function at(
  seq: number,
  type: string,
  data: unknown,
  view?: ConversationEventInput['view'],
): ConversationEventInput {
  return {
    event: {
      seq, time: seq * 1_000, type, data,
      ...(type === 'tool/result' ? { surfaceOp: 'append' } : {}),
    } as ConversationEventInput['event'],
    view,
  }
}

function matched(input: ConversationEventInput, role: ConversationMatch['role']): ConversationMatch {
  return { ...input, role, location: { kind: 'unresolved' } }
}

function call(
  seq: number,
  callId: string,
  view: ToolResultNode['callView'],
  turn = 1,
): ConversationEventInput {
  return at(
    seq,
    'tool/call',
    { turn, step: 1, callId, name: 'fixture', arguments: '{}' },
    { for: 'call', view: view ?? { card: 'generic', title: 'fixture' } },
  )
}

function result(seq: number, callId: string, isError = false, turn = 1): ConversationEventInput {
  return at(seq, 'tool/result', {
    turn,
    step: 1,
    message: {
      source: { type: 'tool-result', callId },
      content: [{ type: 'tool-result', content: [], isError }],
    },
  })
}

function resultView(seq: number, callId: string, view: ConversationEventInput['view'], turn = 1): ConversationEventInput {
  const settled = result(seq, callId, false, turn)
  return { ...settled, view }
}

function diff(...paths: string[]): ToolResultNode['callView'] {
  return {
    card: 'diff', title: `Write ${paths[0] ?? ''}`,
    diffs: paths.map(path => ({ path, oldText: null, newText: 'x' })),
    locations: paths.map(path => ({ path })),
  }
}

function edit(path: string): ToolResultNode['callView'] {
  return { card: 'generic', title: `insert ${path}`, kind: 'edit', locations: [{ path }] }
}

function assembler(entries: readonly ConversationEventInput[], hasMore = false): ConversationNodeAssembler {
  const value = new ConversationNodeAssembler(new TestEventDefinitions(), new TestViewDefinitions())
  value.replaceWindow(entries, hasMore)
  value.flush()
  return value
}

function deliverablesOf(value: ConversationNodeAssembler, turn = 1): Readonly<DeliverablesTurnData> | undefined {
  const snapshot = value.snapshot('test') as TimelineSnapshot
  // The official ui-deliverables package also declares the 'deliverables'
  // projection key; this fork's richer type wins through the explicit cast.
  return snapshot.timeline.turns.get(turn)?.data.get('deliverables') as Readonly<DeliverablesTurnData> | undefined
}

describe('produced-file Turn data', () => {
  it('deduplicates paths in first-seen order and stops at the closing Assistant seq', () => {
    const data = produced(
      [3, 'out/index.html'],
      [4, 'out/app.css'],
      [4, 'out/index.html'],
      [8, 'after.txt'],
    )
    expect(producedForClosing(data, 6)).toEqual(['out/index.html', 'out/app.css'])
    expect(selectProducedFiles(tailOwner(data, 6))).toEqual([
      { path: 'out/index.html', hunks: [], totalHunks: [] },
      { path: 'out/app.css', hunks: [], totalHunks: [] },
    ])
    expect(producedForClosing(undefined)).toEqual([])
    expect(selectProducedFiles(tailOwner(undefined, 9, () => {}, 2))).toBeNull()
  })

  it('folds successful diff and generic-edit calls while ignoring reads, failures, and missing locations', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      call(2, 'write', diff('out/index.html', 'out/app.css')),
      result(3, 'write'),
      call(4, 'edit', edit('notes.md')),
      result(5, 'edit'),
      call(6, 'read', { card: 'generic', title: 'Read', locations: [{ path: 'input.txt' }] }),
      result(7, 'read'),
      call(8, 'failed', diff('broken.txt')),
      result(9, 'failed', true),
      call(10, 'locationless', { card: 'diff', title: 'Write', diffs: [] }),
      result(11, 'locationless'),
    ])

    expect(producedForClosing(deliverablesOf(value))).toEqual([
      'out/index.html', 'out/app.css', 'notes.md',
    ])
  })

  it('ignores calls without mutation locations, orphan results, and replacement results', () => {
    const replacement = result(8, 'replacement')
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      at(2, 'tool/call', { turn: 1, step: 1, callId: 'no-view', name: 'fixture', arguments: '{}' }),
      result(3, 'no-view'),
      call(4, 'locationless-edit', { card: 'generic', title: 'Edit', kind: 'edit' }),
      result(5, 'locationless-edit'),
      result(6, 'orphan'),
      call(7, 'replacement', diff('replaced.txt')),
      {
        ...replacement,
        event: {
          ...replacement.event,
          surfaceOp: { op: 'replace', start: 1, end: 1 },
        } as ConversationEventInput['event'],
      },
      at(9, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ])

    expect(producedForClosing(deliverablesOf(value))).toEqual([])
  })

  it('rejects an invalid start match and preserves state for an unrelated update', () => {
    const startMatch = matched(at(1, 'turn/start', { turn: 1 }), 'start')
    const emptyContext: Parameters<typeof deliverablesDefinition.start>[0] = {
      key: 'deliverables:1',
      kind: 'deliverables',
      id: '1',
      matches: [startMatch],
      start: startMatch,
      state: undefined,
      current: new Map(),
    }
    const reader: Parameters<typeof deliverablesDefinition.start>[2] = { previous: () => undefined }
    const state = deliverablesDefinition.start(emptyContext, startMatch, reader)
    const unrelated = matched(at(2, 'turn/end', { turn: 1, reason: { kind: 'completed' } }), 'update')
    const context: Parameters<typeof deliverablesDefinition.update>[0] = { ...emptyContext, state }

    expect(() => deliverablesDefinition.start(emptyContext, unrelated, reader))
      .toThrow('deliverables start requires turn/start')
    expect(deliverablesDefinition.update(context, unrelated)).toBe(state)
  })

  it('replays a tail page once prepend supplies its missing Turn start', () => {
    const value = assembler([
      call(10, 'late', diff('history.txt')),
      result(11, 'late'),
    ], true)
    expect(deliverablesOf(value)).toBeUndefined()

    value.prepend([at(1, 'turn/start', { turn: 1 })], false)
    value.flush()
    expect(producedForClosing(deliverablesOf(value))).toEqual(['history.txt'])
  })

  it('extends the same Turn data incrementally on live append', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      call(2, 'first', diff('first.txt')),
      result(3, 'first'),
    ])
    const first = deliverablesOf(value)
    expect(producedForClosing(first)).toEqual(['first.txt'])

    value.append(call(4, 'second', diff('second.txt')))
    value.append(result(5, 'second'))
    value.flush()
    expect(producedForClosing(deliverablesOf(value))).toEqual(['first.txt', 'second.txt'])
  })

  it('captures applied hunks from the result view and falls back to the call view', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      call(2, 'write', diff('out/a.txt')),
      resultView(3, 'write', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'out/a.txt', oldText: 'old\n', newText: 'new\n' }] },
      }),
      call(4, 'edit', {
        card: 'diff', title: 'Edit out/b.txt',
        diffs: [{ path: 'out/b.txt', oldText: null, newText: 'hello\n' }],
        locations: [{ path: 'out/b.txt' }],
      }),
      result(5, 'edit'),
    ])
    const data = deliverablesOf(value)
    expect(producedForClosing(data)).toEqual(['out/a.txt', 'out/b.txt'])
    // The applied hunks ride the result view; without one, the call view's
    // intended change is the fallback.
    expect(data?.history.get('out/a.txt')).toEqual([{ oldText: 'old\n', newText: 'new\n' }])
    expect(data?.history.get('out/b.txt')).toEqual([{ oldText: null, newText: 'hello\n' }])
    // turnHunks matches history in a single-turn scenario.
    expect(data?.turnHunks.get('out/a.txt')).toEqual([{ oldText: 'old\n', newText: 'new\n' }])
    expect(data?.turnHunks.get('out/b.txt')).toEqual([{ oldText: null, newText: 'hello\n' }])
  })

  it('ignores malformed or non-diff result views and generic-edit calls carry no hunks', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      call(2, 'write', diff('out/a.txt')),
      resultView(3, 'write', { for: 'result', view: { card: 'generic', title: 'Write' } }),
      call(4, 'insert', edit('notes.md')),
      resultView(5, 'insert', { for: 'result', view: { card: 'generic', title: 'Edit' } }),
      call(6, 'bad', diff('broken.txt')),
      resultView(7, 'bad', {
        for: 'result',
        view: { card: 'diff', diffs: 'nope' } as never,
      }),
      // Hostile hunk payloads at the wire boundary narrow to no hunks, like
      // the diff-card model: a non-object entry, a null entry, a non-string
      // path, a non-string newText, and a non-string oldText.
      call(8, 'hunk-junk', diff('junk.txt')),
      resultView(9, 'hunk-junk', {
        for: 'result',
        view: { card: 'diff', diffs: ['junk', null] } as never,
      }),
      call(10, 'bad-path', diff('bad-path.txt')),
      resultView(11, 'bad-path', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 5, newText: 'x' }] } as never,
      }),
      call(12, 'bad-new', diff('bad-new.txt')),
      resultView(13, 'bad-new', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'x', newText: 5 }] } as never,
      }),
      call(14, 'bad-old', diff('bad-old.txt')),
      resultView(15, 'bad-old', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'x', newText: 'y', oldText: 5 }] } as never,
      }),
    ])
    const data = deliverablesOf(value)
    expect(producedForClosing(data)).toEqual([
      'out/a.txt', 'notes.md', 'broken.txt', 'junk.txt', 'bad-path.txt', 'bad-new.txt', 'bad-old.txt',
    ])
    // A non-diff result (the tool chose the generic card), a generic-edit
    // card, and each malformed diff payload all contribute no hunks at all.
    expect(data?.history.get('out/a.txt')).toBeUndefined()
    expect(data?.history.get('notes.md')).toBeUndefined()
    expect(data?.history.get('broken.txt')).toBeUndefined()
    expect(data?.history.get('junk.txt')).toBeUndefined()
    expect(data?.history.get('bad-path.txt')).toBeUndefined()
    expect(data?.history.get('bad-new.txt')).toBeUndefined()
    expect(data?.history.get('bad-old.txt')).toBeUndefined()
    expect(data?.turnHunks.get('out/a.txt')).toBeUndefined()
    expect(data?.turnHunks.get('notes.md')).toBeUndefined()
    expect(data?.turnHunks.get('broken.txt')).toBeUndefined()
    expect(data?.turnHunks.get('junk.txt')).toBeUndefined()
    expect(data?.turnHunks.get('bad-path.txt')).toBeUndefined()
    expect(data?.turnHunks.get('bad-new.txt')).toBeUndefined()
    expect(data?.turnHunks.get('bad-old.txt')).toBeUndefined()
  })

  it('accumulates hunks for repeated edits of one path and chains history across turns', () => {
    const value = assembler([
      at(1, 'turn/start', { turn: 1 }),
      call(2, 'first', diff('out/a.txt')),
      resultView(3, 'first', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'out/a.txt', oldText: null, newText: 'one\n' }] },
      }),
      at(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
      at(5, 'turn/start', { turn: 2 }),
      call(6, 'second', diff('out/a.txt'), 2),
      resultView(7, 'second', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'out/a.txt', oldText: 'one\n', newText: 'two\n' }] },
      }, 2),
      call(8, 'third', diff('out/a.txt'), 2),
      resultView(9, 'third', {
        for: 'result',
        view: { card: 'diff', diffs: [{ path: 'out/a.txt', oldText: 'two\n', newText: 'three\nfour\n' }] },
      }, 2),
      at(10, 'turn/end', { turn: 2, reason: { kind: 'completed' } }),
    ])
    const turn1 = deliverablesOf(value, 1)
    const turn2 = deliverablesOf(value, 2)
    expect(turn1?.history.get('out/a.txt')).toEqual([{ oldText: null, newText: 'one\n' }])
    // Turn 2 chains the conversation history: both its own edits append.
    expect(turn2?.history.get('out/a.txt')).toEqual([
      { oldText: null, newText: 'one\n' },
      { oldText: 'one\n', newText: 'two\n' },
      { oldText: 'two\n', newText: 'three\nfour\n' },
    ])
    // turnHunks is per-turn: turn 1 has its single edit, turn 2 has only
    // the two edits made in that turn (no chaining).
    expect(turn1?.turnHunks.get('out/a.txt')).toEqual([{ oldText: null, newText: 'one\n' }])
    expect(turn2?.turnHunks.get('out/a.txt')).toEqual([
      { oldText: 'one\n', newText: 'two\n' },
      { oldText: 'two\n', newText: 'three\nfour\n' },
    ])
    expect(producedForClosing(turn2)).toEqual(['out/a.txt'])
    expect(selectProducedFiles(tailOwner(turn2, 10))).toEqual([
      {
        path: 'out/a.txt',
        hunks: turn2?.turnHunks.get('out/a.txt'),
        totalHunks: turn2?.history.get('out/a.txt'),
      },
    ])
  })
})

describe('diffStats', () => {
  it('counts the diff primitive rule: every side line, empty zero, trailing newline a terminator', () => {
    expect(diffStats([{ oldText: 'a\nb\n', newText: 'x\n' }])).toEqual({ added: 1, removed: 2 })
    expect(diffStats([{ oldText: null, newText: '' }])).toEqual({ added: 0, removed: 0 })
    expect(diffStats([{ oldText: 'only', newText: 'a\nb' }])).toEqual({ added: 2, removed: 1 })
    expect(diffStats([])).toEqual({ added: 0, removed: 0 })
    expect(diffStats([
      { oldText: 'x\n', newText: 'y\n' },
      { oldText: 'z\n', newText: 'w\n' },
    ])).toEqual({ added: 2, removed: 2 })
  })
})

describe('ProducedFiles row', () => {
  const t = makeTranslate(zh)
  const capability = (
    canOpenPath: boolean | undefined,
    isLoopback = true,
  ): Pick<ProducedFilesProps, 'isLoopback' | 'useHostDescription'> => {
    const description = canOpenPath === undefined
      ? undefined
      : { version: 'test', cwd: '/workspace', home: '/home', attachedSessions: 1, canOpenPath }
    return {
      isLoopback,
      useHostDescription: selector => selector(description),
    }
  }

  it('selects the largest prefix using the exact remainder width', () => {
    expect(fitProducedFiles(230, 8, [70, 60, 60], [55, 55, 55, 55])).toBe(2)
    expect(fitProducedFiles(145, 8, [70, 60, 60], [55, 55, 55, 55])).toBe(1)
    expect(fitProducedFiles(300, 8, [70, 60, 60], [55, 55, 55, 55])).toBe(3)
    // A zero-width lane is a pre-layout test/hidden state, not evidence that
    // every chip overflowed; keep the bounded initial prefix until measured.
    expect(fitProducedFiles(0, 8, [70, 60], [60, 50, undefined])).toBe(2)
    expect(fitProducedFiles(128, 8, [60, 60], [70, 50, undefined])).toBe(2)
    // Candidate-specific suffix widths matter at the 10 -> 9 digit boundary.
    expect(fitProducedFiles(126, 8, [60], [70, 50])).toBe(1)
    expect(fitProducedFiles(20, 8, [60], [70, 50])).toBe(0)
  })

  it('shows all chips up to the cap in a multi-line row, opens files, and shows the folder action', () => {
    const paths = ['deep/a.html', 'b.css', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts']
      .map(path => ({ path, hunks: [], totalHunks: [] }))
    const openFile = vi.fn<(path: string) => void>()
    const view = render(
      <ProducedFiles matched={paths} openFile={openFile} {...capability(true)} t={t} />,
    )
    expect(view.getByText('产物')).toBeTruthy()
    const row = view.container.querySelector('[data-produced-files-row]')
    if (!(row instanceof HTMLElement)) throw new Error('produced row missing')
    // All 7 chips fit below the SHOWN_LIMIT=30 cap.
    expect(within(row).getAllByRole('button')).toHaveLength(7)
    expect(within(row).queryByText('+')).toBeNull()
    const chip = view.getByRole('button', { name: '打开 deep/a.html' })
    expect(chip.textContent).toBe('a.html')
    expect(chip.getAttribute('title')).toBe('deep/a.html')
    fireEvent.click(chip)
    expect(openFile).toHaveBeenCalledWith('deep/a.html')

    // "show in folder" appears when there are produced files and the host
    // can open paths (no longer gated on overflow).
    const showFolder = view.getByRole('button', { name: '在文件夹中显示' })
    fireEvent.click(showFolder)
    expect(openFile).toHaveBeenLastCalledWith('.')
  })

  it('shows the conversation +/- totals next to the name and expands the change below the row', () => {
    const openFile = vi.fn<(path: string) => void>()
    const view = render(
      <ProducedFiles
        matched={[
          { path: 'out/a.ts', hunks: [{ oldText: 'one\n', newText: 'two\nthree\n' }], totalHunks: [{ oldText: 'one\n', newText: 'two\nthree\n' }] },
          { path: 'out/b.md', hunks: [], totalHunks: [] },
        ]}
        openFile={openFile}
        {...capability(false)}
        t={t}
      />,
    )
    const row = view.container.querySelector('[data-produced-files-row]')
    if (!(row instanceof HTMLElement)) throw new Error('produced row missing')
    // The changed file carries its conversation totals; the hunk-less one
    // stays a plain chip with no chevron.
    expect(within(row).getByText('+2')).toBeTruthy()
    expect(within(row).getByText('-1')).toBeTruthy()
    expect(within(row).queryByText('+0')).toBeNull()
    expect(view.queryByRole('button', { name: '展开 out/b.md 的修改内容' })).toBeNull()

    // The name still opens the file; the chevron expands the change.
    fireEvent.click(view.getByRole('button', { name: '打开 out/a.ts' }))
    expect(openFile).toHaveBeenCalledWith('out/a.ts')
    const toggle = view.getByRole('button', { name: '展开 out/a.ts 的修改内容' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    const panel = view.container.querySelector('[data-produced-diff]')
    if (!(panel instanceof HTMLElement)) throw new Error('produced diff panel missing')
    expect(within(panel).getByText('one')).toBeTruthy()
    expect(within(panel).getByText('two')).toBeTruthy()
    expect(within(panel).getByText('three')).toBeTruthy()
    // The panel is one card: a title bar carries the path (name + dimmed
    // directory), the totals, and its own collapse control; the primitive's
    // internal path header and footer stay off inside the panel.
    expect(within(panel).getByText('a.ts')).toBeTruthy()
    expect(within(panel).getByText('out')).toBeTruthy()
    expect(within(panel).getByText('+2')).toBeTruthy()
    expect(within(panel).getByText('-1')).toBeTruthy()
    expect(within(panel).queryByText('└ +2 -1 · 1 file')).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: '打开 out/a.ts' }))
    expect(openFile).toHaveBeenLastCalledWith('out/a.ts')
    fireEvent.click(within(panel).getByRole('button', { name: '收起修改面板' }))
    expect(view.container.querySelector('[data-produced-diff]')).toBeNull()
    // Reopening through the chip: the chip's control still collapses, and the
    // panel's path header names the expanded file.
    fireEvent.click(view.getByRole('button', { name: '展开 out/a.ts 的修改内容' }))
    const collapse = view.getByRole('button', { name: '收起 out/a.ts 的修改内容' })
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(collapse)
    expect(view.container.querySelector('[data-produced-diff]')).toBeNull()
  })

  it('opens a file by name while another chip stays expanded', () => {
    const openFile = vi.fn<(path: string) => void>()
    const view = render(
      <ProducedFiles
        matched={[
          { path: 'a.ts', hunks: [{ oldText: 'x\n', newText: 'y\n' }], totalHunks: [{ oldText: 'x\n', newText: 'y\n' }] },
          { path: 'b.ts', hunks: [{ oldText: 'u\n', newText: 'v\n' }], totalHunks: [{ oldText: 'u\n', newText: 'v\n' }] },
        ]}
        openFile={openFile}
        {...capability(false)}
        t={t}
      />,
    )
    fireEvent.click(view.getByRole('button', { name: '展开 a.ts 的修改内容' }))
    expect(view.container.querySelector('[data-produced-diff]')).not.toBeNull()
    // Opening a second chip's change moves the single expanded panel.
    fireEvent.click(view.getByRole('button', { name: '展开 b.ts 的修改内容' }))
    const panel = view.container.querySelector('[data-produced-diff]')
    if (!(panel instanceof HTMLElement)) throw new Error('produced diff panel missing')
    expect(within(panel).getByText('u')).toBeTruthy()
    expect(within(panel).queryByText('x')).toBeNull()
  })

  it('shows the folder action when files exist and the host supports it, absent otherwise', () => {
    const openFile = vi.fn<(path: string) => void>()
    const matches = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md']
      .map(path => ({ path, hunks: [], totalHunks: [] }))
    // Single file + capable host → folder action appears (unlike old
    // overflow-only gate).
    const view = render(
      <ProducedFiles matched={[matches[0]!]} openFile={openFile} {...capability(true)} t={t} />,
    )
    expect(view.queryByRole('button', { name: '在文件夹中显示' })).not.toBeNull()
    // Unavailable host capabilities still hide it.
    for (const unavailable of [capability(false), capability(true, false), capability(undefined)]) {
      view.rerender(<ProducedFiles matched={matches} openFile={openFile} {...unavailable} t={t} />)
      expect(view.queryByRole('button', { name: '在文件夹中显示' })).toBeNull()
    }
  })

  it('uses singular English copy when exactly one file is hidden beyond the cap', () => {
    // Need more than SHOWN_LIMIT (30) files to trigger the hidden count.
    const fileCount = 31
    const view = render(
      <ProducedFiles
        matched={Array.from({ length: fileCount }, (_, i) => ({
          path: `file-${i}.md`,
          hunks: [],
          totalHunks: [],
        }))}
        openFile={() => {}}
        {...capability(false)}
        t={makeTranslate(en)}
      />,
    )
    const row = view.container.querySelector('[data-produced-files-row]')
    if (!(row instanceof HTMLElement)) throw new Error('produced row missing')
    expect(within(row).getByText('+ 1 file')).toBeTruthy()
  })
})

describe('producedFileMentions resolver', () => {
  const label = (path: string) => `打开 ${path}`

  it('resolves exact paths and unique basenames; ambiguity and unknowns stay unresolved', () => {
    const opened: string[] = []
    const resolver = producedFileMentions(
      ['out/index.html', 'a/style.css', 'b/style.css'],
      (path) => { opened.push(path) },
      label,
    )
    // Unique basename resolves to its full path; the full path rides title.
    const byBasename = resolver.resolve('index.html')
    expect(byBasename?.label).toBe('打开 out/index.html')
    expect(byBasename?.title).toBe('out/index.html')
    byBasename?.open()
    expect(opened).toEqual(['out/index.html'])
    // An exact path resolves even when its basename is ambiguous.
    const exact = resolver.resolve('a/style.css')
    expect(exact?.title).toBe('a/style.css')
    // A basename two paths share stays unresolved rather than guessing,
    // and so does a token naming nothing the turn wrote.
    expect(resolver.resolve('style.css')).toBeUndefined()
    expect(resolver.resolve('notes.md')).toBeUndefined()
    expect(basename('a\\b\\c.txt')).toBe('c.txt')
    expect(dirname('a\\b\\c.txt')).toBe('a\\b')
    expect(dirname('flat.txt')).toBe('')
  })
})

describe('package shells', () => {
  it('the invariant companion registers ownership', async () => {
    const registered: string[] = []
    const ctx = new Context()
    ctx.provide('invariants')
    ctx.set('invariants', {
      register: (pkg: string) => { registered.push(pkg); return () => {} },
    } as never)
    const dispose = await applyInvariant(ctx)
    expect(registered).toEqual(['@deepseek-ai/dsh-client-ui-deliverables-custom'])
    expect(dispose).toBeTypeOf('function')
  })
})

describe('plugin registration', () => {
  it('registers the tail entry and fiber disposal removes it', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    await ctx.plugin(ConversationEventRegistry).await()
    // The owning view's child declaration, stood up by a bench root entry.
    ctx.slots.register({
      name: 'root',
      children: { 'conversation.chat.turnTail': { kind: 'chain', scope: 'session' } },
    } as never, () => null)
    const hostDescription = { getSnapshot: () => undefined, subscribe: () => () => {} }
    ctx.provide('connection', {
      api: { settings: {} },
      isLoopback: false,
      hostDescription,
    } as never)
    // ui-theme's Appearance row binds a durable scope through these two.
    ctx.provide('remote', { $on: () => () => {} } as never)
    ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
    await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()

    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const [entry] = ctx.slots.entries('conversation.chat.turnTail')
    expect(entry).toBeDefined()
    expect(entry?.inject?.()).toEqual({ isLoopback: false, hooks: { hostDescription } })

    // The prose face is live while the plugin is: a produced turn yields a
    // resolver whose matches open through the owner-supplied opener.
    const opened: string[] = []
    const owner = tailOwner(
      produced([2, 'site/report.html']),
      3,
      (path) => { opened.push(path) },
    )
    const service = (ctx as unknown as { get(name: string): ChatFileMentions | undefined }).get('chatFileMentions')
    const mentions = service?.forClosing(owner)
    mentions?.resolve('report.html')?.open()
    expect(opened).toEqual(['site/report.html'])
    // A turn that produced nothing yields no vocabulary at all.
    expect(service?.forClosing(tailOwner(undefined, 2))).toBeUndefined()

    await fiber.dispose()
    expect(ctx.slots.entries('conversation.chat.turnTail')).toHaveLength(0)
    // Fiber teardown retracts the service: the consumer's ctx.get sees the off state.
    expect((ctx as unknown as { get(name: string): unknown }).get('chatFileMentions')).toBeUndefined()
  })
})
