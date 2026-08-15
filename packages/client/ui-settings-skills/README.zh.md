# @deepseek-ai/dsh-client-ui-settings-skills

[English](README.md) | 中文

Web 设置「插件」分区中的技能管理标签页。浏览器插件注册一个 id 为 `skills` 的本地化 `settings.plugins.tab` 贡献；「插件」分区拥有导航入口与标签栏。插件激活期间不执行任何 Remote 读取：首次选择该标签页时才挂载组件，并通过 [`api-remotes`](../../api/remotes/README.md) 懒调用 `skillManager/list`。

标签页渲染一个可搜索目录，每个技能卡片展示名称、描述、来源与提供方，以及两个调用开关——模型可调用与用户可调用。拨动开关通过 `skillManager/setInvocation` 写入完整的下一策略并刷新目录；失败在行内呈现，不影响当前列表。展开卡片时通过 `skillManager/get` 懒加载完整指令正文，并带独立重试。目录按当前选中的会话寻址，因此展示的正是该会话组合所提供的技能（web 组合按设计禁用了 host 平面技能 provider）；无打开的会话时标签页显示提示且不执行 Remote 读取。文案中英双语，跟随当前语言。

## 模型体验

本包自身无直接模型请求：它只渲染管理界面，不发起自己的提示词、工具、消息或 provider 请求。其写入即用户的显式调用覆盖，模型可见效果由 Host 技能注册表所有并记录（见 [`dsh-host-skill-manager`](../../host/skill-manager/README.md)）。

#### KV 缓存影响

无；本包从不组装模型输入。

## 已知限制与待办

- **不创建或删除技能** — 本标签页只管理调用与查看；技能通过放置文件或安装 provider 添加。
- **搜索覆盖名称、描述、来源与提供方**，不含指令正文。
