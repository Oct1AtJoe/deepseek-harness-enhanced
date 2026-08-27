/**
 * Build the host lib: tsc type-check, create root stubs for tsdown, run
 * tsdown, then clean up stubs. Propagates tsdown's exit code.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// 1. tsc type-check
const tsc = spawnSync('npx', ['tsc', '-b', 'tsconfig.host.json'], { cwd: root, stdio: 'inherit', shell: true })
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

// 2. Create root stubs so tsdown resolves the root package entry glob
const libTypes = join(root, 'lib', 'types')
mkdirSync(libTypes, { recursive: true })
for (const f of ['index.js', 'invariant.js', 'startup.js']) {
  writeFileSync(join(libTypes, f), 'export {}\n', 'utf8')
}

// 3. Run tsdown
const tsdown = spawnSync('npx', ['tsdown', '--env.DSH_BUILD_FACE', 'host'], { cwd: root, stdio: 'inherit', shell: true })
const tsdownOk = tsdown.status === 0

// 4. Clean up stubs (always)
try { rmSync(libTypes, { recursive: true, force: true }) } catch {}

process.exit(tsdownOk ? 0 : (tsdown.status ?? 1))
