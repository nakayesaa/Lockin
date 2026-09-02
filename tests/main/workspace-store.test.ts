// @vitest-environment node

import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStore } from '../../src/main/workspace-store';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';

describe('WorkspaceStore', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lockin-workspace-'));
    filePath = join(directory, 'workspace.json');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('creates defaults and restores the exact committed state', async () => {
    const store = new WorkspaceStore(filePath, { createId: () => 'figma' });
    await store.initialize();
    const created = await store.createSpace({ name: '', url: 'figma.com/design' });

    expect(created.state.spaces.at(-1)).toMatchObject({
      id: 'figma',
      name: 'Figma',
      startUrl: 'https://figma.com/design',
      hostname: 'figma.com',
    });

    const ordered = await store.updatePreset('default', {
      name: 'Deep Work',
      durationMinutes: 60,
      spaceIds: ['figma', 'youtube', 'chatgpt', 'leetcode'],
    });
    const restarted = new WorkspaceStore(filePath);
    const restored = await restarted.initialize();
    expect(restored.state).toEqual(ordered.state);
    expect(restored.state.presets[0]?.spaceIds).toEqual([
      'figma',
      'youtube',
      'chatgpt',
      'leetcode',
    ]);
  });

  it('serializes concurrent mutations without losing updates', async () => {
    const ids = ['figma', 'notion'];
    const store = new WorkspaceStore(filePath, { createId: () => ids.shift() ?? 'fallback' });
    await store.initialize();

    await Promise.all([
      store.createSpace({ name: 'Figma', url: 'figma.com' }),
      store.createSpace({ name: 'Notion', url: 'notion.so' }),
    ]);

    const result = await store.getState();
    expect(result.state.spaces.map(({ id }) => id)).toEqual([
      'leetcode',
      'chatgpt',
      'youtube',
      'figma',
      'notion',
    ]);
  });

  it('persists personalized setup copy', async () => {
    const store = new WorkspaceStore(filePath);
    await store.initialize();
    const updated = await store.updateHeroCopy({
      brand: 'My Studio',
      headline: 'Stay with the work.',
      subtitle: 'Everything else can wait.',
    });
    const restarted = new WorkspaceStore(filePath);

    expect((await restarted.initialize()).state.settings.hero).toEqual(updated.state.settings.hero);
  });

  it('migrates version one data without losing existing workspace content', async () => {
    const current = createDefaultWorkspace();
    const legacy = {
      ...current,
      version: 1,
      settings: { activePresetId: current.settings.activePresetId },
    };
    await writeFile(filePath, JSON.stringify(legacy));

    const result = await new WorkspaceStore(filePath).initialize();

    expect(result.state).toMatchObject({
      version: 2,
      settings: {
        activePresetId: 'default',
        hero: {
          brand: 'LockIn',
          headline: 'One thing\nat a time.',
          subtitle: 'Choose the time. Keep only what helps.',
        },
      },
    });
    expect(result.state.spaces).toEqual(current.spaces);
    expect(result.state.presets).toEqual(current.presets);
  });

  it('warns about overlapping rules and protects the last preset space', async () => {
    const store = new WorkspaceStore(filePath, { createId: () => 'leetcode-subdomain' });
    await store.initialize();
    const result = await store.createSpace({
      name: 'LeetCode Problems',
      url: 'leetcode.com/problems',
    });
    expect(result.notice).toContain('LeetCode');

    const active = result.state.presets.find(
      ({ id }) => id === result.state.settings.activePresetId,
    );
    if (!active) throw new Error('Expected active preset');
    await store.updatePreset(active.id, {
      name: active.name,
      durationMinutes: active.durationMinutes,
      spaceIds: ['leetcode-subdomain'],
    });
    await expect(store.deleteSpace('leetcode-subdomain')).rejects.toThrow(
      'A preset must keep at least one space',
    );
  });

  it('supports preset create, duplicate, activate, update, and delete', async () => {
    const ids = ['writing', 'writing-copy'];
    const store = new WorkspaceStore(filePath, { createId: () => ids.shift() ?? 'fallback' });
    await store.initialize();
    await store.createPreset({ name: 'Writing', durationMinutes: 45, spaceIds: ['chatgpt'] });
    await store.duplicatePreset('writing');
    await store.updatePreset('writing-copy', {
      name: 'Writing PM',
      durationMinutes: 90,
      spaceIds: ['chatgpt', 'youtube'],
    });
    await store.setActivePreset('default');
    const result = await store.deletePreset('writing');

    expect(result.state.settings.activePresetId).toBe('default');
    expect(result.state.presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'writing-copy', name: 'Writing PM', durationMinutes: 90 }),
      ]),
    );
    expect(result.state.presets.some(({ id }) => id === 'writing')).toBe(false);
  });

  it('migrates version zero data and rewrites it as the current version', async () => {
    await writeFile(
      filePath,
      JSON.stringify({
        version: 0,
        spaces: [{ id: 'docs', name: 'Docs', url: 'docs.example.com', symbol: 'D' }],
        presets: [{ id: 'work', name: 'Work', durationMinutes: 30, spaceIds: ['docs'] }],
        activePresetId: 'work',
      }),
    );

    const store = new WorkspaceStore(filePath);
    const result = await store.initialize();
    expect(result.state).toMatchObject({
      version: 2,
      settings: {
        activePresetId: 'work',
        hero: {
          brand: 'LockIn',
          headline: 'One thing\nat a time.',
          subtitle: 'Choose the time. Keep only what helps.',
        },
      },
      spaces: [{ hostname: 'docs.example.com', startUrl: 'https://docs.example.com/' }],
    });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toMatchObject({ version: 2 });
  });

  it('quarantines corrupt data and restores usable defaults', async () => {
    await writeFile(filePath, '{not valid json');
    const store = new WorkspaceStore(filePath, {
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    const result = await store.initialize();

    expect(result.notice).toContain('Damaged workspace data');
    expect(result.state.settings.activePresetId).toBe('default');
    expect(await readdir(directory)).toEqual(
      expect.arrayContaining(['workspace.json', 'workspace.json.corrupt-2026-08-29T12-00-00-000Z']),
    );
  });

  it('does not publish a mutation in memory when its atomic write fails', async () => {
    const initial = new WorkspaceStore(filePath);
    await initial.initialize();
    const failingWrite = vi.fn().mockRejectedValue(new Error('disk full'));
    const store = new WorkspaceStore(filePath, {
      createId: () => 'figma',
      writeAtomic: failingWrite,
    });
    await store.initialize();

    await expect(store.createSpace({ name: 'Figma', url: 'figma.com' })).rejects.toThrow(
      'disk full',
    );
    expect((await store.getState()).state.spaces.some(({ id }) => id === 'figma')).toBe(false);
    expect(JSON.parse(await readFile(filePath, 'utf8')).spaces).toHaveLength(3);
  });
});
