/**
 * Unit tests for the result-time diff computation (`src/diff.ts`):
 * the pure before/after → {@link FileDiff}[] hunk builder and the defensive
 * `meta` narrowing. These pin the exact hunk reconstruction (change-only lines,
 * multi-hunk replaceAll, pure insertion/deletion, no-op) that UIs render.
 */

import { describe, expect, it } from 'vitest'
import { computeHunkDiffs, diffsFromMeta } from '../src/diff.ts'
import type { JsonValue } from '@deepseek-ai/dsh-session'

const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line${i + 1}`).join('\n') + '\n'

describe('computeHunkDiffs', () => {
  it('a single-line change yields one hunk with only the change lines', () => {
    const before = lines(8)
    const after = before.replace('line4', 'CHANGED')
    const diffs = computeHunkDiffs('f.txt', before, after)
    expect(diffs).toEqual([{
      path: 'f.txt',
      oldText: 'line4',
      newText: 'CHANGED',
    }])
  })

  it('a scattered replace_all yields one FileDiff PER hunk (matching per-site editor blocks)', () => {
    const before = lines(20)
    const after = before.replace('line3', 'A').replace('line16', 'B')
    const diffs = computeHunkDiffs('f.txt', before, after)
    expect(diffs).toHaveLength(2)
    expect(diffs[0]?.path).toBe('f.txt')
    expect(diffs[0]?.oldText).toBe('line3')
    expect(diffs[0]?.newText).toBe('A')
    expect(diffs[1]?.oldText).toBe('line16')
    expect(diffs[1]?.newText).toBe('B')
    // The two hunks are distinct sites, not one merged block.
    expect(diffs[0]?.newText).not.toContain('B')
    expect(diffs[1]?.newText).not.toContain('A')
  })

  it('identical before/after (a no-op) yields no hunks', () => {
    expect(computeHunkDiffs('f.txt', 'same\n', 'same\n')).toEqual([])
  })

  it('a pure insertion into empty content reports oldText null (nothing to diff against)', () => {
    const diffs = computeHunkDiffs('f.txt', '', 'brand new\n')
    expect(diffs).toEqual([{ path: 'f.txt', oldText: null, newText: 'brand new' }])
  })

  it('a pure deletion of the whole file reports newText empty', () => {
    const diffs = computeHunkDiffs('f.txt', 'gone\n', '')
    expect(diffs).toEqual([{ path: 'f.txt', oldText: 'gone', newText: '' }])
  })

  it('drops the "\\ No newline at end of file" marker from a no-trailing-newline change', () => {
    const diffs = computeHunkDiffs('f.txt', 'x', 'y')
    // The marker line (starting with "\\") must never leak into a diff block.
    expect(diffs).toEqual([{ path: 'f.txt', oldText: 'x', newText: 'y' }])
    expect(diffs[0]?.oldText).not.toContain('\\')
    expect(diffs[0]?.newText).not.toContain('\\')
  })

  it('carries no surrounding context lines (a UI counts +A -R from the texts directly)', () => {
    const before = lines(20)
    const after = before.replace('line10', 'CHANGED')
    const [diff] = computeHunkDiffs('f.txt', before, after)
    // The hunk is the change alone: no context above or below rides along.
    expect(diff?.oldText).toBe('line10')
    expect(diff?.newText).toBe('CHANGED')
  })
})

describe('diffsFromMeta (defensive narrowing)', () => {
  // The narrowing accepts an opaque JsonValue; a malformed payload is not a
  // statically-valid JsonValue, so route every case through one cast helper that
  // mirrors how a hand-edited/older session log delivers arbitrary shapes.
  const m = (value: unknown): JsonValue | undefined => value as JsonValue | undefined
  const good = { diffs: [{ path: 'f.txt', oldText: 'a', newText: 'b' }] }

  it('narrows a well-formed { diffs } payload', () => {
    expect(diffsFromMeta(m(good))).toEqual(good.diffs)
  })

  it('accepts a diff whose oldText is null (a create-style hunk)', () => {
    const meta = { diffs: [{ path: 'f.txt', oldText: null, newText: 'x' }] }
    expect(diffsFromMeta(m(meta))).toEqual(meta.diffs)
  })

  it('rejects undefined / non-object / array meta', () => {
    expect(diffsFromMeta(undefined)).toBeUndefined()
    expect(diffsFromMeta(null)).toBeUndefined()
    expect(diffsFromMeta(m('nope'))).toBeUndefined()
    expect(diffsFromMeta(m([]))).toBeUndefined()
  })

  it('rejects a missing / empty / non-array diffs field', () => {
    expect(diffsFromMeta(m({}))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: 'x' }))).toBeUndefined()
  })

  it('rejects a diffs array containing a malformed entry', () => {
    expect(diffsFromMeta(m({ diffs: [{ path: 'f.txt', oldText: 'a' }] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [{ path: 1, oldText: 'a', newText: 'b' }] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [{ path: 'f', oldText: 5, newText: 'b' }] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [{ path: 'f', oldText: 'a', newText: 7 }] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [null] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: ['x'] }))).toBeUndefined()
    expect(diffsFromMeta(m({ diffs: [[]] }))).toBeUndefined()
  })
})
