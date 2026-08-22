# DeepSeek Harness Enhanced

[English](README.en.md) | 中文

> **本地增强分支。** 本检出为官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) master（快照 `528c682e`，2026-08-21）叠加本地定制（始于 2026-08-14，持续增量更新）。功能清单、重放步骤与合并冲突指引见 [CUSTOM-FEATURES.md](CUSTOM-FEATURES.md)。远程仓库：https://github.com/Oct1AtJoe/deepseek-harness-enhanced

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 本地增强

在官方 master 之上的定制功能（持续增量，始于 2026-08-14）。已插件化的功能在上游同步时零冲突；其余为包内小改动，按 [CUSTOM-FEATURES.md](CUSTOM-FEATURES.md) 重放：

- **per-model 思考程度记忆** — 切换模型不再把思考程度重置为适配器默认；新会话继承记忆。
- **失败轮重发按钮** — 失败的助手回复旁新增刷新动作，一键重发该轮文本（`@deepseek-ai/dsh-client-ui-resend-failed-round` 插件）。
- **图片发送开放** — deepseek 适配器不再拒绝图片内容。
- **子智能体 tab 与计数** — 子智能体工作视图 tab + 输入区带运行数量徽标的按钮。
- **跨工作区会话引用** — `@` 触发会话候选与注入的引用会话上下文（`ui-session-reference` 插件）。
- **产物文件 diff 统计** — 文件 chip 显示 `+N -M` 并可展开本轮改动（`@deepseek-ai/dsh-client-ui-deliverables-custom` fork）。
- **aurora / nebula 主题** — 带光晕的科技风主题与圆角像素风按钮。
- **桌面壳** — Electron 封装（`desktop/`）与 Tauri 2 壳（`desktop-tauri/`），启动或挂接 `dsh web`；支持 WinRT 通知、外部链接系统浏览器打开。
- **LLM 重试次数提升** — 默认最大重试次数从 2 次提升到 10 次（`DEFAULT_MAX_RETRIES`），提高在高负载或瞬时故障下的恢复成功率。
- **桌面宠物 kanye-pet** — Tauri 2 桌面宠物窗口，Kanye West 角色，通知气泡感知 DSH 会话进度，点击切回主窗口（`packages/desktop/kanye-pet/` + `ui-kanye-pet` 设置面板）。
- **会话完成通知** — 浏览器系统 toast 通知：每轮会话完成弹出，按结果类型开关，显示会话标题（`dsh-notification-custom` 插件）。
- **消息导航轨** — 对话右侧导航轨，每条用户消息对应竖线标记，跟踪阅读位置，悬停预览卡片，点击跳转（`ui-msg-nav` 插件）。
- **子智能体后台管理** — Web 设置新增"子智能体"tab：已安装后台目录，支持安装/删除/重配（`host-subagent-manager` + `ui-settings-subagents`）。
- **技能管理** — Web 设置新增"技能"tab：浏览、查看详情、开关调用覆写（`host-skill-manager` + `ui-settings-skills`）。
- **Nebula 液态玻璃主题** — 星云主题全面磨砂玻璃效果：半透明表面 + `backdrop-filter` 模糊，极光底图透过面板；按钮玻璃化（漂移动画+高光描边）。
- **pi-ai 图片占位符** — 文本模态 pi-ai 模型发图不再抛错，转为文本占位符 `[image attachment ...]`，与 deepseek 适配器一致。

### 同步上游

```powershell
powershell -File scripts/upstream-sync.ps1
git push origin master
```

脚本下载官方 master tarball，提交到 `upstream-master` 镜像线，再合并进 `master`。冲突仅限 CUSTOM-FEATURES.md 中列出的包内定制点。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/Oct1AtJoe/deepseek-harness-enhanced.git
cd deepseek-harness-enhanced
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库构建产物。`pnpm dsh web` 使用已构建的产物，无需重复构建。

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
