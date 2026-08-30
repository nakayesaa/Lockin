import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  entityRequestSchema,
  presetCreateRequestSchema,
  presetUpdateRequestSchema,
  sessionResultSchema,
  sessionStartRequestSchema,
  siteOpenRequestSchema,
  spaceCreateRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
} from '../shared/contracts';
import type { WorkspaceStore } from './workspace-store';
import type { FocusRuntime } from './focus-runtime';
import type { SessionStore } from './session-store';

export function registerIpcHandlers(
  store: WorkspaceStore,
  sessions: SessionStore,
  runtime: FocusRuntime,
): void {
  Object.values(IPC_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));

  ipcMain.handle(IPC_CHANNELS.workspaceGet, async () =>
    workspaceResultSchema.parse(await store.getState()),
  );
  ipcMain.handle(IPC_CHANNELS.spaceCreate, async (_event, input: unknown) =>
    workspaceResultSchema.parse(await store.createSpace(spaceCreateRequestSchema.parse(input))),
  );
  ipcMain.handle(IPC_CHANNELS.spaceUpdate, async (_event, input: unknown) => {
    const request = spaceUpdateRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.updateSpace(request.id, request.input));
  });
  ipcMain.handle(IPC_CHANNELS.spaceDelete, async (_event, input: unknown) => {
    const request = entityRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.deleteSpace(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.presetCreate, async (_event, input: unknown) =>
    workspaceResultSchema.parse(await store.createPreset(presetCreateRequestSchema.parse(input))),
  );
  ipcMain.handle(IPC_CHANNELS.presetUpdate, async (_event, input: unknown) => {
    const request = presetUpdateRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.updatePreset(request.id, request.input));
  });
  ipcMain.handle(IPC_CHANNELS.presetDuplicate, async (_event, input: unknown) => {
    const request = entityRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.duplicatePreset(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.presetDelete, async (_event, input: unknown) => {
    const request = entityRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.deletePreset(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.presetSetActive, async (_event, input: unknown) => {
    const request = entityRequestSchema.parse(input);
    return workspaceResultSchema.parse(await store.setActivePreset(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.sessionGet, async () =>
    sessionResultSchema.parse(await sessions.getSession()),
  );
  ipcMain.handle(IPC_CHANNELS.sessionStart, async (_event, input: unknown) => {
    const { presetId } = sessionStartRequestSchema.parse(input);
    const workspace = (await store.getState()).state;
    const preset = workspace.presets.find(({ id }) => id === presetId);
    if (!preset) throw new Error('Preset not found');
    const spacesById = new Map(workspace.spaces.map((space) => [space.id, space]));
    const spaces = preset.spaceIds.flatMap((id) => {
      const space = spacesById.get(id);
      return space ? [space] : [];
    });
    runtime.reset();
    const result = sessionResultSchema.parse(await sessions.start(preset, spaces));
    runtime.enterFocus();
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.sessionEnd, async () => {
    runtime.reset();
    const result = sessionResultSchema.parse(await sessions.endEarly());
    runtime.exitFocus();
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.sessionClear, async () => {
    runtime.reset();
    const result = sessionResultSchema.parse(await sessions.clear());
    runtime.exitFocus();
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.siteOpen, async (_event, input: unknown) => {
    const { spaceId } = siteOpenRequestSchema.parse(input);
    await runtime.openSpace(spaceId);
  });
  ipcMain.handle(IPC_CHANNELS.siteClose, () => runtime.closeSpace());
}
