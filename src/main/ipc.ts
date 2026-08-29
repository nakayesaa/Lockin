import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  entityRequestSchema,
  presetCreateRequestSchema,
  presetUpdateRequestSchema,
  spaceCreateRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
} from '../shared/contracts';
import type { WorkspaceStore } from './workspace-store';

export function registerIpcHandlers(store: WorkspaceStore): void {
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
}
