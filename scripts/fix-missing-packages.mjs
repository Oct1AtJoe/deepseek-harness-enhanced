import { mkdirSync, writeFileSync } from 'node:fs'

const tsconfig = [
  '{',
  '  "extends": "../../tsconfig.base.client.json",',
  '  "compilerOptions": {',
  '    "rootDir": "src",',
  '    "outDir": "lib/types"',
  '  },',
  '  "include": ["src"]',
  '}',
  '',
].join('\n')

const index = 'export {}\n'

for (const pkg of ['ui-settings-skills', 'ui-settings-subagents']) {
  const dir = `packages/client/${pkg}`
  mkdirSync(`${dir}/src`, { recursive: true })
  writeFileSync(`${dir}/tsconfig.json`, tsconfig)
  writeFileSync(`${dir}/src/index.ts`, index)
  console.log(`Created ${dir}`)
}
