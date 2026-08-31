import type { IpcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  entityRequestSchema,
  presetCreateRequestSchema,
  presetUpdateRequestSchema,
  sessionEventSchema,
  sessionResultSchema,
  sessionStartRequestSchema,
  siteOpenRequestSchema,
  siteControlsRequestSchema,
  spotifyPlaybackSchema,
  spotifyOpenRequestSchema,
  spotifyOverlayRequestSchema,
  spaceCreateRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
  type LockInApi,
  type SessionEvent,
} from '../shared/contracts';
import type { PresetInput, SpaceInput } from '../shared/data-model';

type Bridge = Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>;

export function createLockInApi(bridge: Bridge): LockInApi {
  const invokeForWorkspace = async (channel: string, input?: unknown) =>
    workspaceResultSchema.parse(
      input === undefined ? await bridge.invoke(channel) : await bridge.invoke(channel, input),
    );
  const invokeForSession = async (channel: string, input?: unknown) =>
    sessionResultSchema.parse(
      input === undefined ? await bridge.invoke(channel) : await bridge.invoke(channel, input),
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
    getSession: () => invokeForSession(IPC_CHANNELS.sessionGet),
    startSession: (presetId: string) =>
      invokeForSession(IPC_CHANNELS.sessionStart, sessionStartRequestSchema.parse({ presetId })),
    endSession: () => invokeForSession(IPC_CHANNELS.sessionEnd),
    clearSession: () => invokeForSession(IPC_CHANNELS.sessionClear),
    openSite: async (spaceId: string) => {
      await bridge.invoke(IPC_CHANNELS.siteOpen, siteOpenRequestSchema.parse({ spaceId }));
    },
    closeSite: async () => {
      await bridge.invoke(IPC_CHANNELS.siteClose);
    },
    setSiteControlsVisible: async (visible: boolean) => {
      await bridge.invoke(
        IPC_CHANNELS.siteControlsSet,
        siteControlsRequestSchema.parse({ visible }),
      );
    },
    clearWebsiteData: async () => {
      await bridge.invoke(IPC_CHANNELS.siteDataClear);
    },
    getSpotifyPlayback: async () =>
      spotifyPlaybackSchema.parse(await bridge.invoke(IPC_CHANNELS.spotifyGet)),
    connectSpotify: async () =>
      spotifyPlaybackSchema.parse(await bridge.invoke(IPC_CHANNELS.spotifyConnect)),
    disconnectSpotify: async () => {
      await bridge.invoke(IPC_CHANNELS.spotifyDisconnect);
    },
    playSpotify: async () => {
      await bridge.invoke(IPC_CHANNELS.spotifyPlay);
    },
    pauseSpotify: async () => {
      await bridge.invoke(IPC_CHANNELS.spotifyPause);
    },
    nextSpotify: async () => {
      await bridge.invoke(IPC_CHANNELS.spotifyNext);
    },
    openSpotify: async (url: string) => {
      await bridge.invoke(IPC_CHANNELS.spotifyOpen, spotifyOpenRequestSchema.parse({ url }));
    },
    setSpotifyOverlayExpanded: async (expanded: boolean) => {
      await bridge.invoke(
        IPC_CHANNELS.spotifyOverlaySetExpanded,
        spotifyOverlayRequestSchema.parse({ expanded }),
      );
    },
    onSessionEvent: (listener: (event: SessionEvent) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, input: unknown) =>
        listener(sessionEventSchema.parse(input));
      bridge.on(IPC_CHANNELS.sessionEvent, wrapped);
      return () => bridge.removeListener(IPC_CHANNELS.sessionEvent, wrapped);
    },
  });
}
