# DeepSeek Harness

English | [中文](README.zh.md)

> **Local fixes branch.** This checkout tracks [upstream](https://github.com/deepseek-ai/deepseek-harness) master (snapshot `528c682e`, 2026-08-21) with a small set of local patches. The full diff is documented in [LOCAL-CHANGES.md](LOCAL-CHANGES.md). Custom feature packages (desktop shells, kanye-pet, ui-session-reference, etc.) have been extracted to `C:\dsh-ecosystem\`. Remote: `https://github.com/Oct1AtJoe/deepseek-harness-enhanced`

DeepSeek Harness (`dsh`) is an open-source agent harness built by [DeepSeek AI](https://deepseek.com).

It uses a **plugin-everything** architecture powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in the paper [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Local patches

Compared to upstream, this branch carries a focused set of Windows crash-dialog suppression fixes and platform hardening. See [LOCAL-CHANGES.md](LOCAL-CHANGES.md) for details:

- **`CREATE_DEFAULT_ERROR_MODE` semantics fix** — removed the flag so child processes inherit the parent's error mode suppression.
- **WER crash dialog suppression** — sets `DontShowUI` and `ExcludedApplications` registry keys to suppress Windows Error Reporting dialogs for `node.exe`, `cmd.exe`, `pwsh.exe`, `git.exe`, `where.exe`, `winget.exe`.
- **Main process `SetErrorMode`** — calls `SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS` on DSH process startup to suppress crash dialogs across the entire process tree.
- **`ui-msg-nav`** — message navigation rail plugin (kept in-tree).

### Syncing upstream

```powershell
powershell -File scripts/upstream-sync.ps1
git push origin master
```

The script downloads the upstream master tarball, commits it to the `upstream-master` mirror branch, then merges into `master`. Conflicts are limited to the files listed in [LOCAL-CHANGES.md](LOCAL-CHANGES.md).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is evolving quickly. **Breaking changes will occur.**

## Running

### Via `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

This starts the Web UI at `http://127.0.0.1:3080` by default, and also opens the page in the default browser when running locally. When running over SSH, only the host URL is printed because the forwarded address is held by the SSH client or editor. Pass `--no-open` to run the server without opening a browser. See the [Web UI guide](docs/user/guide/index.md).

### From source

```sh
git clone https://github.com/Oct1AtJoe/deepseek-harness-enhanced.git
cd deepseek-harness-enhanced
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the build artifacts. `pnpm dsh web` uses the already-built artifacts without rebuilding.

## Community & support

- Share feedback or report bugs via [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository to help others discover it.
- Join the DeepSeek Harness WeCom group — scan the assistant QR code and fill out the questionnaire.

<table>
  <thead>
    <tr>
      <th align="center">WeCom Assistant</th>
      <th align="center">Questionnaire</th>
      <th align="center">WeChat Official Account</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness WeCom Assistant QR" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness Questionnaire QR" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness WeChat Official Account QR" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Read the [development guide](docs/development.md) and [architecture document](docs/architecture.md) first.

For agent-oriented development: follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
