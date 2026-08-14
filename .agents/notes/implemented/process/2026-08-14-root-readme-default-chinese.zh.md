# Agent Note: 根 README 在 GitHub 默认中文

Status: implemented

[English](2026-08-14-root-readme-default-chinese.md) | 中文

## Problem

GitHub 只在仓库首页渲染根目录 `README.md`。原配对把英文放在 `README.md`、中文放在 `README.zh.md`，因此本 fork 的 GitHub 页面默认显示英文。fork 所有者希望首页默认中文，英文一键可达。

## Decision

根 README 配对已换位：`README.md` 现为中文内容，英文对侧为 `README.en.md`。切换行分别为中文侧 `[English](README.en.md) | 中文` 与英文侧 `English | [中文](README.md)`。

根 README 对已从机械双语配对门禁排除：`README.md` 加入 `scripts/translation-pairing.manifest.json` 排除清单，`README.i18n.yaml` 已删除（被排除文件不得带 `.zh.md` 与 `.i18n.yaml`）。`README.en.md` 本就不进入配对范围——发现正则 `README_ARTIFACT` 只匹配 `.md`、`.zh.md`、`.i18n.yaml` 结尾。该对仍保持双语并手工维护；例外记入配对契约的范围章节（docs/i18n/README.md，双语），同步冲突处理记入 CUSTOM-FEATURES.md。

配对机制的英文源约定——英文为无后缀 `foo.md`、中文为 `foo.zh.md`——对语料库其余文档一律不变。

提示词流水线跟随换位：`scripts/verify-translation-prompt.ts` 的示例对、`docs/i18n/translation-prompt.md` 的金标对清单与切换行示例、以及已记录的 prompt 快照现在都点名 `README.en.md` ↔ `README.md`。few-shot 内容与换位前是同一批文档，因此渲染出的提示词逐字节相同；快照仅为名称变更而重录。四处文档配对中的根 README 锚点链接现指向 `README.en.md`（`#run`、`#run-from-source`）。

两个 README 结构不合门禁的 fork 包（`ui-resend-failed-round`、`ui-session-reference`）在 `verify-package-readme-model-experience.ts` 中新增带审计理由的句子式条目，并补齐规范的 `## Model Experience` 与 `## Known Limitations and Deferred Work` 章节。同一变更还补齐了其余预存配对门禁欠账：desktop README 对缺一致性记录与两侧切换行；ui-theme README 对失同步；两个插件 README 存在硬换行散文。全语料配对门禁通过 942 对。

## Alternatives considered

- **泛化配对工具链支持 `.en.md` 对侧**：让发现逻辑、配对角色解析、合并驱动与 brief 生成器接受中文占据无后缀侧。要为单个 fork 门面文件重做五个脚本及其规格测试与契约文档，而其余语料全部保持英文源约定。
- **内容互换但保留文件名**（英文装进 `README.zh.md`）：门禁机械上会通过，但文件名与其语言相悖，会误导所有后来的维护者与工具。
- **从门禁排除该对（采纳）**：门面文件属 fork 政策而非语料政策；该对保持双语并手工维护，偏差写入契约文档而非悄悄削弱门禁。

## Consequences

- fork 的 GitHub 页面现在默认渲染中文。
- 配对机制本身未动；提示词示例路径、两个包 README 审计条目、过期记录与 prompt 快照随变更更新，全语料门禁通过（942 对）。
- 根 README 对失去机械一致性检查与记录哈希恢复指针；两侧同步从此为手工维护。
- 每次上游同步都会在 `README.md`（上游英文 vs fork 中文）与 `README.zh.md`（上游文件 vs fork 已删除）上冲突；CUSTOM-FEATURES.md 记录了处理方式。
