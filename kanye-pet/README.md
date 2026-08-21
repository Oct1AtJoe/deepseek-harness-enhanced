# Kanye West Pet 🐋

English | [中文](README.zh.md)

A Kanye West character for the [whale-girl](https://github.com/vlln/whale-girl) desktop pet plugin.

## Install

### Prerequisites
- [whale-girl](https://github.com/vlln/whale-girl) plugin installed via DSH:
  ```bash
  dsh plugin --profile web add "github:vlln/whale-girl#main"
  ```

### Option A: One-click (Windows)
Double-click `install.bat`

### Option B: PowerShell
```powershell
.\install-kanye.ps1
```

### Option C: With custom size
```powershell
.\install-kanye.ps1 -Size 200
```

### Option D: Force reinstall (overwrite existing)
```powershell
.\install-kanye.ps1 -Force
```

## After Install
```bash
dsh --profile web restart
```
Then refresh the page (Ctrl+Shift+R hard refresh).

## Switch Characters
Click the pet → menu "🎭 换角色" to switch between 鲸鱼娘 and Kanye West.

## Settings
Edit `~/.dsh/settings.yaml`:
```yaml
whale-girl:
  size: 200   # pet size in px (64-300)
```

## Files
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
