# @deepseek-ai/dsh-client-ui-resend-failed-round

[English](README.md) | 中文

失败轮重发动作（本地定制插件）。浏览器侧向官方 `conversation.chat.assistant-actions` 操作条注册一个条目：在最后一个以失败终结（turn-error / turn-max-tokens）的轮次的助手回复上显示刷新按钮；点击后通过会话作用域的 conversation 服务将失败轮的用户文本作为新的排队轮次重新发送。

## 挂载

作为 `dsh.client` 行从用户 profile patch（`~/.dsh/profiles/web/cordis.patch.yml`）挂载。node half 为空 apply；浏览器侧贡献操作条条目与 `resend` 语言命名空间。

## 模型体验

间接经由会话作用域的 conversation 服务，它把失败轮已记录的用户文本作为新的排队轮次重新发送。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与待办

- 按钮渲染在**助手**回复的操作条上（官方操作条没有用户消息席位）；原始本地实现位于用户消息下方。
- 重发仅重放纯文本；图片不重放。
