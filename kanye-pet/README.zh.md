# Kanye West 宠物 🐋

[English](README.md) | 中文

为 [whale-girl](https://github.com/vlln/whale-girl) 桌面宠物插件提供的 Kanye West 角色。

## 安装

### 前置条件
- 已通过 DSH 安装 [whale-girl](https://github.com/vlln/whale-girl) 插件：
  ```bash
  dsh plugin --profile web add "github:vlln/whale-girl#main"
  ```

### 方式 A：一键安装（Windows）
双击 `install.bat`

### 方式 B：PowerShell
```powershell
.\install-kanye.ps1
```

### 方式 C：自定义尺寸
```powershell
.\install-kanye.ps1 -Size 200
```

### 方式 D：强制重装（覆盖已有）
```powershell
.\install-kanye.ps1 -Force
```

## 安装后
```bash
dsh --profile web restart
```
然后刷新页面（Ctrl+Shift+R 强制刷新）。

## 切换角色
点击宠物 → 菜单「🎭 换角色」，在鲸鱼娘与 Kanye West 之间切换。

## 设置
编辑 `~/.dsh/settings.yaml`：
```yaml
whale-girl:
  size: 200   # pet size in px (64-300)
```

## 文件
```
kanye-pet/
├── install.bat            ← double-click to install
├── install-kanye.ps1      ← PowerShell installer
├── assets/
│   ├── manifest.json      ← character definition
│   └── characters/kanye/  ← 15 sprite sheets
│       ├── idle.v2.png
│       ├── walk.v2.png
│       └── ...
└── README.md
```
