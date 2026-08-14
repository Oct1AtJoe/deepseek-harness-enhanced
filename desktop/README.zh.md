# dsh-desktop

[English](README.md) | 中文

把 DeepSeek Harness 网页端(`dsh web`)包成桌面应用的 Electron 壳子。它是独立
包(不属于 pnpm workspace),这样 Electron 这套重依赖不会进仓库的安装和门禁。

## 运行

```sh
cd desktop
npm install
npm start
```

前置条件:仓库已构建(`pnpm run build`,保证 `apps/web/dist` 存在),且 `node`
在 PATH 中。

启动时按以下顺序解析后端:

1. `DSH_DESKTOP_URL` —— 直接加载该地址,不拉起后端。
2. `http://127.0.0.1:3080`(或 `DSH_DESKTOP_PORT`)已有 dsh 服务在跑 ——
   直接挂到现有服务上,共享会话。
3. 否则拉起 `dsh web --port 0`(系统分配空闲端口),解析它打印的 URL 并加载;
   退出应用时会把拉起的后端杀掉(Windows 上整棵进程树)。

## 配置

| 变量 | 含义 |
| --- | --- |
| `DSH_DESKTOP_URL` | 直接加载该 URL,跳过探测与拉起。 |
| `DSH_DESKTOP_PORT` | 探测已有服务用的端口(默认 `3080`)。 |
| `DSH_DESKTOP_BACKEND` | 后端命令覆盖:JSON argv 数组或空格分隔的字符串。 |
| `DSH_DESKTOP_NODE` | *(未使用 —— 开发模式下 CLI 跑在 Electron 自带的 Node 上)* |

`DSH_HOME`、`DEEPSEEK_API_KEY` 等 dsh 环境变量原样传给后端。

## 冒烟测试

`npm run smoke` 会无头加载 GUI(不显示窗口),成功时打印
`DSH_DESKTOP_SMOKE_OK` 并以 0 退出,失败时打印 `DSH_DESKTOP_SMOKE_FAIL: <原因>`
并以 1 退出。没有服务在跑时也会顺带覆盖"拉起后端"这条路径;把 `DSH_HOME`
指向一个全新目录即可隔离被拉起的实例(profile 首次使用会自动初始化)。

## 打包

`npm run pack` 用 electron-builder 出安装包(Windows NSIS / macOS DMG /
Linux AppImage)。打包后的应用不内置 dsh 运行时:它会从 PATH 找 `dsh` 命令,
所以运行打包应用的机器需要装好 dsh(如 `npm i -g @deepseek-ai/dsh`),或用
`DSH_DESKTOP_BACKEND` 指定。

## 已知限制

- 本质是套在本地服务外的浏览器窗口:只有标准 Edit/View/Window 菜单,没有
  托盘、开机自启等原生能力。
- 尚未加入品牌图标,用的是 Electron 默认图标。
