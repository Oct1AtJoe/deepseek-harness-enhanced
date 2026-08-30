# Agent Note: 让两位错误模式抑制位贯通 Windows ACL runner

Status: implemented

[English](2026-08-29-windows-acl-error-mode-suppression-pair.md) | 中文

## 问题

桌面部署报告：`workspace-write` 会话策略下命令执行成功，但桌面弹出 `cmd.exe`"应用程序错误"对话框。这些崩溃面没有留下任何 WER 事件、可靠性记录或 ReportArchive 条目——据此可判定该对话框是进程初始化失败（`0xC0000142` 一族）的 CSRSS hard-error 框，而非 WER 接管的崩溃。两层抑制机制原本已在位——继承的 `SetErrorMode` 位，以及 `dsh-sandbox-policy` 的注册表键（宿主上已验证存在 `DontShowUI` + `ExcludedApplications`）——而对话框仍然出现：WER 层够不到这个框，错误模式层成为剩余嫌疑。

服务端在启动时设置 `SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS`（`dsh-sandbox-windows-acl/src/index.ts`），不带 `CREATE_DEFAULT_ERROR_MODE` 创建的子进程继承调用者的当前模式。但 `SetErrorMode` 是替换而非按位或：runner 在模块加载时和 `main()` 里都只重设了 `SEM_NOGPFAULTERRORBOX`，把继承来的 `SEM_FAILCRITICALERRORS` 位清掉了。于是每个受限子进程继承到的是单位模式——服务端意图中的全进程树抑制，恰好在启动受限树的这一跳被静默降级。

## 决策

runner 的两处 `setErrorMode` 调用点现在成对设置 `SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS`，并在每处注明替换语义；spawn 点的继承注释同时点名两位。runner 套件端到端钉住该契约：受限子进程通过 koffi 调 `GetErrorMode` 读回自身模式，断言掩掉 `SEM_NOOPENFILEERRORBOX`——现代 Windows 无论 `SetErrorMode` 写了什么都恒报该位。包 README 在其余已验证边界旁记录了这个两位继承契约。

一次针对性实验采用经验上必然失败的形态（受限令牌 + `CREATE_NO_WINDOW`，即 win32-abi 记录的 `0xC0000142` 形态）在调查主机上于两种候选模式下都静默死亡，因此本修复已被证明能恢复预期的抑制面，但尚未被证明能消除报告者的弹窗：那个弹窗的确切触发点位于任意命令链派生的 `cmd.exe` 内部，在控制台宿主、无控制台宿主、探测形态下均未复现。本修复关闭了证据确实确立的那一个缺陷；如果桌面仍出现弹窗，需要的下一个数据是触发它的确切命令。

## 备选方案

**依赖 WER 注册表层。** 已处于激活状态（宿主上验证过 `DontShowUI=1`、`cmd.exe` 在排除列表）且明显不足：该弹窗没有留下任何 WER 痕迹，hard-error 路径完全绕过 WER。

**传 `CREATE_DEFAULT_ERROR_MODE`。** 拒绝：子进程将取系统默认模式而非继承调用者的位，连 `SEM_NOGPFAULTERRORBOX` 都会失去，弹窗窗口反而变宽而非收窄。

**修复触发命令。** 暂不采纳：`cmd.exe` 由被执行的命令链派生（`.cmd`/`.bat` shim、内部 `cmd /c` 调用），harness 无法控制；错误模式契约是覆盖所有此类后代的唯一一层。

## 后果

受限进程树端到端保住两位抑制位；若未来 runner 改动再次降级模式，套件会失败。两位覆盖之外的对话框——如果仍能到达桌面——需要先定位其触发点才能进一步抑制；调查产物（WER 注册表状态、事件日志缺席、复现形态）记录于此，作为后续跟进的基线。
