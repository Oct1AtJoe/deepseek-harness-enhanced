# @deepseek-ai/dsh-client-ui-kanye-pet

[English](README.md) | 中文

Plugins 设置分区中的 kanye-pet 设置卡片。浏览器插件向该分区贡献一个本地化的 `settings.plugins.tab`（id `pet`，order 50）；导航入口与标签栏由分区持有，标签页渲染自己的卡片。卡片经 `settingsScope` 编辑 `kanye-pet` 设置命名空间：`enabled` web 宠物开关、`desktopPetEnabled` 桌宠伴侣开关、`character` 角色选择，以及带显式保存/放弃流程的 `size`/`opacity` 暂存字段。

角色选择在挂载时加载 `/kanye-pet/assets/manifest.json`；素材不可达时列表保持为空，存储的 id 继续渲染。文案以 `kanye-pet` locale 命名空间提供中英双语，跟随当前语言。

## 模型体验

无。kanye-pet UI 是浏览器侧设置卡片；它不产生模型可见输出，不消费模型输入，也不修改工具结果。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **仅设置子集** — 卡片编辑 `enabled`、`desktopPetEnabled`、`character`、`size`、`opacity`；宿主在 `kanye-pet` 命名空间下提供而卡片未暴露的键不在此界面内。
- **角色列表尽力而为** — 下拉框读取 `/kanye-pet/assets/manifest.json`；素材缺失时列表为空而不是报错。
