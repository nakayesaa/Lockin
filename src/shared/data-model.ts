import { z } from 'zod';
import { normalizeWebsiteUrl } from './website-rules';

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
    name: z.string().trim().max(40).default(''),
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
