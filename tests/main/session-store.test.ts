// @vitest-environment node

import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from '../../src/main/session-store';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';

describe('SessionStore', () => {
  let directory: string;
  let filePath: string;
  let now: Date;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lockin-session-'));
    filePath = join(directory, 'session.json');
    now = new Date('2026-08-30T01:00:00.000Z');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function sessionStore(options: { writeAtomic?: () => Promise<void> } = {}) {
    return new SessionStore(filePath, {
      createId: () => 'session-1',
      now: () => now,
      ...options,
    });
  }

  async function start(store: SessionStore) {
    const workspace = createDefaultWorkspace();
    const preset = workspace.presets[0]!;
    const byId = new Map(workspace.spaces.map((space) => [space.id, space]));
    const spaces = preset.spaceIds.map((id) => byId.get(id)!);
    return store.start(preset, spaces);
  }

  it('persists an active session and restores its immutable space snapshot', async () => {
    const store = sessionStore();
    await store.initialize();
    const started = await start(store);

    expect(started.session).toMatchObject({
      id: 'session-1',
      durationSeconds: 3_600,
      startedAt: '2026-08-30T01:00:00.000Z',
      endsAt: '2026-08-30T02:00:00.000Z',
      endReason: null,
    });
    expect(started.session?.spaces.map(({ id }) => id)).toEqual(['leetcode', 'chatgpt', 'youtube']);

    const restored = sessionStore();
    await expect(restored.initialize()).resolves.toEqual(started);
  });

  it('completes an expired session at its exact deadline after restart', async () => {
    const store = sessionStore();
    await store.initialize();
    await start(store);
    now = new Date('2026-08-30T02:15:00.000Z');

    const restored = sessionStore();
    const result = await restored.initialize();
    expect(result.session).toMatchObject({
      endedAt: '2026-08-30T02:00:00.000Z',
      endReason: 'completed',
    });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toMatchObject({
      endReason: 'completed',
    });
  });

  it('records an early ending and requires active sessions to end before clearing', async () => {
    const store = sessionStore();
    await store.initialize();
    await start(store);
    await expect(store.clear()).rejects.toThrow('End the active session first');

    now = new Date('2026-08-30T01:12:34.000Z');
    const ended = await store.endEarly();
    expect(ended.session).toMatchObject({
      endedAt: '2026-08-30T01:12:34.000Z',
      endReason: 'ended-early',
    });
    await expect(store.clear()).resolves.toEqual({ session: null, notice: null });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toBeNull();
  });

  it('quarantines corrupt data instead of resuming an unsafe session', async () => {
    await writeFile(filePath, '{bad session');
    const result = await sessionStore().initialize();

    expect(result.session).toBeNull();
    expect(result.notice).toContain('Damaged session data');
    expect(await readdir(directory)).toEqual(
      expect.arrayContaining(['session.json', 'session.json.corrupt-2026-08-30T01-00-00-000Z']),
    );
  });

  it('does not publish a session when its atomic write fails', async () => {
    const initial = sessionStore();
    await initial.initialize();
    const store = sessionStore({ writeAtomic: vi.fn().mockRejectedValue(new Error('disk full')) });
    await store.initialize().catch(() => undefined);

    await expect(start(store)).rejects.toThrow('disk full');
    expect((await store.getSession()).session).toBeNull();
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toBeNull();
  });
});
