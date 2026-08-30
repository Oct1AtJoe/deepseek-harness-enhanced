# local-patches — 本地补丁重放

[English](README.md) | 中文

保存站在官方上游（deepseek-ai/deepseek-harness）之上维护的本地修改。从 upstream 同步（merge 或 rebase）覆盖或丢失这些改动后，在仓库根运行一条命令即可重新打上：

```sh
bash local-patches/apply-local-patches.sh
```

## 行为

- 工作区能干净应用时，脚本直接应用该补丁。
- 补丁已存在于工作区（反向 check 通过）时跳过，因此重复运行是安全的。
- 两个检查都失败时，脚本以非零退出码报 CONFLICT：需要手工处理，通常是 upstream 修改了同一区域——手工合入补丁意图后重新生成补丁文件。

脚本自行定位仓库根，所有 git 操作都在仓库根执行。补丁新增的文件（如 Agent Note）保持未跟踪状态，随下次提交一起纳入版本控制。

## 当前补丁

- `2026-08-29-windows-acl-error-mode-suppression-pair.patch` — Windows ACL runner 崩溃对话框两位抑制修复（`SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS` 成对保留），对应 `.agents/notes/implemented/bug-fix/` 下同名 Agent Note。

## 维护约定

- 补丁文件与对应 Agent Note 同名。
- 修改某个本地修复后，重新生成其补丁并提交：

  ```sh
  git add -N <new-files...>
  git diff -- . ':(exclude)vendor/**' > local-patches/<patch-name>.patch
  ```

- 某个修复被 upstream 采纳后，删除对应补丁文件。
- 本目录属于 fork 维护者本地设施，不进入向 upstream 提交的 PR。
