import { rmSync } from 'node:fs'
import { join } from 'node:path'
try { rmSync(join(process.cwd(), 'lib', 'types'), { recursive: true, force: true }) } catch {}
