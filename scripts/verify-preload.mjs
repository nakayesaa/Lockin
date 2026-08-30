import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const preloadPath = resolve('out/preload/index.cjs');
const source = await readFile(preloadPath, 'utf8');
const imports = [...source.matchAll(/^\s*import\s/gm)];
const requiredModules = [...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(
  ([, moduleName]) => moduleName,
);
const unsupportedModules = [...new Set(requiredModules)].filter(
  (moduleName) => moduleName !== 'electron',
);

if (imports.length > 0 || unsupportedModules.length > 0) {
  const details = unsupportedModules.length
    ? ` Unsupported require calls: ${unsupportedModules.join(', ')}.`
    : '';
  throw new Error(`Sandboxed preload must be one bundled CommonJS file.${details}`);
}

console.log('Sandboxed preload bundle verified.');
