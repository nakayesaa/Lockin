export const SPOTIFY_CLIENT_ID =
  process.env.LOCKIN_SPOTIFY_CLIENT_ID?.trim() || '9f287a51bccb406584a5103bad786978';

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-playback-state',
] as const;
