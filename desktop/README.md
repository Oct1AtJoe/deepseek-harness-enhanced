# DSH Desktop Pet — 内置桌面宠物

DSH 内置桌面宠物，兼容 whale-girl 角色协议，支持 Tauri2 独立壳子。

## 架构

```
┌─────────────────────────────────────────────┐
│ DSH Server (port 3080)                       │
│                                              │
│  /desktop-pet/events  ← SSE 事件流           │
│  /desktop-pet/presence ← 心跳               │
│  /desktop-pet/assets/* ← 静态资源            │
│                                              │
│  packages/desktop-pet/ (内置包)              │
│    ├── src/index.mjs (服务端)                │
│    ├── src/settings.mjs (设置)               │
│    └── src/assets/ (素材)                    │
└──────────────────┬──────────────────────────┘
                   │ HTTP/SSE
┌──────────────────┴──────────────────────────┐
│ Tauri2 壳子 (desktop/)                       │
│                                              │
│  src/pet.js ← 宠物渲染 + 气泡通知            │
│  src-tauri/src/main.rs ← Rust 端             │
│  src/index.html ← 入口                       │
└─────────────────────────────────────────────┘
```

## 安装

```bash
# 1. 拉取代码
git pull

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm run build

# 4. 启动 DSH Web
dsh --profile web

# 5. 启动桌宠（另一个终端）
cd desktop
npx tauri dev
```

## 功能

- 🐋 右下角悬浮宠物（可拖拽、可投喂/玩耍）
- 🎭 多角色支持（鲸鱼娘 + Kanye West）
- 🔔 气泡通知（DSH 事件实时推送）
- 🖱️ 点击气泡跳转到对应对话
- 💤 空闲自动休眠

## 设置

`~/.dsh/settings.yaml`:
```yaml
desktop-pet:
  enabled: true
  size: 200
  character: whale-girl   # whale-girl 或 kanye
```

## License

MIT
