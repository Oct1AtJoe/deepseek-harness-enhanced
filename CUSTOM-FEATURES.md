# Local Customizations — DeepSeek Harness

> 本文档记录 `E:\vibeCoding\deepseek-harness` 检出上的**本地定制改动**（2026-08-14 一次性加入，无上游提交）。仓库此前没有 `.git`，本文件与首次 git 提交一起建立了基线。**任何一次上游同步/升级后，按本清单核对并重放缺失的改动。** 每个功能都标注了来源会话（会话日志在 `~/.dsh/sessions/`，可按标题检索）。

重放顺序建议：按"核心层 → UI 层"执行；每步后跑对应包测试（`pnpm run test:gui` / `pnpm --filter <pkg> test`）与 `pnpm run typecheck`。

## 插件化迁移状态（2026-08-14 晚）

| 功能 | 状态 | 升级冲突面 |
|---|---|---|
| 1. per-model 思考程度记忆 | **留在官方包内**（agent-default-model + apiproxy） | 中（~110 行） |
| 2. 对话失败重试按钮 | **已插件化**：`ui-resend-failed-round` 新包挂官方 `assistant-actions` 操作条 | 零（ui-conversation 已还原官方；注意按钮位置移到**助手回复**操作条） |
| 3. 移除图片发送限制 | **留在官方包内**（llm-deepseek serialize/adapter） | 小（~79 行） |
| 4. 子智能体 tab + 计数按钮 | **组件部分已插件**（ui-subagent 包内新文件，零冲突）；ui-conversation 的席位注册点仍在官方包内 | 小（~90 行，席位声明/apply） |
| 5. 引用其他工作区会话 | **插件姿势**（新包 ui-session-reference + apiproxy RPC）；挂载行已移到 profile patch | apiproxy RPC 部分（~120 行） |
| 6. 产物 +N -M 统计 + 展开 | **已插件化**：fork 为 `ui-deliverables-custom`，官方行禁用 | 零（官方 ui-deliverables 已还原） |
| 7. 展开面板重设计 | **已插件化**（随 6 一起在 custom 包）；DiffBlock 的两个可选 prop 仍在官方 ui-primitives | 小（~32 行 DiffBlock props） |
| 8. aurora/nebula 主题 | 主题定义文件免疫（ui-theme 内新文件）；注册点仍在官方包内 | 小（~50 行注册 + ~40 行 Button.css） |

**挂载配置**（用户级，不在 git 内）：`~/.dsh/profiles/web/cordis.patch.yml` 持有全部本地行——禁用官方 `ui-deliverables`、insert `ui-deliverables-custom`、`ui-resend-failed-round`、`session-reference`、`ui-session-reference`、`tool-subagent-vision`。官方更新 web-app patch 不再冲突。

**同步流程**：`powershell -File scripts/upstream-sync.ps1`（下载官方 tarball → upstream-master 追加快照 → merge 进 master）。冲突只可能出现在上表"升级冲突面"非零的官方包文件，按各节重放步骤手工解决。

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
  - `packages/llm/llm-deepseek/src/serialize.ts`、`src/adapter.ts` — 图片序列化不再按模型能力拒绝。
  - `packages/host/apiproxy/src/api-proxy.ts` — 图片准入不再报"不支持"。
  - 测试：`packages/llm/llm-deepseek/tests/serialize.spec.ts`、`packages/host/apiproxy/tests/api-proxy-models.spec.ts`。
- **验证**：对应包测试 + `test:gui`。
- **重放难度**：中高。llm-deepseek 是上游核心 adapter，升级后 serialize 逻辑很可能被改，需按 diff 重放。
- **注意**：同会话还修复了 `~/.dsh/settings.yaml` 的 `agent-presets.default`（standard-xiaomi → standard）并删除 `.agent-presets/standard-xiaomi/`——这是用户级配置，不在仓库内，升级不受影响。

## 4. 子智能体 tab + 输入区计数按钮

- **来源会话**：`--E-vibeCoding-chat--/session-96488b40…`（"为对话界面增加子智能体标签与运行按钮"）
- **需求**：委派子智能体后主对话无标识；加 tab 与按钮展示运行状态。
- **改动文件**：
  - `packages/client/ui-subagent/src/client/SubagentWorkView.tsx`（新）— 子智能体树视图（头像/状态点/token/活跃时长/展开嵌套/刷新/重试），注册为 `conversation.view` 第 3 个 tab（order 20）。
  - `packages/client/ui-subagent/src/client/SubagentComposerAction.tsx`（新）+ `.module.css` — 输入区机器人按钮，运行中显示计数徽标，点击切 tab。
  - `packages/client/ui-subagent/src/client/{index,locales}.ts`、`SubagentCatalogAction.tsx`（导出复用工具函数）。
  - `packages/client/ui-conversation/src/client/contract/slots.ts` — 新席位 `conversation.input.subagent`；`apply.ts`（视图切换经 ConversationController 转发）、`skeleton/InputBar.tsx`、`skeleton/ConversationRoot.tsx`、`src/client/index.ts`。
- **验证**：ui-conversation + ui-subagent 446 单测；web e2e 黄金快照需 `pnpm test:web:refresh`（新 tab 改变输出）。
- **重放难度**：高。`ui-subagent` 两个新组件可整体复制；ui-conversation 的席位/apply 改动是合并点。

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

---

## 通用重放备忘

- **构建**：改动全在 `packages/`，需重建 client bundle：`pnpm --filter <pkg> bundle`（或仓库级 Client pass）；GUI 无热更，刷新前确认 `:3080` 提供的 `lib/client.js` 已更新。
- **Host 层**（功能 1/3/5）：跑在 `dsh web` 进程内（tsx 按需编译，无热更），改动后必须重启 `dsh web`。
- **测试门禁**：`pnpm run test:gui`（GUI 内环）；`pnpm run typecheck`；`pnpm run test:coverage`（每文件 100%）。
- **文档配套**：每个功能都有 README 中英 + i18n.yaml 配对 + Agent Note（功能 1），重放时一并恢复。
- **升级冲突预警**：`apiproxy`（功能 1/3/5 共用）、`ui-conversation`（功能 2/4 共用）、`ui-deliverables`（功能 6/7 共用）是三个高频合并点；升级前先备份这些目录。
