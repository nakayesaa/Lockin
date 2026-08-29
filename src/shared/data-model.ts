import { z } from 'zod';

export const CURRENT_DATA_VERSION = 1 as const;

export const entityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, 'Invalid identifier');

export const accentColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color');

export const iconDataUrlSchema = z
  .string()
  .max(1_500_000, 'The icon must be smaller than 1 MB')
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i, 'Unsupported icon format');

export const spaceSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(40),
    startUrl: z.string().url().max(2_048),
    hostname: z.string().min(1).max(253),
    includeSubdomains: z.boolean(),
    iconDataUrl: iconDataUrlSchema.nullable(),
    accentColor: accentColorSchema,
    symbol: z.string().trim().min(1).max(3).nullable(),
  })
  .strict()
  .superRefine((space, context) => {
    try {
      const normalized = normalizeWebsiteUrl(space.startUrl);
      if (normalized.startUrl !== space.startUrl || normalized.hostname !== space.hostname) {
        context.addIssue({
          code: 'custom',
          path: ['startUrl'],
          message: 'The website address is not normalized',
        });
      }
    } catch (error) {
      context.addIssue({
        code: 'custom',
        path: ['startUrl'],
        message: error instanceof Error ? error.message : 'Invalid website address',
      });
    }
  });

export const presetSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().trim().min(1).max(40),
    durationMinutes: z.number().int().min(5).max(240),
    spaceIds: z.array(entityIdSchema).min(1).max(24),
  })
  .strict()
  .superRefine((preset, context) => {
    if (new Set(preset.spaceIds).size !== preset.spaceIds.length) {
      context.addIssue({ code: 'custom', path: ['spaceIds'], message: 'Spaces must be unique' });
    }
  });

export const appSettingsSchema = z
  .object({
    activePresetId: entityIdSchema,
  })
  .strict();

export const persistedStateSchema = z
  .object({
    version: z.literal(CURRENT_DATA_VERSION),
    spaces: z.array(spaceSchema).max(100),
    presets: z.array(presetSchema).min(1).max(50),
    settings: appSettingsSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const spaceIds = new Set(state.spaces.map(({ id }) => id));
    const presetIds = new Set(state.presets.map(({ id }) => id));

    if (spaceIds.size !== state.spaces.length) {
      context.addIssue({ code: 'custom', path: ['spaces'], message: 'Space IDs must be unique' });
    }
    if (presetIds.size !== state.presets.length) {
      context.addIssue({ code: 'custom', path: ['presets'], message: 'Preset IDs must be unique' });
    }
    if (!presetIds.has(state.settings.activePresetId)) {
      context.addIssue({
        code: 'custom',
        path: ['settings', 'activePresetId'],
        message: 'The active preset does not exist',
      });
    }

    state.presets.forEach((preset, presetIndex) => {
      preset.spaceIds.forEach((spaceId, spaceIndex) => {
        if (!spaceIds.has(spaceId)) {
          context.addIssue({
            code: 'custom',
            path: ['presets', presetIndex, 'spaceIds', spaceIndex],
            message: 'The referenced space does not exist',
          });
        }
      });
    });
  });

export const spaceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    url: z.string().trim().min(1).max(2_048),
    includeSubdomains: z.boolean().default(false),
    iconDataUrl: iconDataUrlSchema.nullable().default(null),
    accentColor: accentColorSchema.default('#d9e8ff'),
    symbol: z.string().trim().min(1).max(3).nullable().default(null),
  })
  .strict();

export const presetInputSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    durationMinutes: z.number().int().min(5).max(240),
    spaceIds: z.array(entityIdSchema).min(1).max(24),
  })
  .strict()
  .superRefine((preset, context) => {
    if (new Set(preset.spaceIds).size !== preset.spaceIds.length) {
      context.addIssue({ code: 'custom', path: ['spaceIds'], message: 'Spaces must be unique' });
    }
  });

export type Space = z.infer<typeof spaceSchema>;
export type SpaceInput = z.input<typeof spaceInputSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type PresetInput = z.infer<typeof presetInputSchema>;
export type PersistedState = z.infer<typeof persistedStateSchema>;

export interface NormalizedWebsite {
  readonly startUrl: string;
  readonly hostname: string;
}

export function normalizeWebsiteUrl(input: string): NormalizedWebsite {
  const value = input.trim();
  if (!value) throw new Error('Enter a website address');

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    throw new Error('Enter a valid website address');
  }

  if (parsed.protocol !== 'https:') throw new Error('Only secure HTTPS websites are allowed');
  if (parsed.username || parsed.password) throw new Error('Website credentials are not allowed');

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  const validLabels = labels.every(
    (label) => /^(?!-)[a-z\d-]{1,63}(?<!-)$/.test(label) && label.length > 0,
  );

  if (
    hostname.length > 253 ||
    hostname === 'localhost' ||
    isIpAddress ||
    labels.length < 2 ||
    !validLabels ||
    /^\d+$/.test(labels.at(-1) ?? '')
  ) {
    throw new Error('Enter a public website hostname');
  }

  parsed.hostname = hostname;
  parsed.hash = '';

  return { startUrl: parsed.toString(), hostname };
}

export function hostnameMatches(
  allowedHostname: string,
  candidateHostname: string,
  includeSubdomains: boolean,
): boolean {
  const allowed = allowedHostname.toLowerCase().replace(/\.$/, '');
  const candidate = candidateHostname.toLowerCase().replace(/\.$/, '');
  return candidate === allowed || (includeSubdomains && candidate.endsWith(`.${allowed}`));
}

export function hostRulesOverlap(first: Space, second: Space): boolean {
  return (
    hostnameMatches(first.hostname, second.hostname, first.includeSubdomains) ||
    hostnameMatches(second.hostname, first.hostname, second.includeSubdomains)
  );
}

export function createDefaultState(): PersistedState {
  return persistedStateSchema.parse({
    version: CURRENT_DATA_VERSION,
    spaces: [
      {
        id: 'leetcode',
        name: 'LeetCode',
        startUrl: 'https://leetcode.com/',
        hostname: 'leetcode.com',
        includeSubdomains: false,
        iconDataUrl: null,
        accentColor: '#f0b84b',
        symbol: 'L',
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        startUrl: 'https://chatgpt.com/',
        hostname: 'chatgpt.com',
        includeSubdomains: false,
        iconDataUrl: null,
        accentColor: '#20242c',
        symbol: '✦',
      },
      {
        id: 'youtube',
        name: 'YouTube',
        startUrl: 'https://youtube.com/',
        hostname: 'youtube.com',
        includeSubdomains: true,
        iconDataUrl: null,
        accentColor: '#e45a68',
        symbol: '▶',
      },
    ],
    presets: [
      {
        id: 'default',
        name: 'Deep Work',
        durationMinutes: 60,
        spaceIds: ['leetcode', 'chatgpt', 'youtube'],
      },
    ],
    settings: { activePresetId: 'default' },
  });
}
