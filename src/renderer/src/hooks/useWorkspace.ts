import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LockInApi, WorkspaceResult } from '../../../shared/contracts';
import { createDefaultWorkspace } from '../../../shared/default-workspace';
import type {
  PersistedState,
  Preset,
  PresetInput,
  Space,
  SpaceInput,
} from '../../../shared/data-model';
import { displayNameFromHostname, normalizeWebsiteUrl } from '../../../shared/website-rules';
import { errorMessage } from '../errorMessage';

type Operation = (api: LockInApi, state: PersistedState) => Promise<WorkspaceResult>;
type PreviewOperation = (state: PersistedState) => PersistedState;

function createPreviewId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface WorkspaceController {
  readonly state: PersistedState;
  readonly activePreset: Preset;
  readonly activeSpaces: Space[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly notice: string | null;
  dismissNotice(): void;
  saveSpace(id: string | null, input: SpaceInput): Promise<boolean>;
  deleteSpace(id: string): Promise<boolean>;
  moveSpace(id: string, direction: -1 | 1): Promise<boolean>;
  setDuration(durationMinutes: number): Promise<boolean>;
  setActivePreset(id: string): Promise<boolean>;
  createPreset(): Promise<boolean>;
  renamePreset(name: string): Promise<boolean>;
  duplicatePreset(): Promise<boolean>;
  deletePreset(): Promise<boolean>;
  togglePresetSpace(id: string): Promise<boolean>;
}

export function useWorkspace(): WorkspaceController {
  const [state, setState] = useState(createDefaultWorkspace);
  const [loading, setLoading] = useState(Boolean(window.lockIn));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stateRef = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const publish = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const api = window.lockIn;
    if (!api) return;
    let mounted = true;
    api
      .getWorkspace()
      .then((result) => {
        if (!mounted) return;
        publish(result.state);
        if (result.notice) setNotice(result.notice);
      })
      .catch((error: unknown) => {
        if (mounted) setNotice(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [publish]);

  const run = useCallback(
    async (operation: Operation, previewOperation: PreviewOperation): Promise<boolean> => {
      let succeeded = false;
      setSaving(true);
      const task = queue.current.then(async () => {
        try {
          const api = window.lockIn;
          if (api) {
            const result = await operation(api, stateRef.current);
            publish(result.state);
            if (result.notice) setNotice(result.notice);
          } else {
            publish(previewOperation(structuredClone(stateRef.current)));
          }
          succeeded = true;
        } catch (error) {
          setNotice(errorMessage(error, 'The change could not be saved.'));
        }
      });
      queue.current = task;
      await task;
      setSaving(false);
      return succeeded;
    },
    [publish],
  );

  const activePreset = useMemo(() => {
    const preset = state.presets.find(({ id }) => id === state.settings.activePresetId);
    if (!preset) throw new Error('Active preset is missing');
    return preset;
  }, [state]);

  const activeSpaces = useMemo(() => {
    const byId = new Map(state.spaces.map((space) => [space.id, space]));
    return activePreset.spaceIds.flatMap((id) => {
      const space = byId.get(id);
      return space ? [space] : [];
    });
  }, [activePreset.spaceIds, state.spaces]);

  const saveSpace = useCallback(
    async (id: string | null, input: SpaceInput) => {
      if (!input.url.trim()) {
        setNotice('Enter a website address');
        return false;
      }
      return run(
        (api) => (id ? api.updateSpace(id, input) : api.createSpace(input)),
        (draft) => {
          const normalized = normalizeWebsiteUrl(input.url);
          if (id) {
            const index = draft.spaces.findIndex((space) => space.id === id);
            const current = draft.spaces[index];
            if (!current) throw new Error('Space not found');
            draft.spaces[index] = {
              ...current,
              ...normalized,
              name: input.name || displayNameFromHostname(normalized.hostname),
              includeSubdomains: input.includeSubdomains ?? false,
              iconDataUrl: input.iconDataUrl ?? null,
              accentColor: input.accentColor ?? '#d9e8ff',
              symbol: input.symbol ?? null,
            };
          } else {
            const spaceId = createPreviewId('space');
            draft.spaces.push({
              id: spaceId,
              ...normalized,
              name: input.name || displayNameFromHostname(normalized.hostname),
              includeSubdomains: input.includeSubdomains ?? false,
              iconDataUrl: input.iconDataUrl ?? null,
              accentColor: input.accentColor ?? '#d9e8ff',
              symbol: input.symbol ?? null,
            });
            draft.presets
              .find((preset) => preset.id === draft.settings.activePresetId)
              ?.spaceIds.push(spaceId);
          }
          return draft;
        },
      );
    },
    [run],
  );

  const deleteSpace = useCallback(
    (id: string) =>
      run(
        (api) => api.deleteSpace(id),
        (draft) => {
          if (
            draft.presets.some(
              (preset) => preset.spaceIds.length === 1 && preset.spaceIds[0] === id,
            )
          ) {
            throw new Error('A preset must keep at least one space');
          }
          draft.spaces = draft.spaces.filter((space) => space.id !== id);
          draft.presets.forEach((preset) => {
            preset.spaceIds = preset.spaceIds.filter((spaceId) => spaceId !== id);
          });
          return draft;
        },
      ),
    [run],
  );

  const updateActivePreset = useCallback(
    (transform: (preset: Preset) => PresetInput) =>
      run(
        (api, current) => {
          const preset = current.presets.find(({ id }) => id === current.settings.activePresetId);
          if (!preset) throw new Error('Active preset is missing');
          return api.updatePreset(preset.id, transform(preset));
        },
        (draft) => {
          const index = draft.presets.findIndex(({ id }) => id === draft.settings.activePresetId);
          const preset = draft.presets[index];
          if (!preset) throw new Error('Active preset is missing');
          draft.presets[index] = { id: preset.id, ...transform(preset) };
          return draft;
        },
      ),
    [run],
  );

  const moveSpace = useCallback(
    (id: string, direction: -1 | 1) =>
      updateActivePreset((preset) => {
        const spaceIds = [...preset.spaceIds];
        const from = spaceIds.indexOf(id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= spaceIds.length) {
          return {
            name: preset.name,
            durationMinutes: preset.durationMinutes,
            spaceIds: preset.spaceIds,
          };
        }
        [spaceIds[from], spaceIds[to]] = [spaceIds[to]!, spaceIds[from]!];
        return { name: preset.name, durationMinutes: preset.durationMinutes, spaceIds };
      }),
    [updateActivePreset],
  );

  const setDuration = useCallback(
    (durationMinutes: number) =>
      updateActivePreset((preset) => ({
        name: preset.name,
        durationMinutes,
        spaceIds: preset.spaceIds,
      })),
    [updateActivePreset],
  );

  const setActivePreset = useCallback(
    (id: string) =>
      run(
        (api) => api.setActivePreset(id),
        (draft) => {
          if (!draft.presets.some((preset) => preset.id === id))
            throw new Error('Preset not found');
          draft.settings.activePresetId = id;
          return draft;
        },
      ),
    [run],
  );

  const createPreset = useCallback(
    () =>
      run(
        (api, current) => {
          const source = current.presets.find(({ id }) => id === current.settings.activePresetId);
          if (!source) throw new Error('Active preset is missing');
          return api.createPreset({
            name: 'New Focus',
            durationMinutes: source.durationMinutes,
            spaceIds: source.spaceIds,
          });
        },
        (draft) => {
          const source = draft.presets.find(({ id }) => id === draft.settings.activePresetId);
          if (!source) throw new Error('Active preset is missing');
          const id = createPreviewId('preset');
          draft.presets.push({ ...source, id, name: 'New Focus', spaceIds: [...source.spaceIds] });
          draft.settings.activePresetId = id;
          return draft;
        },
      ),
    [run],
  );

  const renamePreset = useCallback(
    (name: string) =>
      updateActivePreset((preset) => ({
        name,
        durationMinutes: preset.durationMinutes,
        spaceIds: preset.spaceIds,
      })),
    [updateActivePreset],
  );

  const duplicatePreset = useCallback(
    () =>
      run(
        (api, current) => api.duplicatePreset(current.settings.activePresetId),
        (draft) => {
          const source = draft.presets.find(({ id }) => id === draft.settings.activePresetId);
          if (!source) throw new Error('Active preset is missing');
          const id = createPreviewId('preset');
          draft.presets.push({
            ...source,
            id,
            name: `${source.name} Copy`.slice(0, 40),
            spaceIds: [...source.spaceIds],
          });
          draft.settings.activePresetId = id;
          return draft;
        },
      ),
    [run],
  );

  const deletePreset = useCallback(
    () =>
      run(
        (api, current) => api.deletePreset(current.settings.activePresetId),
        (draft) => {
          if (draft.presets.length === 1) throw new Error('Keep at least one preset');
          draft.presets = draft.presets.filter(({ id }) => id !== draft.settings.activePresetId);
          const fallback = draft.presets[0];
          if (!fallback) throw new Error('Keep at least one preset');
          draft.settings.activePresetId = fallback.id;
          return draft;
        },
      ),
    [run],
  );

  const togglePresetSpace = useCallback(
    (id: string) =>
      updateActivePreset((preset) => {
        const selected = preset.spaceIds.includes(id);
        if (selected && preset.spaceIds.length === 1) throw new Error('Keep at least one space');
        return {
          name: preset.name,
          durationMinutes: preset.durationMinutes,
          spaceIds: selected
            ? preset.spaceIds.filter((spaceId) => spaceId !== id)
            : [...preset.spaceIds, id],
        };
      }),
    [updateActivePreset],
  );

  return {
    state,
    activePreset,
    activeSpaces,
    loading,
    saving,
    notice,
    dismissNotice: () => setNotice(null),
    saveSpace,
    deleteSpace,
    moveSpace,
    setDuration,
    setActivePreset,
    createPreset,
    renamePreset,
    duplicatePreset,
    deletePreset,
    togglePresetSpace,
  };
}
