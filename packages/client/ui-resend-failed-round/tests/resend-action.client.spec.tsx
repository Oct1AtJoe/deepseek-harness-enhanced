// @vitest-environment jsdom
/**
 * ui-resend-failed-round browser half: the failed-round target derivation
 * and the strip entry's render/click behavior.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import { ResendAction, failedRoundTarget } from '../src/client/ResendAction.tsx'
import type { ResendActionProps } from '../src/client/slots.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

const mid = (id: string): MessageId => id as MessageId

const nodeMap = (entries: ReadonlyArray<readonly [string, object]>): ChatSnapshot['nodes'] =>
  new Map(entries.map(([k, v]) => [k, v])) as ChatSnapshot['nodes']

const snapshot = (
  order: readonly string[],
  map: ChatSnapshot['nodes'],
  running = false,
): ChatSnapshot => ({ chat: { order, nodes: map }, running }) as unknown as ChatSnapshot

const baseProps = (useSession: ResendActionProps['useSession']): ResendActionProps => ({
  messageId: mid('reply-1'),
  send: vi.fn(),
  t: (key: string) => key,
  useSession,
} as unknown as ResendActionProps)

describe('failedRoundTarget', () => {
  const user = { kind: 'user', seq: 1, time: 0, data: { content: [{ type: 'text', text: 'fix it' }] }, source: null }
  const assistant = (id: string | undefined) => ({
    kind: 'assistant', seq: 2, time: 0,
    data: id === undefined ? { status: 'settled', blocks: [] } : { status: 'settled', blocks: [], finalNode: { messageId: id } },
  })
  const turnError = { kind: 'turn-error', seq: 3, time: 0, turn: 1, step: 1, data: { message: 'boom' } }
  const maxTokens = { kind: 'turn-max-tokens', seq: 4, time: 0, turn: 1, step: 1, data: {} }

  it('returns the failed reply and its user text on a failed tail', () => {
    const target = failedRoundTarget(
      ['u', 'a', 'e'],
      nodeMap([['u', user], ['a', assistant('reply-1')], ['e', turnError]]),
      false,
    )
    expect(target).toEqual({ messageId: mid('reply-1'), text: 'fix it' })
  })

  it('treats turn-max-tokens as a failure', () => {
    const target = failedRoundTarget(
      ['u', 'a', 'm'],
      nodeMap([['u', user], ['a', assistant('reply-1')], ['m', maxTokens]]),
      false,
    )
    expect(target?.messageId).toBe(mid('reply-1'))
  })

  it('returns null while the session is running', () => {
    expect(failedRoundTarget(['u', 'a'], nodeMap([['u', user], ['a', assistant('reply-1')]]), true)).toBeNull()
  })

  it('returns null on a healthy tail', () => {
    expect(failedRoundTarget(['u', 'a'], nodeMap([['u', user], ['a', assistant('reply-ok')]]), false)).toBeNull()
  })

  it('returns null with no user message', () => {
    expect(failedRoundTarget(['a', 'e'], nodeMap([['a', assistant('reply-1')], ['e', turnError]]), false)).toBeNull()
  })

  it('returns null when the failed turn has no finalized reply', () => {
    expect(failedRoundTarget(['u', 'f', 'e'], nodeMap([['u', user], ['f', assistant(undefined)], ['e', turnError]]), false)).toBeNull()
  })

  it('concatenates multiple text blocks of the user message', () => {
    const multi = { ...user, data: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }
    const target = failedRoundTarget(['u', 'a', 'e'], nodeMap([['u', multi], ['a', assistant('reply-1')], ['e', turnError]]), false)
    expect(target?.text).toBe('ab')
  })
})

describe('ResendAction', () => {
  const user = { kind: 'user', seq: 1, time: 0, data: { content: [{ type: 'text', text: 'fix it' }] }, source: null }
  const assistant = {
    kind: 'assistant', seq: 2, time: 0,
    data: { status: 'settled', blocks: [], finalNode: { messageId: 'reply-1' } },
  }
  const turnError = { kind: 'turn-error', seq: 3, time: 0, turn: 1, step: 1, data: { message: 'boom' } }

  it('renders the refresh button on the failed reply and re-sends on click', () => {
    const map = nodeMap([['u', user], ['a', assistant], ['e', turnError]])
    const useSession = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'a', 'e'], map))) as never
    const send = vi.fn()
    render(<ResendAction {...baseProps(useSession)} send={send} messageId={mid('reply-1')} />)
    const button = screen.getByRole('button', { name: 'action.resend' })
    fireEvent.click(button)
    expect(send).toHaveBeenCalledWith('fix it')
  })

  it('renders nothing for a message that is not the failed reply', () => {
    const map = nodeMap([['u', user], ['a', assistant], ['e', turnError]])
    const useSession = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'a', 'e'], map))) as never
    const { container } = render(<ResendAction {...baseProps(useSession)} messageId={mid('other')} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while the session is running', () => {
    const map = nodeMap([['u', user], ['a', assistant]])
    const useSession = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'a'], map, true))) as never
    const { container } = render(<ResendAction {...baseProps(useSession)} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on a healthy tail', () => {
    const ok = { ...assistant, data: { status: 'settled', blocks: [], finalNode: { messageId: 'reply-ok' } } }
    const map = nodeMap([['u', user], ['a', ok]])
    const useSession = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot(['u', 'a'], map))) as never
    const { container } = render(<ResendAction {...baseProps(useSession)} messageId={mid('reply-ok')} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('locales', () => {
  it('keeps the en dictionary complete against zh', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})
