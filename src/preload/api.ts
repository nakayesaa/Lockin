import type { IpcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  entityRequestSchema,
  presetCreateRequestSchema,
  presetUpdateRequestSchema,
  spaceCreateRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
  type LockInApi,
} from '../shared/contracts';
import type { PresetInput, SpaceInput } from '../shared/data-model';

type Invoke = IpcRenderer['invoke'];

export function createLockInApi(invoke: Invoke): LockInApi {
  const invokeForWorkspace = async (channel: string, input?: unknown) =>
    workspaceResultSchema.parse(
      input === undefined ? await invoke(channel) : await invoke(channel, input),
    );

  return Object.freeze({
    getWorkspace: () => invokeForWorkspace(IPC_CHANNELS.workspaceGet),
    createSpace: async (input: SpaceInput) =>
      invokeForWorkspace(IPC_CHANNELS.spaceCreate, spaceCreateRequestSchema.parse(input)),
    updateSpace: async (id: string, input: SpaceInput) =>
      invokeForWorkspace(IPC_CHANNELS.spaceUpdate, spaceUpdateRequestSchema.parse({ id, input })),
    deleteSpace: async (id: string) =>
      invokeForWorkspace(IPC_CHANNELS.spaceDelete, entityRequestSchema.parse({ id })),
    createPreset: async (input: PresetInput) =>
      invokeForWorkspace(IPC_CHANNELS.presetCreate, presetCreateRequestSchema.parse(input)),
    updatePreset: async (id: string, input: PresetInput) =>
      invokeForWorkspace(IPC_CHANNELS.presetUpdate, presetUpdateRequestSchema.parse({ id, input })),
    duplicatePreset: async (id: string) =>
      invokeForWorkspace(IPC_CHANNELS.presetDuplicate, entityRequestSchema.parse({ id })),
    deletePreset: async (id: string) =>
      invokeForWorkspace(IPC_CHANNELS.presetDelete, entityRequestSchema.parse({ id })),
    setActivePreset: async (id: string) =>
      invokeForWorkspace(IPC_CHANNELS.presetSetActive, entityRequestSchema.parse({ id })),
  });
}
