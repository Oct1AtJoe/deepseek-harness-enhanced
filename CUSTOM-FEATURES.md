# Local Customizations — DeepSeek Harness

> 本文档记录 `E:\vibeCoding\deepseek-harness` 检出上的**本地定制改动**（2026-08-14 一次性加入，无上游提交）。仓库此前没有 `.git`，本文件与首次 git 提交一起建立了基线。**任何一次上游同步/升级后，按本清单核对并重放缺失的改动。** 每个功能都标注了来源会话（会话日志在 `~/.dsh/sessions/`，可按标题检索）。

重放顺序建议：按"核心层 → UI 层"执行；每步后跑对应包测试（`pnpm run test:gui` / `pnpm --filter <pkg> test`）与 `pnpm run typecheck`。

## 插件化迁移状态（2026-08-16 晚）

| 功能 | 状态 | 升级冲突面 |
|---|---|---|
| 1. per-model 思考程度记忆 | **留在官方包内**（agent-default-model + apiproxy + ui-model-selection） | 中（~110 行） |
| 2. 对话失败重试按钮 | **已插件化**：`ui-resend-failed-round` 新包挂官方 `assistant-actions` 操作条 | 零（ui-conversation 已还原官方） |
| 3. 移除图片发送限制 | **留在官方包内**（llm-deepseek serialize/adapter + apiproxy 准入） | 小（~79 行） |
| 4. 子智能体 tab + 计数按钮 | **已插件化 fork（2026-08-15/16）**：官方 `ui-subagent` 已 git 还原（含孤儿文件删除），挂 `ui-subagent-custom` 副本；fork 输入区按钮经 `ctx.get('betterSidebar')?.openTab({type:'subagent',pane:'right'})` 打开侧边栏 tab；fork 的 `InputZone` 类型走 `ui-conversation/src/client/contract/slots.ts` 子路径导入，官方 `/client` 入口零改动 | 零（官方 ui-subagent/ui-conversation 已还原；`ui-conversation` 仅剩主题惰性 CSS） |
| 5. 引用其他工作区会话 | **插件姿势**（context/session-reference 服务 + ui-session-reference 包 + profile patch 挂载）；apiproxy 保留管线接缝（normalize 钩子，上游无扩展点）与 `session.referenceCandidates` RPC（sessions 线 API 家族成员，BFF 线面，2026-08-16 调研结论：不迁移） | apiproxy RPC + 钩子（~150 行） |
| 6. 产物 +N -M 统计 + 展开 | **已插件化**：fork 为 `ui-deliverables-custom`，官方行禁用 | 零（官方 ui-deliverables 已还原） |
| 7. 展开面板重设计 | **已插件化**（随 6 一起在 custom 包）；DiffBlock 的 `showPathHeaders`/`showFooter` 两 prop 已随副本移入 custom 包（2026-08-16），官方 ui-primitives 还原 | 零（副本同步责任见 custom 包 README） |
| 8. aurora/nebula 主题 | **已插件化（2026-08-16）**：主题定义移入新包 `ui-theme-custom`，经官方 `ctx.theme.register()` 注册；官方 ui-theme 还原（BUILTIN_THEMES/inspect/design-platform.css/AppearanceRow/locales 全部回上游）。custom 包自带设置行（`settings.general.item` id `appearance-custom`，两个色块），官方外观行保持 light/dark/system 三色块。官方保留最小扩展面：`THEME_PREFERENCES`（持久化 schema，+15 行）与 `boot-theme.ts`（启动深色映射，+5 行） | 小（~20 行扩展面） |
| 9. nebula 液态玻璃 | **已插件化**（随 8，token 全在 ui-theme-custom）；22 个官方包 CSS 的 `backdrop-filter: var(--dsw-alias-glass-blur, none)` 惰性行 + Button/InputBar 玻璃 token 消费段保留（默认 none 零视觉影响；css-modules 哈希类名无法插件覆盖，还原即功能丢失）；`dsh-button-drift` keyframes 随包注入 | 低（每文件一行惰性钩子） |
| 10. Web 设置技能/子智能体管理 | **插件形态**：新包 `skill-manager`（host Remote + skill-overrides 命名空间）+ `ui-settings-skills` + `ui-settings-subagents`；官方改动仅扩展点：`skill/skill` 的 `setInvocationOverride`（+31，通用 registry API）与 `api/remotes` 聚合行（+12，官方 selection seat）。挂载行已移入 profile patch（2026-08-16），官方 web-app patch 与 plugin-config 快照还原 | 小（两个扩展点 ~43 行） |

**挂载配置**（用户级，不在 git 内）：`~/.dsh/profiles/web/cordis.patch.yml` 持有全部本地行——禁用官方 `ui-deliverables`、`ui-subagent`；insert `ui-deliverables-custom`、`ui-subagent-custom`、`ui-resend-failed-round`、`ui-theme-custom`、`session-reference`、`ui-session-reference`、`skill-manager`、`ui-settings-skills`、`ui-settings-subagents`、`tool-subagent-vision`。官方更新 web-app patch 不再冲突。

**同步流程**：`powershell -File scripts/upstream-sync.ps1`（下载官方 tarball → upstream-master 追加快照 → merge 进 master）。冲突只可能出现在上表"升级冲突面"非零的官方包文件，按各节重放步骤手工解决。

**根 README 已换位**（2026-08-14）：`README.md` 现在是中文（GitHub 默认渲染），英文在 `README.en.md`。上游同步必然在 `README.md`（上游英文 vs 本分支中文）与 `README.zh.md`（上游文件 vs 本分支已删除）上产生冲突：保留本分支中文 `README.md`，英文侧若有上游更新则合并进 `README.en.md`。根 README 已从翻译配对门禁排除（见 docs/i18n/README.md 排除清单），双语同步由手工维护。

---

## 1. per-model 思考程度记忆（effort memory）

- **来源会话**：`--E-vibeCoding-deepseek-harness--/session-57f91c63…`（"思考程度设置被重置"）
- **需求**：切走再切回 deepseek-v4-flash 时，max 思考程度被重置为 high。新会话初始显示也丢记忆。
- **改动文件**：
  - `packages/core/agent-default-model/src/index.ts` — 设置段新增 `efforts: Record<provider/model, effort>`；`selection()` 裸选择先查记忆；`saveSelection` 保留记忆；`rememberEffort()`/`forgetEffort()`。
  - `packages/host/apiproxy/src/api-proxy.ts` — `session.selectModel`：裸选择先查记忆再回退适配器默认；显式 effort 记录；`''` 显式清除（wire 只加含义不加字段）。
  - `packages/host/apiproxy/src/index.ts`、`src/api/sessions.schema.ts`（`''` 清除信号 schema）、`tests/api-proxy-models.spec.ts`、`tests/rpc-schemas.spec.ts`。
  - `packages/client/ui-model-selection/src/client/{directory,service,slots,ModelSelect,index}.ts(x)` — 两入口改发裸选择，host 统一裁决。
  - 文档：`packages/core/agent-default-model/README{,.zh}.md`、`README.i18n.yaml`、Agent Note `.agents/notes/implemented/bug-fix/2026-08-14-web-model-selection-effort-memory.{md,zh.md,i18n.yaml}`。
- **行为契约**：显式选 Max → 记入 host 设置文档；裸选 flash → 自动 Max；选"提供方默认值"行（发 `''`）→ 清除记忆回适配器默认；记忆对模型不再支持的 effort 自动回退并自我清除。
- **验证**：受影响包 72/72 测试过；`test:gui` 全绿；手动路径：重启 `dsh web` → 先手动选一次 Max → 切模型再切回、新建对话、重启，全部保持 Max。
- **重放难度**：中。`selectModel` handler 与 settings schema 是核心路径，升级时若 apiproxy/session 契约变化需适配。

## 2. 对话失败重试按钮

- **来源会话**：`--E-vibeCoding-deepseek-harness--/session-9814098d…`（"对话失败重试按钮修改计划"）
- **需求**：对话执行失败后，上一轮任务发言下（复制按钮旁）加"重新加载"按钮，点击重发该轮。
- **改动文件**（均在 `packages/client/ui-conversation/`）：`src/client/contract/slots.ts`（新席位/契约）、`src/client/chat/MessageIconActions.tsx`、`src/client/chat/MessageItem.tsx`、`src/client/chat/ChatView.tsx`、`src/client/chat/ChatNodeSeat.tsx`、`src/client/apply.ts`、`src/client/locales.ts`、`tests/chat-view.client.spec.tsx`。
- **验证**：ui-conversation 单测；`test:gui`。
- **重放难度**：中。消息操作条与 failedRound 逻辑在 ui-conversation 内部，升级合并点较多。

## 3. 移除图片发送限制

- **来源会话**：`--E-vibeCoding-chat--/session-bf136f58…`（"移除图片发送限制"）
- **需求**：模型不支持图片时提示"不支持"，去掉该限制（用户侧有子智能体委派识图兜底）。
- **改动文件**：
  - `packages/llm/llm-deepseek/src/serialize.ts`、`src/adapter.ts` — 图片序列化不再按模型能力拒绝；图片块渲染为**文本占位符**（`[image attachment <id> (<mediaType>, WxHpx, N bytes)]`，模型得知有图、可委派识图子智能体）。
  - `packages/host/apiproxy/src/api-proxy.ts` — 图片准入不再报"不支持"。
  - **`packages/llm/llm-pi-ai`（2026-08-16 补）**：同一占位符语义扩展到 pi-ai 路由（文本模态模型发图不再抛 `UNSUPPORTED_CONTENT`）。`src/adapter.ts` — 无图模型含图消息走文本路径（不要求 durable 附件服务），有图模型路径不变；`src/context.ts` — `textOnlyContext` 不再拒绝图片，`flattenText`/`toolResultText` 的 image 块渲染占位符（文案与 llm-deepseek 一致）。保留：pi-ai 的助手结构化图片输出（replay.ts）与有图模型缺附件服务的拒绝。
  - 测试：`packages/llm/llm-deepseek/tests/serialize.spec.ts`、`packages/host/apiproxy/tests/api-proxy-models.spec.ts`、`packages/llm/llm-pi-ai/tests/{adapter,context,convert}.spec.ts`。
- **验证**：对应包测试（pi-ai 212/212）+ `test:gui`。
- **重放难度**：中高。llm-deepseek 与 llm-pi-ai 都是上游核心 adapter，升级后 serialize/context 逻辑很可能被改，需按 diff 重放。
- **注意**：同会话还修复了 `~/.dsh/settings.yaml` 的 `agent-presets.default`（standard-xiaomi → standard）并删除 `.agent-presets/standard-xiaomi/`——这是用户级配置，不在仓库内，升级不受影响。

## 4. 子智能体 tab + 输入区计数按钮

- **来源会话**：`--E-vibeCoding-chat--/session-96488b40…`（"为对话界面增加子智能体标签与运行按钮"）；2026-08-15 改向侧边栏并 fork 插件化（"把子智能体改到侧边栏里头" / "不想修改源码，做成插件"）
- **需求**：委派子智能体后主对话无标识；加 tab 与按钮展示运行状态。
- **当前形态（2026-08-15，fork 插件）**：官方 `ui-subagent` 源码**零改动**（已 git 还原），整包 fork 为 `packages/client/ui-subagent-custom/`；官方行在用户 profile patch 禁用，挂 `ui-subagent-custom`。custom 与官方的差异：
  - 无顶部 `conversation.view` tab 注册（`SubagentWorkView.tsx` + module.css 移除，RobotIcon 内联进 ComposerAction）；
  - 输入区按钮（`conversation.input.right`，id `subagent-activity`）inject 契约 `setView` → `openSubagentTab`，点击调 `ctx.get('betterSidebar')?.openTab({ type: 'subagent', pane: 'right' })` 打开用户级 `dsh-better-sidebar` 插件的侧边栏 subagent tab（该插件内置完整子代理拓扑视图，`~/.dsh/profiles/web` bundle 通道安装）；better-sidebar 缺席时按钮点击无效（优雅降级）。
  - **better-sidebar 本地补丁**（`~/.dsh/profiles/web/node_modules/dsh-better-sidebar/src/`，2026-08-15）：
    - `client/service.ts` — `openTab` seed 新增 `pane?: 'right'` —— 类型型 open 固定落**右侧面板**（tab 落/移回右侧树首个 pane 并自动展开右面板），不再跟随 activePane 落底部栏；已藏在折叠底部树的 subagent tab 会被 `moveTab` 移回右侧。
    - `client/builtins/tabs.tsx` — 终端编号**复用**：`createTab` 改为取最小空闲编号（关闭的终端释放编号，命名跟随存活数量 1,2,2…），不再用单调 `nextTerminal` 计数器。
    - 补丁后需按下方"重建 better-sidebar client bundle"**全量重建**（主 bundle + 全部 chunk，hash 一致性要求），刷新页面生效。
  - `@` 源、`conversation.session.header.actions` 目录按钮、只读 composer 与官方一致。
- **改动文件**：
  - `packages/client/ui-subagent-custom/`（新包，fork 官方 + 上述差异）：`src/client/{index,SubagentComposerAction,locales}.ts(x)`、`tests/browser-plugin.client.spec.ts`（断言 `conversation.view` 无注册、按钮注入调 better-sidebar）、package.json（更名 `@deepseek-ai/dsh-client-ui-subagent-custom`）、tsdown.config.ts、README 中英（fork 差异说明）。
  - `packages/bundle/web-app/package.json` — 依赖声明 `@deepseek-ai/dsh-client-ui-subagent-custom`（workspace:^）。
  - `tsconfig.client.json` — aggregate references 加 custom 条目。
  - `~/.dsh/profiles/web/cordis.patch.yml`（用户级）— `- id: ui-subagent, disabled: true` + insert `ui-subagent-custom`。
- **验证**：ui-subagent-custom 31 单测 + `test:gui` 278 files / 3844 tests 全绿；`tsc -b` 通过；i18n 配对 943 对一致；custom bundle 重建后**需重启 `dsh web`**（模块表含新包）再刷新 GUI。better-sidebar 主 bundle 重建后刷新页面即生效（server 每次从磁盘读）。
- **重放难度**：低。仅新包 + 三处登记；官方 ui-subagent 不动，升级零冲突。功能依赖用户 profile 的 `dsh-better-sidebar` 插件（不在 repo；其 node_modules 内补丁与重建步骤见下）。

### 重建 better-sidebar client bundle（补丁后，必须全量）

发布包不带 tsdown.config.ts 与 lib/types/*.js。**主 bundle 与 5 个 lazy chunk（terminal/editor/docx/xlsx/pptx）必须一起重建**：lightningcss 的 css-modules `[hash]` 含文件路径，只重建主 bundle 会让 chunk 组件（终端等）的类名与主 bundle 注入的样式不一致 → 终端空白。统一把 `filename` 传为**相对包根的路径**，主 bundle 与 chunk 的 hash 即一致。

1. 改 `~/.dsh/profiles/web/node_modules/dsh-better-sidebar/src/` 下源码（见上）。
2. 包目录放临时 `tsdown.rebuild.mjs`（完整 config：主 bundle `entry src/client/index.tsx` → `client.js`（`__ModuleLoader__.load` banner）；5 个 chunk `entry src/client/chunks/<name>.tsx` → `client-<name>.js`（`__dshChunks__` banner）；公共：`external`/`define`（含 `import.meta.resolve: 'undefined'`）/`noExternal` 照仓库 `packages/client/tsdown.client.ts`（`CLIENT_EXTERNALS` 用 `file://` import）、`inputOptions.resolve.conditionNames: ['browser','import','require','default']`、`resolve.alias: { stream: 'readable-stream' }`（docx 依赖链引 Node stream）、内联 css 插件（`.module.css` → classMap + style 注入，`filename` 传相对包根；普通 `.css` → 原样注入）、purity 插件（`@deepseek-ai` 白名单，builtin 放行交给 alias/rolldown）。构建：
   `node <repo>/node_modules/.pnpm/tsdown@0.22.2_*/node_modules/tsdown/dist/run.mjs --config <包>/tsdown.rebuild.mjs --config-loader tsx`（cwd = 包目录；lightningcss 用 `<repo>/.pnpm/lightningcss@1.32.0/.../node/index.mjs` 的 file:// import）。
3. 产物覆盖 `lib/`；删除临时 config。`/plugins/dsh-better-sidebar/client.js` 与 `/sidebar/bundle/<name>.js` 下次请求即新内容（chunk 路由 no-cache + ETag），刷新页面生效。

## 5. 引用其他工作区会话（session reference）

- **来源会话**：`--E-vibeCoding-deepseek-harness-app--/session-171238c5…`（"引用其他工作区会话的功能"）
- **需求**：当前 agent 引用其他工作区会话（`@` 触发 + `dsh-session:` 引用注入）。
- **改动文件**：
  - `packages/host/apiproxy/` — `src/api-proxy.ts`（引用解析/prepare/inject 钩子 + referenceCandidates）、`src/api/sessions.ts`（`SessionReferenceCandidate` 类型）、`src/api/sessions.schema.ts`（RPC schema）、`src/api/rpc-map.ts`（注册 `session.referenceCandidates`）、`src/api/rpc.ts`（错误码 `session-reference-failed`）、`src/api/rpc.schema.ts`、`src/api/index.ts`、`src/fetch/{handler,client}.ts`、`tests/api-proxy-session-reference.spec.ts` 等。
  - `packages/client/ui-session-reference/`（**全新插件包**）— `src/index.ts`（node half）、`src/client/index.ts`（`@` 触发源 + codec）、`src/invariant.ts`、package.json/tsconfig/tsdown/README。
  - `packages/bundle/web-app/cordis.patch.yml` — 挂载 `session-reference` + `ui-session-reference` 两行；`packages/bundle/web-app/package.json` 两依赖。
  - 零散：`packages/client/ui-input-trigger/src/client/locales.ts`（"会话/Sessions"菜单）、`packages/client/connection/src/client/{api.ts,fixture.ts}`、`tests/fake-api.client.ts`×2、`tsconfig.client.json`。
- **验证**：apiproxy 新增 7 测试；`test:gui`。
- **重放难度**：低（唯一按插件姿势做的功能：新包 + patch 挂载）。升级只需确认 patch 行与依赖声明仍在。

## 6. 产物文件 diff 统计 + 下拉展开

- **来源会话**：`--E-vibeCoding-deepseek-harness-app--/session-3bf442da…`（"修改文件统计与展开功能"）
- **需求**：对话尾部产物文件名右侧显示本次对话修改文件的 `+N -M` 行数，下拉展开修改内容。
- **改动文件**（均在 `packages/client/ui-deliverables/`）：
  - `src/client/turn-deliverables.ts` — `DeliverablesTurnData.history`（跨 turn 链式累积已应用 hunks）、结果视图 diffs 捕获、`diffStats`（与 DiffBlock 同口径）。
  - `src/client/ProducedFiles.tsx` + `.module.css` — chip 文件名右侧 `+N -M` 徽标 + 下拉箭头（展开/收起，`aria-expanded`），展开复用 `DiffBlock`。
  - `src/client/{index,locales}.ts`、`package.json`（声明 ui-primitives 依赖）、README。
  - 测试：`tests/produced-files.client.spec.tsx`（20 项）。
- **验证**：20/20 测试；`tsc -b tsconfig.client.json`；`test:gui`。
- **重放难度**：中。turn-deliverables 投影逻辑是核心，升级需核对事件字段。

## 7. 展开面板 UI 重设计（功能 6 的优化）

- **来源会话**：`--E-vibeCoding-deepseek-harness--/session-3292069f…`（"优化代码展开面板UI样式"）
- **需求**：功能 6 的展开面板美化（原样丢 DiffBlock → 完整卡片）。
- **改动文件**：
  - `packages/client/ui-deliverables/src/client/ProducedFiles.tsx` — 新 `ChangePanel` 组件（标题栏 = 路径 + `+N -M` + 收起按钮；正文 DiffBlock）。
  - `packages/client/ui-primitives/src/DiffBlock.tsx` — 新可选 props `showPathHeaders` / `showFooter`（默认 true，工具行行为不变）。
  - `ProducedFiles.module.css` — hairline 边框 + 12px 圆角 + code-block 面、160ms 淡入（`prefers-reduced-motion` 关闭）、全 `--dsw-*` token。
  - `turn-deliverables.ts` — 4 个畸形 diff 防御分支补 hostile-input 测试；删 `?? undefined` 死臂；参数收窄 `Exclude<..., null>`（覆盖 100%）。
  - 测试与 README：`tests/produced-files.client.spec.tsx`、`tests/diff-block.client.spec.tsx`、两个包 README 中英 + i18n 配对。
- **验证**：`test:gui` 273 files / 3787 tests 全绿；ui-deliverables 覆盖 100%。
- **重放难度**：中。DiffBlock props 是共享原语，升级需确认调用方兼容。

## 8. aurora / nebula 科技主题 + 像素风按钮

> 注：nebula 的像素风按钮已由功能 9 的「科技磨砂玻璃按钮」替换（本条目保留像素实现细节作历史记录；重放功能 8 后需再重放功能 9 的按钮 token 段）。aurora 的 capsule 按钮不受影响。

- **来源会话**：`--E-vibeCoding-deepseek-harness-app--/session-a698e102…`（"给agent添加主题"）
- **需求**：炫酷科技主题（非纯色），按钮样式跟随变化。
- **改动文件**（均在 `packages/client/ui-theme/` 与相关样式）：
  - `src/client/aurora.ts`（新）、`src/client/nebula.ts`（新）— 两个主题定义（蓝紫渐变 + 光晕）。
  - `src/theme-settings.ts`、`src/boot-theme.ts`、`src/client/index.ts`、`src/client/AppearanceRow.tsx`、`src/client/locales.ts`、`src/styles/design-platform.css`。
  - `packages/client/ui-primitives/src/Button.module.css` — 像素风按钮 + 圆角；`ui-layout/AppFrame.module.css`、`ui-conversation/skeleton/*.module.css`、`ui-sidebar/SidebarRoot.module.css`、`ui-subagent/SubagentWorkView.module.css` 等圆角协调。
  - 修复：`label-primary-inverted` 撞色（nebula `rgb(30,33,62)`、aurora `rgb(30,26,48)`）。
  - 测试：`tests/{theme,boot-theme,appearance-row,host}.client.spec.*`；README 中英。
- **验证**：`test:gui`；手动：设置 → 外观 → 选 aurora/nebula。
- **重放难度**：中。主题注册表若升级扩展需适配；两个主题文件可整体复制。
- **注意**：样式改动分散在多个包（Button/AppFrame/InputBar 等），重放时按"主题 token + 圆角 + 像素风按钮"三块分别核对。

## 9. nebula 主题液态玻璃（glassmorphism）

- **来源会话**：`--E-vibeCoding-deepseek-harness--/session-fdb9a987…`（"外观样式主题 液态玻璃效果"）
- **需求**：星云主题全面液态玻璃——表面半透明 + backdrop 模糊，极光底图透过面板。
- **机制**：半透明 = 主题 token 值（nebula.ts 表面 token 改 rgba）；模糊 = CSS 属性，由表面根规则消费新 token `--dsw-alias-glass-blur`（nebula 定义 `blur(16px) saturate(1.4)`，base 两层默认 `none`，light/dark/aurora 零影响）。嵌套面板只透出已模糊的背景，不重复 blur。
- **⚠️ backdrop-filter 包含块陷阱（本轮修复的核心教训）**：`backdrop-filter` 非 `none` 的元素会成为其 `position: fixed` 后代的包含块。侧栏列加 blur 后，DOM 挂在侧栏内的设置弹窗 `.overlay`（`fixed; inset: 0`）被锚到 280px 的侧栏列 → 弹窗被压成侧栏宽、贴左、布局全乱（用户实测复现）。同一问题波及所有容器内 fixed 弹层（Tooltip 全部是 fixed 定位：输入卡 4 个、气泡操作、GoalBar、QueueDock、轨迹表等）。**修复**：容器级 backdrop-filter 全部撤掉（半透明保留，玻璃感主体在透光），blur 只保留在「自身就是弹层、内部无 fixed 后代」的元素上：Tooltip.bubble、Menu 卡片、设置面板 .panel、审批卡/提问卡/计划卡/Todo 等无 Tooltip 的表面。给任何容器加 backdrop-filter 前必须确认其 DOM 子树内没有 fixed 定位元素。
- **改动文件**：
  - `packages/client/ui-theme/`：`src/client/nebula.ts`（表面 token 半透明化 + 玻璃 token + 极光 alpha 上调）、`src/client/index.ts`（inspect token 条目 + 注释）、`src/styles/design-platform.css`（两层 `--dsw-alias-glass-blur: none`）、`tests/theme.client.spec.ts`（玻璃断言）、README 中英。
  - 表面根规则加 `backdrop-filter: var(--dsw-alias-glass-blur, none)`（22 个文件）：ui-layout AppFrame 侧栏列、ui-conversation（气泡/输入卡/审批卡/Todo/队列 dock/上下文面板）、ui-goal GoalBar、ui-trajectory 根、ui-settings-general 设置面板、ui-user-questions（提问卡/计划卡）、ui-primitives（Modal/Tooltip/Menu/Onboarding）、ui-subagent(+custom)（只读 composer/目录菜单）、ui-commands PopupSelect、ui-input-trigger MenuView、ui-jobs JobListAction、ui-model-selection ModelSelect 菜单。
- **验证**：`test:gui`；手动：设置 → 外观 → 选 nebula，看侧栏/气泡/输入卡/菜单磨砂效果；切换 light/dark/aurora 确认无变化。
- **重放难度**：低。token + 每处一行 backdrop-filter；升级冲突点集中在 ui-conversation（功能 2/4 共用）。
- **注意**：代码块/行内代码保持不透明（可读性优先）；像素按钮风格不动。侧栏去掉了 `ui-sidebar/SidebarRoot.module.css` 里冗余的 `--dsw-specific-sidebar-fill` 背景（layout 列本已绘制，见该文件头注释；双层半透明叠加会把玻璃压成实心）。
- **按钮玻璃化（功能 8 像素按钮的替换）**：nebula.ts 的 `--dsw-alias-button-*` effect token 集整体换成玻璃版——半透明渐变填充 + `dsh-button-drift` 慢速漂移（`--dsw-alias-button-primary-bg-size: 200% 100%` + motion，复用 design-platform.css 预留的 keyframes）+ 顶部内高光/1px 玻璃描边/双层蓝紫外发光（box-shadow 系）+ 按压 1px 下沉（press-shift 从 `translate(2px,2px)` 改为 `translate(0,1px)`）。消费侧：`Button.module.css .primary` 加 `backdrop-filter: var(--dsw-alias-glass-blur, none)`（按钮无 fixed 后代，安全）、`.toolbar` 加 `box-shadow: var(--dsw-alias-button-outline-glow, none)`（玻璃 chip）；发送圈 `InputBar.module.css .primary` 背景改为 `var(--dsw-alias-button-info-bg, var(--dsw-alias-button-info-fill))` 优先（新增 `--dsw-alias-button-info-bg-hover`），删掉 background-image 叠加层，加 blur。base palettes 全部 fallback 兜底，light/dark/aurora 零变化。验证：`test:gui`；真浏览器 computed style + 放大截图（半透明填充 + 1px 高光描边 + 光晕可见）。

---

## 通用重放备忘

- **构建**：改动全在 `packages/`，需重建 client bundle：`pnpm --filter <pkg> bundle`（或仓库级 Client pass）；GUI 无热更，刷新前确认 `:3080` 提供的 `lib/client.js` 已更新。
- **Host 层**（功能 1/3/5）：跑在 `dsh web` 进程内（tsx 按需编译，无热更），改动后必须重启 `dsh web`。
- **测试门禁**：`pnpm run test:gui`（GUI 内环）；`pnpm run typecheck`；`pnpm run test:coverage`（每文件 100%）。
- **文档配套**：每个功能都有 README 中英 + i18n.yaml 配对 + Agent Note（功能 1），重放时一并恢复。
- **升级冲突预警**：`apiproxy`（功能 1/3/5 共用）、`ui-conversation`（功能 2/4 共用）、`ui-deliverables`（功能 6/7 共用）是三个高频合并点；升级前先备份这些目录。
