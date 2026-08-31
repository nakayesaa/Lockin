// @vitest-environment node

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLogger, initializeFileLogging } from '../../src/main/logger';

describe('production logger', () => {
  it('persists structured entries without requiring a terminal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lockin-logs-'));
    const path = await initializeFileLogging(directory);

    createLogger('release-test').info('Packaged app ready', { packaged: true });

    await expect.poll(() => readFile(path, 'utf8')).toContain('"scope":"release-test"');
    await expect.poll(() => readFile(path, 'utf8')).toContain('"packaged":true');
  });
});
