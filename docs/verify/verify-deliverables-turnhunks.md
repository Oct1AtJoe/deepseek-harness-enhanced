# 验证：产物面板「本轮 diff」 vs 「累计 badge」

## 背景

改动了 `ui-deliverables-custom` 插件：
- **chip 上的 `+N -M`** → 来自 `totalHunks`（整场会话累计）
- **展开面板的 diff 内容** → 来自 `turnHunks`（只当前 turn）
- **没有本轮改动的 turn** → chip 有 badge 但无展开箭头

## 验证步骤

### 1. 确认改动了什么

源码改动涉及 2 个文件：

| 文件 | 改动 |
|------|------|
| `packages/client/ui-deliverables-custom/src/client/turn-deliverables.ts` | 新增 `turnHunks` 字段，`selectProducedFiles` 返回 `hunks`（本轮）+ `totalHunks`（累计）|
| `packages/client/ui-deliverables-custom/src/client/ProducedFiles.tsx` | chip badge 用 `totalHunks`，展开面板用 `hunks` |

### 2. 前提

- `lib/client.js` 已编译（你刚跑的 `pnpm --filter ... bundle`）
- dsh web 正在运行（无论是 Tauri 壳子还是 `dsh web` 命令）
- 浏览器打开 `http://127.0.0.1:3080`

### 3. 测试场景

#### 场景 A：多轮修改同一文件

1. 打开一个**有多轮对话**的会话（比如你那个登录过期设置的会话）
2. 找到**最后一轮**（只改了一行 label 的那轮）
3. 观察产物面板：
   - ✅ chip 上显示 `+N -M`（累计值，如 `+30 -20`）
   - ✅ 点击展开 → 面板内只显示**本轮那行改动**（label 文本变化）
   - ✅ 面板标题栏的 `+N -M` 只算本轮（如 `+1 -1`）

#### 场景 B：没有改动的 turn 仍有累计 badge

1. 找一个**上一轮有改动、当前轮没有改动的 turn**（或者跨 turn 对话）
2. 观察产物面板：
   - ✅ chip 显示 `+N -M`（累计历史）
   - ✅ **无展开箭头**（chevron 不显示，因为本轮没有新 hunks）
   - ❌ 点击 chip 不会展开面板

#### 场景 C：单轮编辑

1. 新建一个会话，改一个文件一次（比如写几行文字）
2. 观察产物面板：
   - ✅ chip 显示 `+N -M`
   - ✅ 展开面板显示完整的本次改动
   - ✅ 面板内容 = chip badge 数值一致（因为只有一轮）

### 4. 验证清单

| # | 检查项 | 预期 |
|---|--------|------|
| 1 | 多轮会话最后一轮：chip badge | 显示**累计**值（如 +30 -20）|
| 2 | 多轮会话最后一轮：展开面板 | 只显示**本轮**改动的 diff |
| 3 | 多轮会话最后一轮：面板标题栏 | 显示本轮的 +N -M（如 +1 -1）|
| 4 | 跨 turn：chip badge | 仍显示累计值 |
| 5 | 跨 turn：展开箭头 | 本轮无改动时不显示 |
| 6 | 单轮：chip badge = 面板内容 | 数值一致 |
| 7 | 没有产物文件的 turn | 不显示产物面板 |
