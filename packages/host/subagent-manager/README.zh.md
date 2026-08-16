# @deepseek-ai/dsh-host-subagent-manager

[English](README.md) | 中文

子智能体后端目录与具名子智能体工具上的管理 Remote。`SubagentManagerGateway` 注册 `subagentManager` 服务并发布四个生成式直连 Remote：`subagentManager/list`（Loader 的每个子智能体后端行加上可安装的可选后端——含来源、生效配置与实时 provider 能力——以及 `@deepseek-ai/dsh-tool-subagent` 的每个具名子智能体工具行，含工具名、provider、子模型与后台模式）、`subagentManager/installBackend`（为某个可选后端追加 insert 行）、`subagentManager/removeBackend`（停用某后端或工具行）、`subagentManager/updateConfig`（整体替换某后端或工具行的配置）。目录覆盖内置进程内 provider（spawn、fork）与可选外部后端（acp、claude-code、codex、dsh-sdk）；内置后端不可安装或移除。

写操作向 harness 级用户补丁层（`~/.dsh/cordis.patch.yml`，经 `dshHomePath`）追加条目，boot 监视器热重载——改动无需重启即生效。`list` 的来源通过解析同一补丁文件得出：在那里出现的行 id 报告 `source: 'user'`，其余为 `source: 'bundle'`。`updateConfig` 浅替换整行配置，因此调用方发送完整的下一个配置；`installBackend` 拒绝内置后端与目录之外的模块；`removeBackend` 拒绝既非后端也非具名工具的未知行。

该服务仅 Remote，不声明同进程 Cordis `Context` 合并。客户端包通过显式 [`api-remotes`](../../api/remotes/README.md) 装配消费，而非导入 Host 实现。

## 模型体验

无，本包仅读取 Loader 与 provider 注册表并追加 loader 补丁文本，不发起自己的模型提示词、工具、消息或 provider 请求。

#### KV 缓存影响

无；本包不组装模型输入。

## 已知限制与待办

- **移除即停用，不删除** — 被移除的行保留 loader 条目（`disabled: true`）；目前没有从补丁文件中删除该行的卸载操作。
- **无重新启用** — `install` 拒绝已有行的模块，且没有清除停用覆盖的操作，因此经 Remote 停用的后端只能手改补丁文件恢复。
- **补丁文件竞争** — 两个会话并发写入时不加锁；boot 监视器应用最终文件状态。
