import { readFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { writeJsonAtomically } from './json-file';

const storedFileSchema = z
  .object({
    version: z.literal(1),
    encrypted: z.string().min(1),
  })
  .strict();

const tokenSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().int().positive(),
    scope: z.string(),
  })
  .strict();

export type SpotifyTokens = z.infer<typeof tokenSchema>;

export interface TokenEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export class SpotifyTokenStore {
  private tokens: SpotifyTokens | null = null;

  constructor(
    private readonly filePath: string,
    private readonly encryption: TokenEncryption,
  ) {}

  async initialize(): Promise<void> {
    try {
      const file = storedFileSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')));
      const decrypted = this.encryption.decryptString(Buffer.from(file.encrypted, 'base64'));
      this.tokens = tokenSchema.parse(JSON.parse(decrypted));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      await unlink(this.filePath).catch(() => undefined);
      this.tokens = null;
    }
  }

  get(): SpotifyTokens | null {
    return this.tokens ? { ...this.tokens } : null;
  }

  async save(tokens: SpotifyTokens): Promise<void> {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error('Secure token storage is unavailable on this device');
    }
    const validated = tokenSchema.parse(tokens);
    const encrypted = this.encryption.encryptString(JSON.stringify(validated)).toString('base64');
    await writeJsonAtomically(this.filePath, { version: 1, encrypted });
    this.tokens = validated;
  }

  async clear(): Promise<void> {
    await unlink(this.filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    this.tokens = null;
  }
}
