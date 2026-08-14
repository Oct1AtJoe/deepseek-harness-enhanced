# @deepseek-ai/dsh-client-ui-resend-failed-round

English | [中文](README.zh.md)

Failed-round re-run action for the Web chat (local customization plugin).
The browser half registers one entry into the official
`conversation.chat.assistant-actions` strip: a refresh button on the assistant
reply of the last turn that ended terminally (turn-error or turn-max-tokens).
Clicking re-sends the failed round's user text as a new queued turn through
the session-scoped conversation service.

## Model Experience

No model-visible input: the action re-sends a previously logged user message
through the ordinary prompt admission path, so no new session event exists.
The button is a pure presentation affordance over the existing chat node
store.

## Registration

Mounted from the user profile patch (`~/.dsh/profiles/web/cordis.patch.yml`)
as a `dsh.client` row. The node half is an empty apply; the browser half
contributes the strip entry and the `resend` locale namespace.

## Known Limitations and Deferred Work

- The button renders on the **assistant** reply's action strip (the official
  strip has no user-message seat); the original local implementation placed
  it under the user message.
- Re-send replays plain text only; images are not replayed.
