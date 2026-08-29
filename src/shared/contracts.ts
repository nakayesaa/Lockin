import { z } from 'zod';
import {
  entityIdSchema,
  persistedStateSchema,
  presetInputSchema,
  spaceInputSchema,
  type PersistedState,
  type PresetInput,
  type SpaceInput,
} from './data-model';

export const IPC_CHANNELS = {
  workspaceGet: 'lockin:workspace:get',
  spaceCreate: 'lockin:space:create',
  spaceUpdate: 'lockin:space:update',
  spaceDelete: 'lockin:space:delete',
  spaceReorder: 'lockin:space:reorder',
  presetCreate: 'lockin:preset:create',
  presetUpdate: 'lockin:preset:update',
  presetDuplicate: 'lockin:preset:duplicate',
  presetDelete: 'lockin:preset:delete',
  presetSetActive: 'lockin:preset:set-active',
} as const;

export const workspaceResultSchema = z
  .object({
    state: persistedStateSchema,
    notice: z.string().min(1).nullable(),
  })
  .strict();

export const entityRequestSchema = z.object({ id: entityIdSchema }).strict();
export const spaceCreateRequestSchema = spaceInputSchema;
export const spaceUpdateRequestSchema = z
  .object({ id: entityIdSchema, input: spaceInputSchema })
  .strict();
export const spaceReorderRequestSchema = z
  .object({ spaceIds: z.array(entityIdSchema).min(1).max(100) })
  .strict();
export const presetCreateRequestSchema = presetInputSchema;
export const presetUpdateRequestSchema = z
  .object({ id: entityIdSchema, input: presetInputSchema })
  .strict();

export type WorkspaceResult = z.infer<typeof workspaceResultSchema>;

export interface LockInApi {
  getWorkspace(): Promise<WorkspaceResult>;
  createSpace(input: SpaceInput): Promise<WorkspaceResult>;
  updateSpace(id: string, input: SpaceInput): Promise<WorkspaceResult>;
  deleteSpace(id: string): Promise<WorkspaceResult>;
  reorderSpaces(spaceIds: string[]): Promise<WorkspaceResult>;
  createPreset(input: PresetInput): Promise<WorkspaceResult>;
  updatePreset(id: string, input: PresetInput): Promise<WorkspaceResult>;
  duplicatePreset(id: string): Promise<WorkspaceResult>;
  deletePreset(id: string): Promise<WorkspaceResult>;
  setActivePreset(id: string): Promise<WorkspaceResult>;
}

export type { PersistedState };
