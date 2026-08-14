// @vitest-environment jsdom
/**
 * ui-resend-failed-round browser half: the failed-round target derivation
 * and the turn-tail entry's render/click behavior.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { ResendAction, failedRoundTarget } from '../src/client/ResendAction.tsx'
import type { ResendActionProps } from '../src/client/slots.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

const nodeMap = (entries: ReadonlyArray<readonly [string, object]>): ChatSnapshot['nodes'] =>
  new Map(entries.map(([k, v]) => [k, v])) as unknown as ChatSnapshot['nodes']

const snapshot = (
  order: readonly string[],
  map: ChatSnapshot['nodes'],
  running = false,
): ChatSnapshot => ({ chat: { order, nodes: map }, running }) as unknown as ChatSnapshot

const ownerTurn = (turn: number) => ({ turn }) as unknown as ResendActionProps['turn']

const baseProps = (useChat: ResendActionProps['useChat'], turn = 1): ResendActionProps => ({
  turn: ownerTurn(turn),
  seq: 99,
  openFile: () => {},
  send: vi.fn(),
  t: (key: string) => key,
  useChat,
} as unknown as ResendActionProps)

describe('failedRoundTarget', () => {
  const user = { kind: 'user', seq: 1, time: 0, data: { content: [{ type: 'text', text: 'fix it' }] }, source: null }
  const turnError = { kind: 'turn-error', seq: 3, time: 0, turn: 5, step: 1, data: { message: 'boom', turn: 5 } }
  const maxTokens = { kind: 'turn-max-tokens', seq: 4, time: 0, turn: 6, step: 1, data: { turn: 6 } }

  it('returns the failed turn and its user text on a failed tail', () => {
    const target = failedRoundTarget(
      ['u', 'e'],
      nodeMap([['u', user], ['e', turnError]]),
      false,
    )
    expect(target).toEqual({ turn: 5, text: 'fix it' })
  })

  it('treats turn-max-tokens as a failure', () => {
    const target = failedRoundTarget(
      ['u', 'm'],
      nodeMap([['u', user], ['m', maxTokens]]),
      false,
    )
    expect(target?.turn).toBe(6)
  })

  it('returns null while the session is running', () => {
    expect(failedRoundTarget(['u', 'e'], nodeMap([['u', user], ['e', turnError]]), true)).toBeNull()
  })

  it('returns null on a healthy tail', () => {
    const ok = { kind: 'assistant', seq: 2, time: 0, data: { status: 'settled', blocks: [] } }
    expect(failedRoundTarget(['u', 'a'], nodeMap([['u', user], ['a', ok]]), false)).toBeNull()
  })

  it('returns null with no user message', () => {
    expect(failedRoundTarget(['e'], nodeMap([['e', turnError]]), false)).toBeNull()
  })

  it('returns the LAST failed turn', () => {
    const user2 = { ...user, seq: 5, data: { content: [{ type: 'text', text: 'again' }] } }
    const err2 = { ...turnError, seq: 6, turn: 7, data: { turn: 7 } }
    const target = failedRoundTarget(
      ['u1', 'e1', 'u2', 'e2'],
      nodeMap([['u1', user], ['e1', turnError], ['u2', user2], ['e2', err2]]),
      false,
    )
    expect(target).toEqual({ turn: 7, text: 'again' })
  })

  it('concatenates multiple text blocks of the user message', () => {
    const multi = { ...user, data: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }
    const target = failedRoundTarget(['u', 'e'], nodeMap([['u', multi], ['e', turnError]]), false)
    expect(target?.text).toBe('ab')
  })
})

describe('ResendAction', () => {
  const user = { kind: 'user', seq: 1, time: 0, data: { content: [{ type: 'text', text: 'fix it' }] }, source: null }
  const turnError = { kind: 'turn-error', seq: 3, time: 0, turn: 1, step: 1, data: { message: 'boom', turn: 1 } }

  it('renders the re-run button on the failed turn and re-sends on click', () => {
    const map = nodeMap([['u', user], ['e', turnError]])
    const useChat = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'e'], map))) as never
    const send = vi.fn()
    render(<ResendAction {...baseProps(useChat, 1)} send={send} />)
    const button = screen.getByRole('button', { name: 'action.resend' })
    fireEvent.click(button)
    expect(send).toHaveBeenCalledWith('fix it')
  })

  it('renders nothing for a healthy turn', () => {
    const ok = { kind: 'assistant', seq: 2, time: 0, data: { status: 'settled', blocks: [] } }
    const map = nodeMap([['u', user], ['a', ok]])
    const useChat = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'a'], map))) as never
    const { container } = render(<ResendAction {...baseProps(useChat, 1)} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while the session is running', () => {
    const map = nodeMap([['u', user], ['e', turnError]])
    const useChat = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'e'], map, true))) as never
    const { container } = render(<ResendAction {...baseProps(useChat, 1)} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a turn that is not the failed one', () => {
    const map = nodeMap([['u', user], ['e', turnError]])
    const useChat = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'e'], map))) as never
    const { container } = render(<ResendAction {...baseProps(useChat, 2)} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('locales', () => {
  it('keeps the en dictionary complete against zh', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})
