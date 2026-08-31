import { z } from 'zod';

const nullableWebUrlSchema = z.url().startsWith('https://').nullable();

export const spotifyPlaybackSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('disconnected') }).strict(),
  z.object({ status: z.literal('idle') }).strict(),
  z
    .object({
      status: z.literal('active'),
      isPlaying: z.boolean(),
      title: z.string().min(1),
      artist: z.string().min(1),
      artworkUrl: nullableWebUrlSchema,
      spotifyUrl: nullableWebUrlSchema,
      contextName: z.string().min(1).nullable(),
      durationMs: z.number().int().nonnegative(),
      progressMs: z.number().int().nonnegative(),
      fetchedAt: z.number().int().positive(),
    })
    .strict(),
]);

export type SpotifyPlayback = z.infer<typeof spotifyPlaybackSchema>;
