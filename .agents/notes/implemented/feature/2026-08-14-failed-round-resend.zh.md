# Agent Note: 失败轮次重新发起——用户气泡上的「重新发起」动作

Status: implemented

[English](2026-08-14-failed-round-resend.md) | 中文

## 问题

当一轮以终止性失败收场（`turn/end` 带 error 原因）或撞上输出 token 上限时，对话流里只显示失败提示，没有任何重试这一轮的办法。输入区只会发送用户接下来打的内容；想重试只能手动重打或复制粘贴原消息。用户气泡的动作行已有复制按钮（assistant 回答下还有分支按钮）；[被删除的编辑占位按钮](../simplification/2026-07-31-drop-user-message-edit-stub.zh.md) 说明这一行本就是逐消息动作的既定位置，但没有任何控件能重新发起失败的这一轮。

## 决策

最后一轮失败的用户消息，其复制按钮旁多一个「重新发起」图标按钮。点击后通过既有的 `IConversation.send` 通道把该消息的纯文本作为排队轮次重新发送——与输入区用的同一个 `session.prompt([{ type: 'text', text }], 'queue')`——因此重试语义（忙时排队、`promptError` 报错条）与一次全新发送完全一致。

### 资格推导，视图本地完成

`ChatView` 用 `useMemo` 在稳定的 chat `order` 与实时节点 store 上推导重发目标：顺序扫过可见节点，记住最后一个 `user` 节点（及其纯文本），若其后出现 `turn-error` 或 `turn-max-tokens` 节点则标记失败。后面再有新用户消息会重置标记，因此该动作只会指向真正最后失败的那一轮。扫描是 O(n) 的，且 order 只在行进出/移动时变化，内容增量不会触发重算。`running` 时隐藏动作：运行中的轮次不是已死的轮次，而且重发后立即隐藏本身就是重试已开始的点击反馈。

### 沿用既有 slot 契约打通链路

`ChatViewInjected` 新增 `resend(text)`，在 `apply.ts` 里实现为 `scoped.send(text)` 并吞掉拒绝（发送失败本来就会通过会话的 `promptError` 报错条呈现）。`ChatNodeOwnerProps` 新增可选 `onResend` 回调；`ChatNodeSeat` 从 `ChatView` 透传（按目标 key 缓存的稳定 `useCallback`，只有命中座位会重渲染），`UserMessageNodeView` 把它交给 `MessageIconActions`，在复制按钮与 extra-actions 座位之间渲染刷新图标（`IconRefreshOutline16`，ui-primitives 已有）加 `message.resend` 提示。不新增 snapshot 字段、不新增节点种类、不改运行时契约：推导纯粹是基于既有数据的呈现层逻辑。

### 范围限制

只重发纯文本——原消息里的图片块不会重放（与队列编辑器对非文本内容既有的「不可编辑」限制一致）。动作只针对最后一个失败轮次：旧失败之后又来了新用户消息就不再合格，符合「重新发起这一轮」而不是任意重放。`model-retry` 链会把 `turn-error` 节点压成隐藏态，所以自动重试进行中不会出现手动重发按钮——那一轮已由 host 侧的重试接管。

## 备选方案

- **按 turn 号关联** —— `TurnErrorNode` 带 turn，但 `UserMessageNode` 不带，且 `user/message` 事件落在轮次 location 之外；按顺序定位是唯一可靠的关联方式，也比改造 location 索引便宜。
- **走输入机重发** —— 输入机持有草稿状态与提交手势；消息动作需要直接发送，`IConversation.send` 已提供，无需碰草稿持久化。
- **包含图片块** —— 持久化附件本可重新引用，但队列编辑器已拒绝非文本编辑，且刷新后重传浏览器草稿是另一个特性；只发文本与既有限制一致。
- **每个失败用户消息都显示** —— 重发对话中段的旧轮次会在更新的上下文之后追加一条重复轮次；只允许最后失败轮次让动作语义无歧义。

## 影响

失败轮次的恢复路径不再依赖用户手动重打消息；动作就出现在该轮自己的消息下方，天然可发现。由于重发走 `IConversation.send`，既有发送语义（排队模式、`promptError` 失败呈现、blank 会话翻转）原样生效。推导在视图层完成，不新增 snapshot 面，回放与窗口重建不受影响；keyless replay web e2e 与 `chat-view`/`apply-inject` spec 钉住了行为（`turn-error` 与 `turn-max-tokens` 尾部有按钮、健康尾部无按钮、新用户消息后或运行中消失、以及经 inject 面重发的确切文本）。
