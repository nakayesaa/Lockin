import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { createDefaultWorkspace } from '../shared/default-workspace';
import {
  CURRENT_DATA_VERSION,
  persistedStateSchema,
  presetInputSchema,
  spaceInputSchema,
  type PersistedState,
  type Preset,
  type PresetInput,
  type Space,
  type SpaceInput,
} from '../shared/data-model';
import {
  displayNameFromHostname,
  hostRulesOverlap,
  normalizeWebsiteUrl,
} from '../shared/website-rules';
import { writeJsonAtomically } from './json-file';

export interface WorkspaceResult {
  readonly state: PersistedState;
  readonly notice: string | null;
}

interface WorkspaceStoreOptions {
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly writeAtomic?: (filePath: string, state: PersistedState) => Promise<void>;
}

const legacyStateSchema = z
  .object({
    version: z.literal(0),
    spaces: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          url: z.string(),
          includeSubdomains: z.boolean().optional(),
          iconDataUrl: z.string().nullable().optional(),
          accentColor: z.string().optional(),
          symbol: z.string().nullable().optional(),
        })
        .strict(),
    ),
    presets: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          durationMinutes: z.number(),
          spaceIds: z.array(z.string()),
        })
        .strict(),
    ),
    activePresetId: z.string(),
  })
  .strict();

function cloneState(state: PersistedState): PersistedState {
  return structuredClone(state);
}

function defaultState(): PersistedState {
  return persistedStateSchema.parse(createDefaultWorkspace());
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function migrateState(value: unknown): PersistedState {
  const version = z.object({ version: z.number().int() }).passthrough().parse(value).version;
  if (version === CURRENT_DATA_VERSION) return persistedStateSchema.parse(value);
  if (version !== 0) throw new Error(`Unsupported workspace data version: ${version}`);

  const legacy = legacyStateSchema.parse(value);
  return persistedStateSchema.parse({
    version: CURRENT_DATA_VERSION,
    spaces: legacy.spaces.map((space) => {
      const normalized = normalizeWebsiteUrl(space.url);
      return {
        id: space.id,
        name: space.name,
        ...normalized,
        includeSubdomains: space.includeSubdomains ?? false,
        iconDataUrl: space.iconDataUrl ?? null,
        accentColor: space.accentColor ?? '#d9e8ff',
        symbol: space.symbol ?? null,
      };
    }),
    presets: legacy.presets,
    settings: { activePresetId: legacy.activePresetId },
  });
}

export class WorkspaceStore {
  private state: PersistedState | null = null;
  private initialNotice: string | null = null;
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly createId: () => string;
  private readonly now: () => Date;
  private readonly writeAtomic: (filePath: string, state: PersistedState) => Promise<void>;

  constructor(
    private readonly filePath: string,
    options: WorkspaceStoreOptions = {},
  ) {
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.writeAtomic = options.writeAtomic ?? writeJsonAtomically;
  }

  async initialize(): Promise<WorkspaceResult> {
    return this.exclusive(async () => {
      if (this.state) return this.result();
      await mkdir(dirname(this.filePath), { recursive: true });

      if (!(await pathExists(this.filePath))) {
        this.state = defaultState();
        await this.writeAtomic(this.filePath, this.state);
        return this.result();
      }

      const contents = await readFile(this.filePath, 'utf8');
      let migrated = false;
      try {
        const raw = JSON.parse(contents) as unknown;
        const sourceVersion = z.object({ version: z.number() }).passthrough().parse(raw).version;
        this.state = migrateState(raw);
        migrated = sourceVersion !== CURRENT_DATA_VERSION;
      } catch {
        const stamp = this.now().toISOString().replace(/[:.]/g, '-');
        const quarantinedPath = `${this.filePath}.corrupt-${stamp}`;
        await rename(this.filePath, quarantinedPath);
        this.state = defaultState();
        this.initialNotice =
          'Damaged workspace data was moved aside and safe defaults were restored.';
        await this.writeAtomic(this.filePath, this.state);
      }

      if (migrated) await this.writeAtomic(this.filePath, this.requireState());

      return this.result();
    });
  }

  async getState(): Promise<WorkspaceResult> {
    return this.exclusive(async () => {
      const result = this.result();
      this.initialNotice = null;
      return result;
    });
  }

  async createSpace(input: SpaceInput): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      const parsed = spaceInputSchema.parse(input);
      const normalized = normalizeWebsiteUrl(parsed.url);
      const space: Space = {
        id: this.createId(),
        name: parsed.name || displayNameFromHostname(normalized.hostname),
        ...normalized,
        includeSubdomains: parsed.includeSubdomains,
        iconDataUrl: parsed.iconDataUrl,
        accentColor: parsed.accentColor,
        symbol: parsed.symbol,
      };
      const conflicts = state.spaces.filter((candidate) => hostRulesOverlap(candidate, space));
      state.spaces.push(space);
      const activePreset = state.presets.find(({ id }) => id === state.settings.activePresetId);
      if (!activePreset) throw new Error('Active preset is missing');
      activePreset.spaceIds.push(space.id);
      return conflicts.length ? `This address overlaps with ${conflicts[0]?.name}.` : null;
    });
  }

  async updateSpace(id: string, input: SpaceInput): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      const index = state.spaces.findIndex((space) => space.id === id);
      if (index < 0) throw new Error('Space not found');
      const parsed = spaceInputSchema.parse(input);
      const normalized = normalizeWebsiteUrl(parsed.url);
      const current = state.spaces[index];
      if (!current) throw new Error('Space not found');
      const updated: Space = {
        ...current,
        name: parsed.name || displayNameFromHostname(normalized.hostname),
        ...normalized,
        includeSubdomains: parsed.includeSubdomains,
        iconDataUrl: parsed.iconDataUrl,
        accentColor: parsed.accentColor,
        symbol: parsed.symbol,
      };
      const conflicts = state.spaces.filter(
        (candidate) => candidate.id !== id && hostRulesOverlap(candidate, updated),
      );
      state.spaces[index] = updated;
      return conflicts.length ? `This address overlaps with ${conflicts[0]?.name}.` : null;
    });
  }

  async deleteSpace(id: string): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      if (!state.spaces.some((space) => space.id === id)) throw new Error('Space not found');
      const affectedPresets = state.presets.filter((preset) => preset.spaceIds.includes(id));
      if (affectedPresets.some((preset) => preset.spaceIds.length === 1)) {
        throw new Error('A preset must keep at least one space');
      }
      state.spaces = state.spaces.filter((space) => space.id !== id);
      state.presets.forEach((preset) => {
        preset.spaceIds = preset.spaceIds.filter((spaceId) => spaceId !== id);
      });
      return null;
    });
  }

  async createPreset(input: PresetInput): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      const preset = this.parsePresetInput(state, input);
      const id = this.createId();
      state.presets.push({ id, ...preset });
      state.settings.activePresetId = id;
      return null;
    });
  }

  async updatePreset(id: string, input: PresetInput): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      const index = state.presets.findIndex((preset) => preset.id === id);
      if (index < 0) throw new Error('Preset not found');
      state.presets[index] = { id, ...this.parsePresetInput(state, input) };
      return null;
    });
  }

  async duplicatePreset(id: string): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      const source = state.presets.find((preset) => preset.id === id);
      if (!source) throw new Error('Preset not found');
      const copy: Preset = {
        ...source,
        id: this.createId(),
        name: `${source.name} Copy`.slice(0, 40),
        spaceIds: [...source.spaceIds],
      };
      state.presets.push(copy);
      state.settings.activePresetId = copy.id;
      return null;
    });
  }

  async deletePreset(id: string): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      if (!state.presets.some((preset) => preset.id === id)) throw new Error('Preset not found');
      if (state.presets.length === 1) throw new Error('Keep at least one preset');
      state.presets = state.presets.filter((preset) => preset.id !== id);
      if (state.settings.activePresetId === id) {
        const fallback = state.presets[0];
        if (!fallback) throw new Error('Keep at least one preset');
        state.settings.activePresetId = fallback.id;
      }
      return null;
    });
  }

  async setActivePreset(id: string): Promise<WorkspaceResult> {
    return this.mutate((state) => {
      if (!state.presets.some((preset) => preset.id === id)) throw new Error('Preset not found');
      state.settings.activePresetId = id;
      return null;
    });
  }

  private parsePresetInput(state: PersistedState, input: PresetInput): Omit<Preset, 'id'> {
    const parsed = presetInputSchema.parse(input);
    const knownSpaceIds = new Set(state.spaces.map(({ id }) => id));
    if (parsed.spaceIds.some((id) => !knownSpaceIds.has(id))) {
      throw new Error('Preset contains an unknown space');
    }
    return parsed;
  }

  private async mutate(update: (draft: PersistedState) => string | null): Promise<WorkspaceResult> {
    return this.exclusive(async () => {
      const draft = cloneState(this.requireState());
      const notice = update(draft);
      const next = persistedStateSchema.parse(draft);
      await this.writeAtomic(this.filePath, next);
      this.state = next;
      return { state: cloneState(next), notice };
    });
  }

  private result(): WorkspaceResult {
    return { state: cloneState(this.requireState()), notice: this.initialNotice };
  }

  private requireState(): PersistedState {
    if (!this.state) throw new Error('Workspace store has not been initialized');
    return this.state;
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
