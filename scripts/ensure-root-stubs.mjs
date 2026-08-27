import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'lib', 'types')
mkdirSync(dir, { recursive: true })
for (const f of ['index.js', 'invariant.js', 'startup.js']) {
  writeFileSync(join(dir, f), 'export {}\n', 'utf8')
}
