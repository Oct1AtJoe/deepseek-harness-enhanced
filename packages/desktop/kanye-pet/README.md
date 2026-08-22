# whale-girl

English | [中文](README.zh.md)

<p align="center">
  <strong>A desktop pet (QQ-pet style) inside the DSH Web GUI</strong><br/>
  A floating companion in the bottom-right corner: draggable, feedable/playable, keeping the pulse of your workbench — completed tasks, sessions, and active companion time accumulate into seniority levels, titles, and memories.
</p>

<p align="center">
  <img src="https://badgen.net/badge/license/MIT/green" alt="license" />
  <img src="https://badgen.net/badge/format/official%20bundle/8257D0" alt="official bundle" />
</p>

---

## Install

Official **bundle plugin** format (`dsh.bundle` + `dsh.client` in the root `package.json`), managed through the official profile:

```sh
dsh plugin --profile web add "github:vlln/whale-girl#main"   # recommended: one-liner from the git source (built artifacts are in the repo)
# or a local directory: dsh plugin --profile web add <path to local whale-girl>
```

After installing, **restart web** (the bundle layer composes at boot) and the pet appears in the bottom-right corner: click for a menu (🍗 feed / 🎾 play), drag to move; hover shows the status bar (seniority level / task count / most recent shared memory). The pet is hidden on the initial setup/welcome (onboarding) page.

To update, run `dsh plugin --profile web update whale-girl` (or switch the git source ref) and restart.

## Usage

| What you do / what happens | Pet behavior |
|---|---|
| Drag the pet | Pulled diagonally (`drag`) |
| Click menu 🍗 feed / 🎾 play | Nibbles / tosses a ball (`eat`/`play`) → happy (`joy`) |
| Idle ≥60s | Dozes (`sleep`); wakes on interaction (`wake`) |
| Task done / level-up / title / round complete | Raises a paw to cheer (`celebrate`) |
| Task failed / request error | Startled (`error`) → sad (`disappointed`) |
| New session starts | Waves to welcome (`welcome`) |
| Any session running/thinking | Contemplative company (`think`, occasionally the `working` pose) |
| Waiting for approval | Expectant wait (`wait`) |
| Periodic wander | Takes a stroll (`walk`) |
| Normal state | Stands by (`idle`, random blinking/turning) |

The full state machine (priority, transition semantics, trigger sources) is documented in the Chinese developer notes (see the `docs/` subdirectory).

## Desktop companion (optional)

`desktop/` is a **standalone desktop companion app** (Node engine + Tauri render shell, zero runtime dependencies) that renders the whale girl onto the operating system desktop, persistently. It is **not installed with `dsh plugin`** — users who want a desktop pet enable it themselves:

```sh
# prerequisites: Node >=18; the desktop render shell needs the Rust toolchain (cargo)
cd desktop
npm install                          # the engine is dependency-free (no third-party packages)
cd src-tauri && cargo build --release  # first build takes ~5-15 min; binary at target/release/whale-girl-desktop (~12MB)
./target/release/whale-girl-desktop   # start the transparent always-on-top pet (connects to the local DSH on 3080 by default)
# point WHALE_GIRL_BASE_URL=http://IP:PORT at a non-local DSH
# windowless mode: cd desktop && npm run start:headless  # presence heartbeat + state polling + SSE
```

- Consumes whale-girl's existing public endpoints (`/state`, `/events`, `/presence`, `/interact`, `/config`, `/assets`) and **does not modify the plugin itself**; while it runs, the web pet hides automatically (presence contract), and it restores on exit or crash (TTL 45s expiry).
- Render shell: Tauri v2 (recommended, ~12MB); the legacy Electron shell is kept (available after `npm i -D electron`).
- Design and contract: `desktop/DESIGN.md`, `desktop/BUILD-RUN.md`.

## State previews

| State | Trigger |
|---|---|
| `idle` | Normal stand-by |
| `working` | Random work interlude during a thinking session |
| `celebrate` | Task done / level-up / title / round complete |
| `error` | Task failed / request error |
| `disappointed` | Short sadness after a failure |
| `joy` | Happy after feeding/playing |
| `eat` | Click to feed |
| `play` | Click to play |
| `drag` | While dragging |
| `walk` | Periodic wander |
| `sleep` | Idle ≥60s |
| `wake` | Waking transition |
| `welcome` | New session |
| `think` | Thinking-company |
| `wait` | Waiting for approval |

Preview GIFs for each state are tracked in a separate assets branch and not yet included in this repository.

## Configuration

Settings are configured through the host settings: edits to the `whale-girl:` section of `<dshHome>/settings.yaml` (or the settings UI) take effect **hot, without a restart**:

```yaml
whale-girl:
  enabled: true      # web-render toggle (set false to hide the web pet while the desktop companion runs, avoiding a double pet)
  size: 110          # pet size in px (64-160)
  opacity: 1         # normal-state opacity (0.2-1)
  walk:
    enabled: true    # walk toggle
  sleepAfterMs: 60000
```

The full key list and the closed semantics layer (XP/titles) are documented in `lib/src/config.mjs`. **The semantics layer is not configurable** (changing XP/title thresholds would break the accumulation ledger's consistency).

## Characters

The menu's "🎭 switch character" cycles characters (or set localStorage `whale-girl:character`); **the button is disabled when the manifest has only one character** (hover hint: "no other character"). Each character provides **all 15 states** of assets; the sprite specification and new-character contribution guide are documented in the Chinese developer notes (see the `docs/` subdirectory).

## As a reference implementation

whale-girl is the complete exemplar of the official **bundle plugin format** (`dsh.bundle` + `cordis.patch.yml` + `lib/` layout, evolving with the official mechanism) — new plugin development can mirror it:

- **Structure**: `lib/` (entry / pure logic / client / assets) kept separate from docs/decisions/scripts
- **Discipline**: gates (`scripts/gates/run.mjs`) + decision records + full-asset contract; the development onboarding lives in plugin-registry's [plugin-registry-create skill](https://github.com/vlln/plugin-registry/tree/main/skills/plugin-registry-create) and [cookbook](https://github.com/vlln/plugin-registry/blob/main/docs/cookbook/creating-a-repository-plugin.md), and the pitfalls hit are in [gotchas](https://github.com/vlln/plugin-registry/blob/main/skills/plugin-registry-create/references/gotchas.md)

## Contributing

**Issues and suggestions are welcome** — your feedback directly shapes the pet's next step:

- 🐛 **Hit a problem**: file an issue with reproduction steps, browser and dsh versions; for client problems, include the console error if you can
- 💡 **Feature suggestion**: read the Chinese developer notes (`docs/` subdirectory) for the current state machine and growth system, then describe the expected effect
- 🎨 **New character**: see the sprite specification and adding-a-character guide (Chinese developer notes) — produce 15 sheets + a manifest entry, and accept locally with `verify-assets`
- 🔧 **Code contribution**: every non-trivial change ships with a decision record (`decisions/`), gate self-proof, and a single-topic commit

## Credits

The character art is by [ZipZipPipe](https://space.bilibili.com/4168597) (《whale-girl》 meme character); the sprites are generated from the character's design.

## License

MIT License

## Model Experience

None, as the bundle adds a desktop pet overlay to the GUI; it produces no model-visible output, consumes no model input, and modifies no tool results.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The pet runs in a separate HTML Canvas overlay on the page, controlled by its own `lib/client.js` bundle. The overlay is not responsive to the GUI's light/dark/system preference — always a dark-themed container.
- The state machine, growth system, and multi-sprite character framework are implemented but documented only in the Chinese developer notes (`docs/` subdirectory). English developer docs are deferred.
- Preview GIFs for each emotion state are not yet included in the repository; they are tracked in a separate assets branch.
- The `lib/client.js` bundle is built with esbuild and checked into the repository — it should be regenerated after any client-side change (`pnpm build:client`).
- Adding a new character requires creating sprite sheets at the correct pixel sizes and adding a manifest entry. This is straightforward but not yet automated.
