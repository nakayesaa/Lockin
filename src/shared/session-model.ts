import { z } from 'zod';
import { entityIdSchema, spaceSchema } from './data-model';

export const CURRENT_SESSION_VERSION = 1 as const;

const timestampSchema = z.iso.datetime({ offset: true });

export const sessionRecordSchema = z
  .object({
    version: z.literal(CURRENT_SESSION_VERSION),
    id: entityIdSchema,
    presetId: entityIdSchema,
    presetName: z.string().trim().min(1).max(40),
    durationSeconds: z.number().int().min(300).max(14_400),
    startedAt: timestampSchema,
    endsAt: timestampSchema,
    endedAt: timestampSchema.nullable(),
    endReason: z.enum(['completed', 'ended-early']).nullable(),
    spaces: z.array(spaceSchema).min(1).max(24),
  })
  .strict()
  .superRefine((session, context) => {
    const startedAt = Date.parse(session.startedAt);
    const endsAt = Date.parse(session.endsAt);
    const endedAt = session.endedAt ? Date.parse(session.endedAt) : null;

    if (endsAt - startedAt !== session.durationSeconds * 1_000) {
      context.addIssue({ code: 'custom', path: ['endsAt'], message: 'Invalid session duration' });
    }
    if ((endedAt === null) !== (session.endReason === null)) {
      context.addIssue({ code: 'custom', path: ['endedAt'], message: 'Incomplete ending state' });
    }
    if (endedAt !== null && (endedAt < startedAt || endedAt > endsAt)) {
      context.addIssue({ code: 'custom', path: ['endedAt'], message: 'Invalid ending time' });
    }
    if (session.endReason === 'completed' && session.endedAt !== session.endsAt) {
      context.addIssue({ code: 'custom', path: ['endedAt'], message: 'Invalid completion time' });
    }

    const spaceIds = new Set(session.spaces.map(({ id }) => id));
    if (spaceIds.size !== session.spaces.length) {
      context.addIssue({ code: 'custom', path: ['spaces'], message: 'Space IDs must be unique' });
    }
  });

export const sessionFileSchema = sessionRecordSchema.nullable();

export type SessionRecord = z.infer<typeof sessionRecordSchema>;
