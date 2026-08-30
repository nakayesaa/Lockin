import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Preset, Space } from '../shared/data-model';
import {
  CURRENT_SESSION_VERSION,
  sessionFileSchema,
  sessionRecordSchema,
  type SessionRecord,
} from '../shared/session-model';
import { writeJsonAtomically } from './json-file';

export interface SessionResult {
  readonly session: SessionRecord | null;
  readonly notice: string | null;
}

interface SessionStoreOptions {
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly writeAtomic?: (filePath: string, value: unknown) => Promise<void>;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function cloneSession(session: SessionRecord | null): SessionRecord | null {
  return session ? structuredClone(session) : null;
}

export class SessionStore {
  private session: SessionRecord | null = null;
  private initialNotice: string | null = null;
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly createId: () => string;
  private readonly now: () => Date;
  private readonly writeAtomic: (filePath: string, value: unknown) => Promise<void>;

  constructor(
    private readonly filePath: string,
    options: SessionStoreOptions = {},
  ) {
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.writeAtomic = options.writeAtomic ?? writeJsonAtomically;
  }

  async initialize(): Promise<SessionResult> {
    return this.exclusive(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      if (!(await pathExists(this.filePath))) {
        await this.writeAtomic(this.filePath, null);
        return this.result();
      }

      try {
        this.session = sessionFileSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')));
        await this.completeIfExpired();
      } catch {
        const stamp = this.now().toISOString().replace(/[:.]/g, '-');
        await rename(this.filePath, `${this.filePath}.corrupt-${stamp}`);
        this.session = null;
        this.initialNotice = 'Damaged session data was moved aside. No focus session was resumed.';
        await this.writeAtomic(this.filePath, null);
      }
      return this.result();
    });
  }

  async getSession(): Promise<SessionResult> {
    return this.exclusive(async () => {
      await this.completeIfExpired();
      const result = this.result();
      this.initialNotice = null;
      return result;
    });
  }

  async peekSession(): Promise<SessionRecord | null> {
    return this.exclusive(async () => {
      await this.completeIfExpired();
      return cloneSession(this.session);
    });
  }

  async start(preset: Preset, spaces: Space[]): Promise<SessionResult> {
    return this.exclusive(async () => {
      await this.completeIfExpired();
      if (this.session?.endReason === null) throw new Error('A focus session is already active');
      if (preset.spaceIds.some((id, index) => spaces[index]?.id !== id)) {
        throw new Error('Preset spaces are incomplete');
      }

      const startedAt = this.now();
      const durationSeconds = preset.durationMinutes * 60;
      const next = sessionRecordSchema.parse({
        version: CURRENT_SESSION_VERSION,
        id: this.createId(),
        presetId: preset.id,
        presetName: preset.name,
        durationSeconds,
        startedAt: startedAt.toISOString(),
        endsAt: new Date(startedAt.getTime() + durationSeconds * 1_000).toISOString(),
        endedAt: null,
        endReason: null,
        spaces,
      });
      await this.writeAtomic(this.filePath, next);
      this.session = next;
      return this.result();
    });
  }

  async endEarly(): Promise<SessionResult> {
    return this.exclusive(async () => {
      await this.completeIfExpired();
      if (!this.session) throw new Error('No focus session exists');
      if (this.session.endReason !== null) return this.result();

      const endedAt = new Date(
        Math.max(
          Date.parse(this.session.startedAt),
          Math.min(this.now().getTime(), Date.parse(this.session.endsAt)),
        ),
      ).toISOString();
      const next = sessionRecordSchema.parse({
        ...this.session,
        endedAt,
        endReason: 'ended-early',
      });
      await this.writeAtomic(this.filePath, next);
      this.session = next;
      return this.result();
    });
  }

  async clear(): Promise<SessionResult> {
    return this.exclusive(async () => {
      await this.completeIfExpired();
      if (this.session?.endReason === null) throw new Error('End the active session first');
      await this.writeAtomic(this.filePath, null);
      this.session = null;
      return this.result();
    });
  }

  private async completeIfExpired(): Promise<void> {
    if (!this.session || this.session.endReason !== null) return;
    if (this.now().getTime() < Date.parse(this.session.endsAt)) return;
    const next = sessionRecordSchema.parse({
      ...this.session,
      endedAt: this.session.endsAt,
      endReason: 'completed',
    });
    await this.writeAtomic(this.filePath, next);
    this.session = next;
  }

  private result(): SessionResult {
    return { session: cloneSession(this.session), notice: this.initialNotice };
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
