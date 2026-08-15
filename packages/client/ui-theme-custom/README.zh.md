# @deepseek-ai/dsh-client-ui-theme-custom

[English](README.md) | 中文

Web GUI 的极光（aurora）与星云（nebula）科技主题，注册到官方 [`dsh-client-ui-theme`](../ui-theme/README.md) 主题注册表。浏览器插件注入主题服务并调用 `ctx.theme.register(...)` 注册两个定义；注册表快照随后驱动「外观」行的色块与 presenter，与内置主题对完全一致。

本包携带移入的主题 token 文件（`aurora.ts`、`nebula.ts` —— nebula 含液态玻璃表面 token、渐变/光晕按钮与漂移动画），以运行时 style 元素注入 nebula 运动 token 引用的 `dsh-button-drift` keyframes，并注册自己的设置行（`settings.general.item`，id `appearance-custom`）承载两个主题色块——官方外观行保持只有 light/dark/system。它依赖官方 ui-theme 的扩展面：`THEME_PREFERENCES` 包含这两个 id（选择经官方设置 scope 持久化）、`boot-theme.ts` 在激活前把它们映射到深色调色板。官方组件样式表里的 `var(--dsw-alias-...)` 兜底消费规则在这些主题缺席时是惰性的。

## 模型体验

无任何模型侧请求：本插件只向浏览器主题注册表注册 CSS token 集。它不发起提示词、工具、消息或 provider 请求，也不触碰会话日志。

#### KV 缓存影响

无 —— 不组装任何模型输入。

## 已知限制与待办

- **挂载耦合**：科技主题设置行假定本插件已挂载；未挂载时 aurora/nebula 色块不出现（官方行从不引用自定义 id），已持久化的 `aurora`/`nebula` 偏好将无法选择。
- **启动闪现**：主题在客户端插件激活后生效；缺少上述扩展面时官方启动脚本只覆盖 `light`/`dark`/`system`。
