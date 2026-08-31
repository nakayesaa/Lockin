import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const releaseDirectory = resolve(root, 'release');
const packageMetadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const artifactName = `LockIn-Setup-${packageMetadata.version}-x64.exe`;
const artifactPath = resolve(releaseDirectory, artifactName);
const unpackedExecutable = resolve(releaseDirectory, 'win-unpacked', 'LockIn.exe');
const packagedApplication = resolve(releaseDirectory, 'win-unpacked', 'resources', 'app.asar');

for (const path of [artifactPath, unpackedExecutable, packagedApplication]) {
  const details = await stat(path).catch(() => null);
  if (!details?.isFile() || details.size === 0) {
    throw new Error(`Missing or empty release file: ${path}`);
  }
}

const installer = await readFile(artifactPath);
if (installer[0] !== 0x4d || installer[1] !== 0x5a) {
  throw new Error(`${artifactName} is not a Windows executable`);
}

const digest = createHash('sha256').update(installer).digest('hex');
const checksumPath = `${artifactPath}.sha256`;
await writeFile(checksumPath, `${digest}  ${basename(artifactPath)}\n`, 'utf8');

console.log(`Verified ${artifactName}`);
console.log(`SHA-256 ${digest}`);
