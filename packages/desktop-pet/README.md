# @deepseek-ai/dsh-desktop-pet

DSH 内置桌面宠物，兼容 whale-girl 角色协议。

## 特性

- 🐋 右下角悬浮宠物（可拖拽、可投喂/玩耍）
- 🎭 多角色支持（鲸鱼娘 + Kanye West，可扩展）
- 🔔 气泡通知（DSH 事件实时推送到宠物）
- 🖱️ 点击气泡跳转到对应对话
- 🖥️ Tauri2 独立壳子（透明置顶窗口）

## 安装

```bash
# 安装依赖
pnpm install

# 开发模式（Tauri 桌面）
cd desktop
cargo tauri dev

# 构建产物
cd desktop
cargo tauri build
```

## 使用

### Web GUI
宠物自动注入到 DSH Web GUI，右下角悬浮显示。

### 桌面壳子
```bash
cd desktop
npm run tauri dev    # 开发
npm run tauri build  # 构建
```

## 设置

在 `~/.dsh/settings.yaml` 中添加：
```yaml
desktop-pet:
  enabled: true
  size: 200
  character: whale-girl   # whale-girl 或 kanye
```

## 添加新角色

参考 `docs/adding-a-character.md`（whale-girl 协议）：
1. 准备 15 张 sprite sheet（256×256，透明背景）
2. 放入 `src/assets/characters/<id>/`
3. 在 `src/assets/manifest.json` 中添加角色条目

## License

MIT
