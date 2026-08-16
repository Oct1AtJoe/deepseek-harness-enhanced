# @deepseek-ai/dsh-client-ui-settings-subagents

[English](README.md) | 中文

Web 设置「插件」分区中的子智能体管理标签页。浏览器插件注册一个 id 为 `subagents` 的本地化 `settings.plugins.tab` 贡献；「插件」分区拥有导航入口与标签栏。标签页读取 `subagentManager` Remote（`list`）并展示三个区：**具名子智能体工具**（每个 `@deepseek-ai/dsh-tool-subagent` 行，如自定义识图子智能体——带工具名、provider、子模型、后台模式与来源徽标）、**后端目录**（每个 loader 后端行加上可安装的可选后端；内置行渲染实时 provider 能力与生效配置）与可安装后端候选。

每个具名工具与每个已安装后端提供「编辑配置」（通过 `updateConfig` 整体替换其配置——loader 补丁层热重载，改动无需重启即生效）与「移除」（两步确认，通过 `remove` 追加禁用覆盖）。可安装候选打开内联 JSON 编辑器（预填 provider 名）并通过 `install` 安装。目录读取与每次写入都在行内呈现线上错误文本，并提供重试/刷新入口。文案中英双语，跟随当前语言。

## 模型体验

无，本标签页只渲染基于 subagentManager Remote 的管理界面，不发起自己的模型提示词、工具、消息或 provider 请求。

#### KV 缓存影响

无；本包从不组装模型输入。

## 已知限制与待办

- **仅整配置编辑** — 编辑器整体替换该行的配置；各后端的字段级表单待 schema-form 覆盖这些配置后再做。
- **移除即停用，不删除** — 被移除的行保留 loader 条目（`disabled: true`）；目前没有从补丁文件中删除该行的卸载操作。
- **无重新启用** — 被「移除」停用的后端无法在本标签页重新启用（存在被停用行时重装同一模块会被拒绝）。
