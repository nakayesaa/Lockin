import { join } from 'node:path';

export function getPreloadPath(mainDirectory: string): string {
  return join(mainDirectory, '../preload/index.mjs');
}
