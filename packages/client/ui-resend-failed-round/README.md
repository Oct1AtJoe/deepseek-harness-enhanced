# @deepseek-ai/dsh-client-ui-resend-failed-round

English | [中文](README.zh.md)

Failed-round re-run action for the Web chat (local customization plugin). The browser half registers one entry into the official `conversation.chat.assistant-actions` strip: a refresh button on the assistant reply of the last turn that ended terminally (turn-error or turn-max-tokens). Clicking re-sends the failed round's user text as a new queued turn through the session-scoped conversation service.

## Registration

Mounted from the user profile patch (`~/.dsh/profiles/web/cordis.patch.yml`) as a `dsh.client` row. The node half is an empty apply; the browser half contributes the strip entry and the `resend` locale namespace.

## Model Experience

Indirectly, through the session-scoped conversation service, which re-sends the failed round's logged user text as a new queued turn.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The button renders on the **assistant** reply's action strip (the official strip has no user-message seat); the original local implementation placed it under the user message.
- Re-send replays plain text only; images are not replayed.
