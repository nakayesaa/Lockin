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
import { sessionRecordSchema, type SessionRecord } from './session-model';

export const IPC_CHANNELS = {
  workspaceGet: 'lockin:workspace:get',
  spaceCreate: 'lockin:space:create',
  spaceUpdate: 'lockin:space:update',
  spaceDelete: 'lockin:space:delete',
  presetCreate: 'lockin:preset:create',
  presetUpdate: 'lockin:preset:update',
  presetDuplicate: 'lockin:preset:duplicate',
  presetDelete: 'lockin:preset:delete',
  presetSetActive: 'lockin:preset:set-active',
  sessionGet: 'lockin:session:get',
  sessionStart: 'lockin:session:start',
  sessionEnd: 'lockin:session:end',
  sessionClear: 'lockin:session:clear',
  siteOpen: 'lockin:site:open',
  siteClose: 'lockin:site:close',
  siteControlsSet: 'lockin:site-controls:set',
  siteDataClear: 'lockin:site-data:clear',
  sessionEvent: 'lockin:session:event',
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
export const presetCreateRequestSchema = presetInputSchema;
export const presetUpdateRequestSchema = z
  .object({ id: entityIdSchema, input: presetInputSchema })
  .strict();
export const sessionStartRequestSchema = z.object({ presetId: entityIdSchema }).strict();
export const siteOpenRequestSchema = z.object({ spaceId: entityIdSchema }).strict();
export const siteControlsRequestSchema = z.object({ visible: z.boolean() }).strict();

export const sessionResultSchema = z
  .object({
    session: sessionRecordSchema.nullable(),
    notice: z.string().min(1).nullable(),
  })
  .strict();

export const sessionEventSchema = z.union([
  z
    .object({
      type: z.literal('navigation-blocked'),
      destination: z.string().min(1).max(253),
    })
    .strict(),
  z
    .object({
      type: z.literal('site-state-changed'),
      status: z.enum(['loading', 'ready']),
      spaceId: entityIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('site-state-changed'),
      status: z.literal('failed'),
      spaceId: entityIdSchema,
      message: z.string().min(1).max(200),
    })
    .strict(),
]);

export type WorkspaceResult = z.infer<typeof workspaceResultSchema>;
export type SessionResult = z.infer<typeof sessionResultSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;

export interface LockInApi {
  getWorkspace(): Promise<WorkspaceResult>;
  createSpace(input: SpaceInput): Promise<WorkspaceResult>;
  updateSpace(id: string, input: SpaceInput): Promise<WorkspaceResult>;
  deleteSpace(id: string): Promise<WorkspaceResult>;
  createPreset(input: PresetInput): Promise<WorkspaceResult>;
  updatePreset(id: string, input: PresetInput): Promise<WorkspaceResult>;
  duplicatePreset(id: string): Promise<WorkspaceResult>;
  deletePreset(id: string): Promise<WorkspaceResult>;
  setActivePreset(id: string): Promise<WorkspaceResult>;
  getSession(): Promise<SessionResult>;
  startSession(presetId: string): Promise<SessionResult>;
  endSession(): Promise<SessionResult>;
  clearSession(): Promise<SessionResult>;
  openSite(spaceId: string): Promise<void>;
  closeSite(): Promise<void>;
  setSiteControlsVisible(visible: boolean): Promise<void>;
  clearWebsiteData(): Promise<void>;
  onSessionEvent(listener: (event: SessionEvent) => void): () => void;
}

export type { PersistedState, SessionRecord };
