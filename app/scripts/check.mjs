import { readdir, readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }))).flat();
}
const files = (await Promise.all(['config', 'src', 'scripts', 'tests'].map(dir => walk(resolve(root, dir))))).flat();
let count = 0;
for (const path of files.filter(path => ['.js', '.mjs'].includes(extname(path)))) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${path}`);
  const text = await readFile(path, 'utf8');
  if (/\/Users\/[a-zA-Z]|\/var\/folders\//.test(text)) throw new Error(`Machine-specific path: ${path}`);
  count++;
}
console.log(`Syntax and portability checks passed for ${count} JavaScript files.`);
