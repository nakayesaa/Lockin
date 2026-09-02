import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  entityRequestSchema,
  heroCopyUpdateRequestSchema,
  presetCreateRequestSchema,
  presetUpdateRequestSchema,
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
} from '../shared/contracts';
import type { WorkspaceStore } from './workspace-store';
import type { FocusRuntime } from './focus-runtime';
import type { SessionStore } from './session-store';
import type { SpotifyService } from './spotify-service';
import type { SpotifyOverlayController } from './spotify-overlay-controller';

export function registerIpcHandlers(
  store: WorkspaceStore,
  sessions: SessionStore,
  runtime: FocusRuntime,
  spotify: SpotifyService,
  spotifyOverlay?: SpotifyOverlayController,
): void {
  Object.values(IPC_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));

  ipcMain.handle(IPC_CHANNELS.workspaceGet, async () =>
    workspaceResultSchema.parse(await store.getState()),
  );
  ipcMain.handle(IPC_CHANNELS.heroCopyUpdate, async (_event, input: unknown) =>
    workspaceResultSchema.parse(
      await store.updateHeroCopy(heroCopyUpdateRequestSchema.parse(input)),
    ),
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
    if (!result.session) throw new Error('Focus session did not start');
    runtime.enterFocus(result.session);
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
  ipcMain.handle(IPC_CHANNELS.siteClose, async () => {
    const session = await sessions.peekSession();
    if (!session || session.endReason !== null) runtime.reset();
    else runtime.closeSpace();
  });
  ipcMain.handle(IPC_CHANNELS.siteControlsSet, (_event, input: unknown) => {
    const { visible } = siteControlsRequestSchema.parse(input);
    runtime.setSiteControlsVisible(visible);
  });
  ipcMain.handle(IPC_CHANNELS.siteDataClear, async () => {
    const session = await sessions.peekSession();
    if (session?.endReason === null) {
      throw new Error('Website data cannot be cleared during an active focus session');
    }
    await runtime.clearWebsiteData();
  });
  ipcMain.handle(IPC_CHANNELS.spotifyGet, async () =>
    spotifyPlaybackSchema.parse(await spotify.getPlayback()),
  );
  ipcMain.handle(IPC_CHANNELS.spotifyConnect, async () => {
    const session = await sessions.peekSession();
    if (session?.endReason === null) {
      throw new Error('Connect Spotify before starting a focus session');
    }
    return spotifyPlaybackSchema.parse(await spotify.connect());
  });
  ipcMain.handle(IPC_CHANNELS.spotifyDisconnect, () => spotify.disconnect());
  ipcMain.handle(IPC_CHANNELS.spotifyPlay, () => spotify.play());
  ipcMain.handle(IPC_CHANNELS.spotifyPause, () => spotify.pause());
  ipcMain.handle(IPC_CHANNELS.spotifyNext, () => spotify.next());
  ipcMain.handle(IPC_CHANNELS.spotifyOpen, async (_event, input: unknown) => {
    const session = await sessions.peekSession();
    if (session?.endReason === null) {
      throw new Error('Open Spotify after your focus session');
    }
    const { url } = spotifyOpenRequestSchema.parse(input);
    await spotify.open(url);
  });
  ipcMain.handle(IPC_CHANNELS.spotifyOverlaySetExpanded, (event, input: unknown) => {
    if (!spotifyOverlay?.owns(event.sender)) throw new Error('Invalid Spotify overlay request');
    const { expanded } = spotifyOverlayRequestSchema.parse(input);
    spotifyOverlay.setExpanded(expanded);
  });
}
