/**
 * Host session-reference surface: session.referenceCandidates over the
 * resolver, and session.prompt mention normalization — stripping canonical
 * `dsh-session:` mentions into readable content, preparing bounded snapshots,
 * injecting them into the same model step, and refusing the prompt before
 * enqueue on any resolver failure.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { LlmModelInfo, LlmProviderInfo, StreamChunk, UserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { SessionId as SessionIdBrand } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import {
  SessionReferenceError,
  encodeSessionReferenceUri,
} from '@deepseek-ai/dsh-session-reference'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`ref-${String(nextRpc++)}`), payload }
}

class Adapter extends LlmAdapter {
  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider }
  }

  override listModels(): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([])
  }

  override stream(): AsyncIterable<StreamChunk> {
    return (async function* () { })()
  }
}

async function harness(): Promise<{
  ctx: Context
  agent: Agent
  sessionId: SessionId
  followup: ReturnType<typeof vi.fn>
  steer: ReturnType<typeof vi.fn>
  inject: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  ctx.llm.registerAdapter(['deepseek-official'], new Adapter())
  const session = ctx.sessions.create()
  const followup = vi.fn()
  const steer = vi.fn()
  const inject = vi.fn()
  const agent = {
    id: session.id,
    session,
    status: 'running',
    ctx,
    inbox: { nextTurn: [], nextStep: [] },
    followup,
    steer,
    inject,
  } as unknown as Agent
  ctx.agents.register(agent)
  return { ctx, agent, sessionId: session.id, followup, steer, inject }
}

const mention = (id: string, label: string): string => `@[${label}](${encodeSessionReferenceUri(SessionIdBrand(id))})`

describe('session.referenceCandidates', () => {
  it('lists resolver candidates for the session agent', async () => {
    const { ctx, sessionId } = await harness()
    const listCandidates = vi.fn((_sessionId: SessionId, _query: string, _limit: number) => Promise.resolve([
      { sessionId: 'session-other', label: 'Other work', cwd: '/other', createdAt: 1 },
    ]))
    ctx.provide('sessionReferenceResolver', { listCandidates } as never)
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.referenceCandidates(request({
      sessionId,
      query: 'oth',
      limit: 5,
    }), new AbortController().signal)
    expect(result.result.ok).toBe(true)
    if (!result.result.ok) return
    expect(result.result.value).toEqual({
      candidates: [{ sessionId: 'session-other', label: 'Other work', cwd: '/other', createdAt: 1 }],
    })
    expect(listCandidates.mock.calls[0]?.[1]).toBe('oth')
    expect(listCandidates.mock.calls[0]?.[2]).toBe(5)
  })

  it('fails with session-reference-failed when the resolver is absent', async () => {
    const { ctx, sessionId } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.referenceCandidates(request({ sessionId }), new AbortController().signal)
    expect(result.result).toMatchObject({ ok: false, error: { code: 'session-reference-failed' } })
  })
})

describe('session.prompt mention normalization', () => {
  it('strips the mention, prepares the snapshot, and injects it with the same step', async () => {
    const { ctx, sessionId, followup, inject } = await harness()
    const context = {
      role: 'user',
      source: { kind: 'session-reference', form: 'recall', version: 1, references: [] },
      content: [{ type: 'text', text: '## Referenced sessions\n...' }],
    } as unknown as UserMessage
    const prepare = vi.fn((_sessionId: SessionId, _content: unknown, _references: unknown) => Promise.resolve({
      content: [{ type: 'text', text: '看下 @Other 的内容' }],
      additionalContext: context,
    }))
    ctx.provide('sessionReferenceResolver', { prepare } as never)
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'text', text: `看下 ${mention('session-other', 'Other')} 的内容` }],
    }))
    expect(result.result.ok).toBe(true)
    expect(prepare.mock.calls[0]?.[1]).toEqual([{ type: 'text', text: '看下 @Other 的内容' }])
    expect(prepare.mock.calls[0]?.[2]).toEqual([
      { sessionId: 'session-other', label: 'Other' },
    ])
    expect(followup.mock.calls[0]?.[0]?.content).toEqual([{ type: 'text', text: '看下 @Other 的内容' }])
    expect(inject.mock.calls[0]?.[0]).toBe(context)
  })

  it('passes text without mentions through untouched', async () => {
    const { ctx, sessionId, followup, inject } = await harness()
    const prepare = vi.fn()
    ctx.provide('sessionReferenceResolver', { prepare } as never)
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'text', text: 'plain message' }],
    }))
    expect(result.result.ok).toBe(true)
    expect(prepare).not.toHaveBeenCalled()
    expect(followup.mock.calls[0]?.[0]?.content).toEqual([{ type: 'text', text: 'plain message' }])
    expect(inject).not.toHaveBeenCalled()
  })

  it('refuses the prompt when the resolver is absent', async () => {
    const { ctx, sessionId, followup } = await harness()
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'text', text: `${mention('session-other', 'Other')} hi` }],
    }))
    expect(result.result).toMatchObject({ ok: false, error: { code: 'session-reference-failed' } })
    expect(followup).not.toHaveBeenCalled()
  })

  it('refuses the prompt when preparation fails', async () => {
    const { ctx, sessionId, followup } = await harness()
    const prepare = vi.fn(() => Promise.reject(
      new SessionReferenceError('source log is gone', 'SESSION_REFERENCE_READ_FAILED'),
    ))
    ctx.provide('sessionReferenceResolver', { prepare } as never)
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    const result = await api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'text', text: `${mention('session-other', 'Other')} hi` }],
    }))
    expect(result.result).toMatchObject({
      ok: false,
      error: { code: 'session-reference-failed', message: 'session reference rejected: source log is gone' },
    })
    expect(followup).not.toHaveBeenCalled()
  })

  it('refuses the prompt on malformed mention text', async () => {
    const { ctx, sessionId, followup } = await harness()
    ctx.provide('sessionReferenceResolver', { prepare: vi.fn() } as never)
    const api = createApiProxy(ctx, {
      defaultModelSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-chat' }),
      cwd: '/tmp',
    })
    // A bare URI whose payload decodes to a non-string JSON value is malformed.
    const bad = `dsh-session:${Buffer.from('123', 'utf8').toString('base64url')}`
    const result = await api.sessions.prompt(request({
      sessionId,
      mode: 'queue' as const,
      content: [{ type: 'text', text: `${bad} hi` }],
    }))
    expect(result.result).toMatchObject({ ok: false, error: { code: 'session-reference-failed' } })
    expect(followup).not.toHaveBeenCalled()
  })
})
