# Agent Note：Web 设置页中的技能与子智能体管理

状态：已实现

[English](2026-08-14-web-settings-skills-subagent-management.md) | 中文

## 问题

「插件」设置页已提供配置卡片（终端、Agent 循环、网页搜索）与只读的 Loader 清单，但没有任何地方让用户看到：安装了哪些技能、模型能否调用它们；此 dsh 安装提供哪些子智能体后端、其中哪些处于活动状态。技能只在会话的注入目录与工具行中可见；子智能体只能看到单个会话自己的工作视图。管理所需的事实早已存在——`ctx.skills` 列出并加载每个胜出技能及其调用策略，Loader 与子智能体注册表描述已安装的后端——但两者都没有管理界面。

## 决策

两个新浏览器标签页与两个 Host Remote，全部走既有 seam，不动 shell。

**`dsh-host-skill-manager` 发布管理 Remote。** `SkillManagerGateway` 注册 `skillManager` 服务，提供三个直接 Remote：`list`（带生效调用策略的胜出目录）、`get`（单个完整技能正文）、`setInvocation`（强制设置某个技能的有效策略）。目录读取按会话寻址：客户端传入当前选中会话的 id，网关从会话头解析项目 cwd、以存活 agent 或记录的预设常驻键解析视图作用域——与 apiproxy 技能域相同的解析——再读取分层注册表。这是承重设计而非便利：已发布的 web 组合刻意禁用 host 平面技能 provider，让预设自己负责本地发现，因此无作用域的 host 读取返回空目录，而每个会话都提供自己的目录。覆盖通过新的注册表原语 `SkillRegistry.setInvocationOverride(name, policy | undefined)` 写入：它在 list 与 get 投影时压过所有 provider 声明的策略、使目录缓存失效并发出既有的 `skills/change` 事件；对目录中不存在的名称也接受，并在该技能出现后生效。覆盖持久化在 `skill-overrides` 用户设置命名空间下，并在网关挂载时恢复，因此开关在重启后仍然生效。写入先作用于注册表，再提交设置文档；持久化失败时实时覆盖仍然保留。

**`dsh-client-ui-settings-skills` 渲染技能标签页**（id `skills`，order 20）：可搜索目录，每个卡片展示名称、描述、来源、提供方与两个调用开关（模型可调用、用户可调用）。拨动开关通过 `skillManager/setInvocation` 写入完整的下一策略并刷新目录；失败在行内呈现，不影响当前列表。展开卡片时通过 `skillManager/get` 懒加载指令正文，带独立重试，并提供方有路径时一并展示文件路径。标签页以标准会话快照中当前选中的会话寻址目录；无打开的会话时显示提示且不执行 Remote 读取。

**`dsh-host-subagent-manager` 发布后端目录上的管理 Remote。** `SubagentManagerGateway` 注册 `subagentManager` 服务，提供四个直接 Remote：`list`（Loader 的每个子智能体后端行——内置 spawn/fork 与任何已安装的可选后端——加上可安装的可选后端，含来源、生效配置与实时 provider 能力；外加 `@deepseek-ai/dsh-tool-subagent` 的每个具名子智能体工具行，含工具名、provider、子模型与后台模式）、`installBackend`（为某个可选后端追加 insert 行）、`removeBackend`（停用某后端或工具行）、`updateConfig`（整体替换某后端或工具行的配置）。安装与移除端点命名为 `installBackend`/`removeBackend`，因为客户端 `RemoteNamespaceService` 自带私有 `install` 与 `remove` 成员，其挂载守卫拒绝与类原型方法同名的 wire 方法名。写操作向 harness 级用户补丁层（`~/.dsh/cordis.patch.yml`）追加条目，boot 监视器热重载——改动无需重启即生效。来源通过解析同一补丁文件得出：在那里出现的行 id 报告 `source: 'user'`，其余为 `source: 'bundle'`。

**`dsh-client-ui-settings-subagents` 渲染子智能体标签页**（id `subagents`，order 30）：来自 `subagentManager/list` 的目录。**具名子智能体工具**区列出每个 `@deepseek-ai/dsh-tool-subagent` 行（如用户的自定义识图子智能体），带工具名、provider、子模型、后台模式与来源徽标；已安装后端卡片展示 provider 名、模块、来源与启用徽标、实时 provider 的能力 chips 与生效配置。每个工具与每个已安装后端提供「编辑配置」（通过 `updateConfig` 整体替换配置）与「移除」（两步确认，通过 `removeBackend` 停用）。可安装候选打开内联 JSON 编辑器（预填 provider 名）并通过 `installBackend` 安装。目录读取与每次写入都在行内呈现线上错误文本，并提供重试/刷新入口。

两个标签页都注册进既有的 `settings.plugins.tab` 槽——「插件」分区拥有导航入口与标签栏——且都是懒加载：插件激活期间不执行任何 Remote 读取，首次选中标签页才拉取目录。

## 备选方案

- **用注册表外部的覆盖过滤器代替注册表原语。** 否决：覆盖必须作用于面向模型的目录本身（`skill` 工具与注入目录都读 `ctx.skills`），在网关注入过滤只会让开关变成装饰。
- **编辑技能文件翻转 `disable-model-invocation` frontmatter。** 否决：依赖 provider，且无法表达与文件相悖的用户覆盖。
- **用跨会话使用名册代替后端目录。** 先建成后被替换：名册把每个父会话的 `subagentsByParent` 目录（按子项 id 去重）扁平化，带「打开」/「停止」（`sessions.openSubagent` 与 `subagents.interrupt`）。用户面对的需求是管理*已安装的*子智能体能力，而非过去委派的历史，因此标签页现在展示后端目录并通过新 Remote 增删改查；不再保留使用历史视图。
- **提供"清除覆盖"的 Remote 操作。** v1 否决：开关写入完整的下一策略，与 provider 默认值相同的条目无害；设置文档为每个触碰过的技能累积一条记录，记为已知限制。

## 影响

用户可在设置页浏览与搜索已安装技能、阅读任意技能的指令正文、逐技能切换模型/用户调用；每次切换跨重启持久化，并立即作用于面向模型的目录。用户可查看此安装提供的全部子智能体后端——内置与可选——并在同一页面安装可选后端、替换某后端配置或停用某后端；写操作持久化在用户补丁层，经 HMR 无需重启即生效。

注册表新增一个全局覆盖原语，作用域刻意保持全局——没有按预设的变体，因此需要固定策略的预设仍通过自身组合表达。两个新标签页加入插件页的标签栏，使装配后的设置快照（`apps/web/tests/snapshots/plugin-config/section.expected.md`）增加两行标签；golden 在同一变更中重录。subagent-manager host 行挂在用户 profile 层而非官方 bundle，与 skill-manager 各行的做法一致。

`dsh-skill` 的 README 与新包的 README 记录了覆盖语义与已知限制（仅显式覆盖、仅全局层、不监听外部编辑；子智能体标签页仅整配置编辑、「移除」即停用而非删除、且无重新启用）。
