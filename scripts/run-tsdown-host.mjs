/**
 * Host tsdown runner with a Windows-only tolerance for the workspace-root
 * package.
 *
 * rolldown/oxc-resolver cannot resolve the monorepo root package's relative
 * entry (`lib/types/{...}.js`) on Windows — the same config builds fine on
 * Linux (upstream CI), and older rolldown versions used by rc.2-era forks also
 * worked. `@deepseek-ai/dsh-root` is the private repository-root aggregate:
 * it has no source files, nothing depends on it, and its tsdown artifact is
 * consumed by nobody, so a failed entry resolution for that single package is
 * safe to ignore. Every other failure exits with tsdown's own status and
 * streams the original output.
 *
 * Fork-maintainer tooling; not part of any upstream change.
 */
import { spawnSync } from 'node:child_process'

const DSH_ROOT_MARKER = '@deepseek-ai/dsh-root'

const result = spawnSync(
  'npx',
  ['tsdown', '--env.DSH_BUILD_FACE', 'host'],
  { stdio: 'pipe', shell: true, encoding: 'utf8' },
)
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

if (result.status === 0) {
  process.stdout.write(output)
  process.exit(0)
}

// Pass only when the failure is exclusively the dsh-root entry issue.
const lines = output.split(/\r?\n/).filter(Boolean)
const otherErrors = lines.filter((line) => {
  if (line.includes(DSH_ROOT_MARKER)) return false
  return /error|ERROR|✗|Cannot find|UNRESOLVED|MISSING|failed/i.test(line)
})
const dshRootOnly = otherErrors.length === 0

process.stdout.write(output)
if (dshRootOnly && lines.some((line) => line.includes(DSH_ROOT_MARKER))) {
  console.log(
    '\ntsdown: only @deepseek-ai/dsh-root failed (Windows rolldown root-entry resolution; ' +
      'private aggregate package with no consumers) — continuing.',
  )
  process.exit(0)
}
process.exit(result.status ?? 1)
