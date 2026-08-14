# @deepseek-ai/dsh-client-ui-session-reference

[English](README.md) | 中文

Web 端会话引用 `@` 来源：面向输入区的跨工作区会话提及。

输入 `@` 会打开触发菜单，`session` 分组置顶；候选来自 `session.referenceCandidates` RPC——除调用会话外的每个逻辑会话，按工作目录亲缘度排序，因此其他工作区的会话与本地会话一样可选。选中后插入一个引用项，其模型形态为标准提及 `@[label](dsh-session:…)`。宿主提示词边界（`@deepseek-ai/dsh-host-apiproxy`）把提及剥成可读内容，并通过 `ctx.sessionReferenceResolver`（`@deepseek-ai/dsh-session-reference`）把被引用会话的有界只读快照注入同一模型步骤。

## 架构

- **Node 侧**（`src/index.ts`）：空实现——纯 UI 插件，仅为 Loader 可见而存在。
- **浏览器侧**（`src/client/index.ts`）：`@` 输入触发源，带 `ReferenceCodec`（剪贴板投影 `@label`，模型序列化 `@[label](dsh-session:…)`）。
- **宿主**：`@deepseek-ai/dsh-host-apiproxy` 拥有提及解析（`parseSessionReferenceText`）、快照准备与注入；`@deepseek-ai/dsh-bundle-web-app` 挂载两行配置。

## 模型体验

间接经由宿主提示词边界（`@deepseek-ai/dsh-host-apiproxy`），它把提及解析为可读内容，并把被引用会话的只读快照注入同一模型步骤。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与待办

- 候选按每次按键拉取；语料量极大的部署应重新考虑缓存（解析器按其候选上限截断结果）。
- 剪切/复制 chip 会重新插入剪贴板投影（`@label`），它是纯文本而非新的引用项。
