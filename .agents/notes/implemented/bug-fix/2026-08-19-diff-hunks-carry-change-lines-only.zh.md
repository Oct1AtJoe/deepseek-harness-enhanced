# Agent Note: 应用的 diff hunk 只携带变更行

Status: implemented

[English](2026-08-19-diff-hunks-carry-change-lines-only.md) | 中文

## 问题

一次 write 或 edit 轮次展示的 `+A -R` 行数与其实际改动对不上，diff 卡还把未变的上下文行既渲染成删除又渲染成新增。

`packages/fs/tool-fs/src/diff.ts` 的 `computeHunkDiffs` 通过 `structuredPatch(..., { context: 3 })` 构造每个应用 hunk，并把每一行上下文（未变）行同时推进 `oldText` 与 `newText`。web 端 `DiffBlock`（官方 `ui-primitives` 副本与 `ui-deliverables-custom` fork）把 `oldText` 每一行画成删除行、`newText` 每一行画成新增行，并全部计数。渲染意图契约 `FileDiff` 的形状没有任何办法把一行标为上下文，于是每侧 3 行上下文在单个 hunk 上变成了 3 行幻影删除加 3 行幻影新增。一个真实的 `-4 +9` 函数替换在周围区域提供足够上下文时读作 `-13 +18`，且同一批未变行出现了两次——一次红、一次绿。

## 决策

`computeHunkDiffs` 不再向 `structuredPatch` 索要上下文（`context: 0`），因此每个 hunk 的 `oldText` 与 `newText` 恰好携带被删除与被新增的行。UI 可以直接从这两段文本数出 `+A -R`，diff 卡也只展示变更本身。这让 `write`/`edit` 与 `str_replace_editor` 对齐——后者的 call view 早已用不带上下文的裸 `old_str`/`new_str` 块上报。`DIFF_CONTEXT` 被移除。

持久化的 `tool/result` `meta` 携带同一 hunk 形状，因此回放与实时渲染一致；已记录的会话保留其已记录的 hunk。变更-only hunk 不会越过 whole-file 兜底所针对的字节/长度边界，因此 `write` 的 `before: null` 边界行为不受影响。

## 曾考虑的替代方案

**保留上下文并标记未变行。** `FileDiff` 形状需要新增逐行 kind 或并行的未变侧字段。因规模不当而否决：这会改动横跨工具 seam、`str_replace_editor`、会话持久化与所有渲染器的 wire 契约，只为换取一个当前形状根本无法表达的视觉点缀。

**让渲染器只统计 `oldText` 与 `newText` 之间不同的行。** 一旦上下文被混进两段文本，客户端便无法区分上下文行与变更行；在浏览器里重做 diff 等于在客户端重造宿主 hunk 逻辑，且当某行变更文本恰好等于上下文时仍会误读。宿主掌握行的种类，因此丢弃上下文的地方是宿主。

**只在自定义面板里剥离上下文。** 修好一个表面而官方 tool 卡仍然错误；根因是共享的，因此修复落在共享的生产者处。

## 后果

diff 卡与 produced-files 的 `+A -R` 徽标现在上报应用改动自身的行数。`+N file(s)` 页脚与去重文件数不变。

录制一个轮次的 `meta` 如今存更小、更精确的 hunk；旧日志按其记录的 hunk 原样回放，因此历史保持其原有数字。

diff 卡不再提供用于在文件内定位改动的周围上下文。卡片是「改了什么」的摘要，且面向模型的工具在 `read` 时返回完整当前文件，读者仍可找回被丢弃的上下文。若未来的渲染器想要中性的上下文行，那是新的 `FileDiff` 形状，而非重载这个 bug。

## 测试

`packages/fs/tool-fs/tests/diff.spec.ts` 钉住变更-only hunk：单行变更得到 `oldText: 'line4'` / `newText: 'CHANGED'`，分散替换保持独立 hunk，并用一条无上下文断言取代旧的 `DIFF_CONTEXT` 测试。`packages/fs/tool-fs/tests/tools.spec.ts` 把 edit 与 write-overwrite 的应用 `meta` 与结果视图钉为裸 `OLD`/`NEW` 块。客户端套件（`ui-primitives` DiffBlock、`ui-deliverables-custom`）与 assembled-boot 快照原样通过，因为 create 的 `oldText: null` hunk 与去重文件数计数从不依赖上下文。

## 相关

- [Web diff 卡片](../feature/2026-07-30-web-diff-card.md) —— 把应用的 hunk 送到浏览器的功能；本修复纠正该 result view 携带的 hunk。
