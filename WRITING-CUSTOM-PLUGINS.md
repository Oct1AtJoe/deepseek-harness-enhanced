# 手写 DSH 内置插件：从包解剖到挂载的全流程

> 以 `ui-subagent-custom`（`packages/client/ui-subagent-custom/`）为完整范例。以后要手写"类似的内置插件"（给 Web GUI 加常驻 UI/行为），照这份流程走，不用再摸索。
> 相关背景见 [CUSTOM-FEATURES.md](CUSTOM-FEATURES.md)；官方包规范见 `packages/AGENTS.md` 与 `packages/client/AGENTS.md`。

---

## 0. 先分清三种"插件"，别走错路

| 形态 | 本质 | 生命周期 | 适用 |
|---|---|---|---|
| **内置静态插件包**（本文主路径） | 仓库里真实 npm workspace 包（`packages/…`），host/client 双半，随 web-app bundle 分发，代码进 git | 持久，跨机器 clone 即用 | 给 GUI 加常驻 UI/行为，如 ui-subagent-custom |
| **动态 Cordis 插件** | 会话内 `cordis_define`/`cordis_run` 定义的运行时插件 | 只存活于当前进程，重启即失 | 一次性运行时扩展、临时调试 |
| **Agent preset** | `~/.dsh/.agent-presets/<id>/agent.cordis.yml` 组合文件 | 持久（用户级目录） | 改某个 agent 的工具集/人设/提示词段落 |

`ui-subagent-custom` 属于第一类，且是 **client（浏览器）半**：宿主半 `apply()` 为空，只为让包出现在 cordis.yml；真正的行为都在 `src/client/`，经 `exports["./client"]` + `dsh.client` 清单被浏览器加载。

**决策：目标是给 Web GUI 加常驻 UI/行为 → 走本文路径。** 只改当前会话、不落盘的临时扩展 → 动态插件；改 agent 能力 → preset。

---

## 1. 范例解剖：`ui-subagent-custom` 做了什么

- **是什么**：官方 `@deepseek-ai/dsh-client-ui-subagent` 的**本地定制 fork**。官方包零改动（git 已还原），fork 出一个新包替代挂载 → 上游同步零冲突。
- **注册面**（`src/client/index.ts` 的 `apply(ctx)`）：
  1. `ctx.inputTriggers.registerSource(...)` — 注册 `@` 引用源，候选来自根会话列表快照的运行中子代理（零 RPC）；
  2. `ctx.slots.inject('conversation.session.header.actions', …)` — 页头目录按钮/树 `SubagentCatalogAction`；
  3. `ctx.slots.inject('conversation.composer', …)` — 只读编辑器 `SubagentReadOnlyComposer`（one-shot / 父会话离线）；
  4. `ctx.slots.inject('conversation.input.right', …)` — 输入区计数按钮 `SubagentComposerAction`，点击经**可选服务** `ctx.get('betterSidebar')?.openTab({type:'subagent', pane:'right'})` 打开侧边栏 tab。
- **与官方的差异**：删掉 `conversation.view` 顶部 tab（`SubagentWorkView.tsx` 移除）；输入区按钮 inject 契约 `setView` → `openSubagentTab`。看差异直接对比 `src/client/` 文件清单（官方 6 个文件，custom 8 个文件，多出 `SubagentComposerAction.{tsx,module.css}`）。

---

## 2. 包解剖（逐文件模板，复制即用）

新包放 `packages/client/<name>/`，包名 `@deepseek-ai/dsh-client-<name>`。目录结构：

```
packages/client/<name>/
├── src/
│   ├── index.ts                      # host 半：空 apply()，仅占位
│   ├── client/
│   │   ├── index.ts                  # 浏览器入口：apply(ctx) 注册源/slot
│   │   ├── <Component>.tsx + .module.css  # React 组件（纯 props）
│   │   └── locales.ts                # NS + zh/en 词典 + SubagentKey 类型
│   ├── invariant.ts                  # invariant 伴随包
│   └── css-modules.d.ts              # 用 CSS Modules 时需要
├── tests/*.client.spec.ts(x)         # 组件/行为契约测试（jsdom pragma）
├── package.json
├── tsconfig.json                     # extends tsconfig.base.client.json
├── tsdown.config.ts
└── README.md / README.zh.md / README.i18n.yaml
```

### 关键文件骨架

**`src/index.ts`（host 半）** — 纯 UI 插件时 `apply` 为空，存在意义是让包出现在 host 的 cordis.yml / Loader：

```ts
export function apply(): void {}
```

**`src/client/index.ts`（浏览器半）** — 导出的 `inject` 是 apply 依赖的**服务**（cordis 按服务等待激活顺序，非加载顺序）：

```ts
export const inject = ['inputTriggers', 'sessions', 'slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '<pkg>: dictionaries')
  // 注册进别的包的 slot：用 ctx.slots.inject，等待真实声明，声明坍缩时自动移除
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: '<entry-id>',
    order: 10,
    locale: NS,
    inject: (_sessionId: SessionId): <InjectedFace> => ({ ... }), // 纯数据/回调
  }, <Component>))
  // 可选服务：ctx.get(name)，缺席时优雅降级
  const betterSidebar = ctx.get('betterSidebar')
  betterSidebar?.openTab(...)
}
```

**组件**：props 只由四份 share 派生（`PropsRuntime` & `PropsRenderSlots` & `PropsStore` & inject 面），组件绝不碰 `ctx`、不手写 hook、不订阅外部快照。数据走框架钩子（`useSessions`/`useSession`/`useStore`/`renderSlot`）或注册时声明的 `createXXXStore()`。

**`src/client/locales.ts`**：`zh` 是 key 源（`as const`），`en: Record<SubagentKey, string>` 键完全一致，`export type SubagentKey = keyof typeof zh`。`NS` 命名空间在 `dsh-client-ui-slots` 的 `LocaleNamespaceMap` 上 `declare module` 扩展。

**`src/invariant.ts`**：伴随包，注册包名所有权。**fork 时记得改内部引用**（见第 6 节）。

**`package.json`** — 结构固定：

```json
{
  "name": "@deepseek-ai/dsh-client-<name>",
  "type": "module",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./invariant": { "types": "./lib/types/invariant.d.ts", "default": "./lib/invariant.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "dsh": { "client": { "inject": [ "<依赖包名>…" ], "platform": "web" } },
  "files": ["lib/index.js", "lib/invariant.js", "lib/client.js", "lib/types/**/*.d.ts"]
}
```

`dsh.client.inject` 列出包级依赖边，**仅信息性**（preflight 展示 / HMR diff），不决定激活顺序。`platform: 'web'` 恒定。

**`tsconfig.json`**：extends `tsconfig.base.client.json`，`rootDir: src` / `outDir: lib/types`，`references` 列每个 workspace 依赖 + `runtime-diagnostics/invariants`。

**`tsdown.config.ts`**：

```ts
import { clientBundle } from '../tsdown.client.ts'
export default clientBundle('@deepseek-ai/dsh-client-<name>', ['lib/types/index.js', 'lib/types/invariant.js'])
```

---

## 3. 四处登记：缺一不可，缺哪个都在不同阶段炸

1. **`tsconfig.client.json`** — aggregate `references` 加 `{ "path": "./packages/client/<name>" }`。
2. **`tsconfig.base.json`** — `paths` 加 `"@deepseek-ai/dsh-client-<name>": ["./packages/client/<name>/src"]`（源码 import 解析）。
3. **`packages/bundle/web-app/cordis.patch.yml`** — **fork 时：先 `- id: <官方>, disabled: true`，再 insert 你的行**：
   ```yaml
   - id: ui-subagent
     disabled: true
   - insert:
       - id: <name>
         name: '@deepseek-ai/dsh-client-<name>'
   ```
4. **`packages/bundle/web-app/package.json`** — dependencies 加 `"@deepseek-ai/dsh-client-<name>": "workspace:^"`（profile 启动时经 `$DSH_HOME/profiles/node_modules` 兜底解析裸行名，清单未声明的包 import 会失败）。

`pnpm-workspace.yaml` 已 glob `packages/*/*`，无需改；新包第一次跑 `pnpm install` 生成 lockfile 条目。

**挂载行放 repo 的 web-app bundle 层**（新机器 clone 后开箱即用）。只在"仅本机生效"时才放用户级 `~/.dsh/profiles/web/cordis.patch.yml`——官方更新 web-app patch 不再和本地行冲突，这是把挂载行搬进 repo 的原因。

---

## 4. 构建 / 重启 / 验证

```sh
pnpm --filter @deepseek-ai/dsh-client-<name> bundle   # tsdown 产出 lib/client.js
pnpm run test:gui                                     # 客户端 + host GUI 套件（内环，随手跑）
pnpm --filter @deepseek-ai/dsh-client-<name> test     # 包单测
pnpm run typecheck                                    # tsc -b 全仓
```

- **新包 bundle 后必须重启 `dsh web`**（server 的模块表含新包），再刷新 GUI 才生效。
- 改动**已有**包的 bundle，刷新页面即生效（server 每次从磁盘读）。
- 想在改代码时自动热更，需 `pnpm run dev:web` 的 watcher 在跑（HMR 只覆盖 client-plugin 改动；shell/非 client-plugin 改动仍需重建 + 重启）。

---

## 5. 测试要求

- 包单测放 `tests/`，`// @vitest-environment jsdom` 首行 pragma；组件用真实 props（四份 share）驱动，断言**用户可见行为**，不断言类名/hook 内部。
- 同类包均落在 `test:coverage` 单文件 100% 门槛内；不可达防御臂用 `/* v8 ignore -- <原因> */`。
- 改了可见产物 → `DSH_SNAPSHOT=replay pnpm run test:web`。
- i18n 配对门禁（`pnpm run verify-translation-pairing`）：zh/en 键必须一致。

---

## 6. 踩坑清单（从 CUSTOM-FEATURES.md 与 AGENTS.md 提炼）

1. **官方包零改动原则**：fork 不是改官方包。官方行在 patch 里 `disabled: true`，代码保持上游 → 升级零冲突。
2. **fork 后内部引用要改名**：`src/invariant.ts` 的 `@module`、`PACKAGE_NAME`、`name` 还指向官方包名（ui-subagent-custom 里就残留着 `@deepseek-ai/dsh-client-ui-subagent`）；README 标题、`repository.url` 一并改。
3. **注册进别的包的 slot 用 `ctx.slots.inject`**：等真实声明、声明坍缩自动移除；裸 `slots.register` 进未声明 slot 是错误。
4. **可选服务用 `ctx.get(name)`**，缺席优雅降级（betterSidebar 缺席时按钮点击无效）。声明在 `inject` 里的服务才有 `ctx.<name>`。
5. **`dsh.client.inject` 只是信息性依赖边**，别指望它排序激活；激活顺序由 cordis 服务注入决定。
6. **组件永不碰 ctx**，数据只走四份 share；不手写 hook、不镜像外部快照进本地 state、不 JSON 序列化 live 数据。
7. **纯展示层纪律**：业务数据在 runtime object layer（sessions 等），store 只放跨条目共享的视图状态；`notifyNow` 只做用户手势直答。
8. **css-modules 哈希类名无法被插件覆盖**——该留官方的扩展面（如 ui-theme 的 `THEME_PREFERENCES`）留在官方，别试图在 fork 里覆盖。
9. **新包必须重启 `dsh web`**，老包刷新即可；改 `~/.dsh/profiles/web/node_modules` 里第三方插件的源码（如 better-sidebar 补丁）要全量重建主 bundle + 全部 chunk（css-modules `[hash]` 含路径，只重建主 bundle 会让 chunk 类名不一致 → 终端空白），详见 CUSTOM-FEATURES.md #4。
10. 每条用户可见文案进 `locales.ts`（zh 源 + en 一致），不硬编码在组件里；产品文案中文，代码注释英文。

---

## 7. 快速清单（写新包时逐项打勾）

- [ ] 选型：常驻 GUI 行为 → 内置静态 client 插件包（本文）；否则见第 0 节
- [ ] `packages/client/<name>/` 落盘：src/{index.ts, client/, invariant.ts, css-modules.d.ts}, tests/, package.json, tsconfig.json, tsdown.config.ts, README 三件
- [ ] `package.json`：exports 五键、`dsh.client`（platform web + inject 依赖边）、files 清单
- [ ] `src/client/index.ts`：`inject` 声明服务；`apply` 里 `ctx.effect` 注册 locale + `inputTriggers.registerSource` + 每个 `ctx.slots.inject(... → slots.register(...))`
- [ ] 组件：四份 share props，无 ctx、无手写 hook、无外部订阅
- [ ] locales：zh 源 of truth + en 键一致 + `LocaleNamespaceMap` 扩展
- [ ] 三处登记：`tsconfig.client.json` references、`tsconfig.base.json` paths、web-app `cordis.patch.yml`（fork 记得 disable 官方行）+ web-app `package.json` 依赖
- [ ] `pnpm install`（新包锁 lockfile）
- [ ] `pnpm --filter <pkg> bundle` → **重启 `dsh web`** → 刷新 GUI 手测
- [ ] 包单测 + `pnpm run test:gui` + `pnpm run typecheck` + i18n 配对
- [ ] fork 后改 invariant.ts/README 内部引用；`CUSTOM-FEATURES.md` 记录新功能（含来源会话、重放难度）
