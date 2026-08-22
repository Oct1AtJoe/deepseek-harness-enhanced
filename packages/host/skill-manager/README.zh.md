# @deepseek-ai/dsh-host-skill-manager

[English](README.md) | 中文

技能注册表的管理 Remote。`SkillManagerGateway` 注册 `skillManager` 服务并发布三个生成的直接 Remote：`skillManager/list`（带生效调用策略的胜出目录）、`skillManager/get`（单个完整技能正文）、`skillManager/setInvocation`（强制设置某个技能的有效调用策略并持久化）。目录读取按会话寻址：`list` 与 `get` 接收查看会话的 id，从会话头解析项目 cwd，并以存活 agent 或记录的预设常驻键解析视图作用域（与 apiproxy 技能域相同的解析），再经由该作用域读取 `ctx.skills`——因此页面展示的正是该会话的面向模型组合所提供的目录。在已发布的 web 组合中 host 平面不挂载技能 provider；预设自己负责本地发现，因此会话寻址是承重设计而非便利。

`setInvocation` 通过注册表的全局调用覆盖写入，该覆盖在列表与加载投影时压过所有 provider 声明的策略。覆盖持久化在 `skill-overrides` 用户设置命名空间下，并在插件挂载时恢复，因此开关在重启后仍然生效，且对面向模型的目录立即可见。写入先作用于注册表，再提交设置文档；持久化失败时实时覆盖仍然保留。

该服务仅 Remote，不声明同进程 Cordis `Context` 合并。客户端包通过显式的 [`api-remotes`](../../api/remotes/README.zh.md) 组装消费，而不导入 Host 实现。

## 模型体验

### 技能目录成员

#### 模型看到的内容

本包自身不渲染任何模型文本：目录消息由 [`dsh-tool-skill`](../../skill/tool-skill/README.zh.md) 渲染并记录。本包改变的是成员输入——每次 `skillManager/setInvocation` 写入一个全局调用覆盖，注册表的 `list` 与 `get` 投影都应用它：有效策略为模型可调用的技能以 `name` 与归一化描述进入目录；翻转为仅用户可调用的技能则在下一次替换目录中退出条目。

#### Token 影响

覆盖本身零 token。其效应经由目录传导：把技能在模型可调用与仅用户可调用之间移动的翻转，改变替换目录携带哪些条目，该差值即目录消息的 token 成本，由 `dsh-tool-skill` 持有。

#### KV Cache 影响

不改写较早的请求 token。成员变化表现为追加在可复用前缀之后的替换目录（由 `dsh-tool-skill` 持有）；本包写的是设置，不是请求上下文。

## 已知限制与待办

- **仅显式覆盖** — Remote 没有"清除"操作：开关写入完整的下一策略，设置文档为每个触碰过的技能累积一条记录。与 provider 默认值相同的覆盖无害但会保留。
- **仅全局层** — 覆盖作用于所有作用域对注册表的视图，而非按预设或工作区隔离。
- **不监听外部编辑** — 网关运行期间用户在设置文档中的手工编辑，要等下次网关重启才生效。
