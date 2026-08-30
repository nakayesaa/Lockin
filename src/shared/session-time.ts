import type { SessionRecord } from './session-model';

export const CURRENT_SESSION_VERSION = 1 as const;

export function remainingSessionSeconds(session: SessionRecord, now = Date.now()): number {
  if (session.endReason !== null) return 0;
  return Math.min(
    session.durationSeconds,
    Math.max(0, Math.ceil((Date.parse(session.endsAt) - now) / 1_000)),
  );
}

export function focusedSessionSeconds(session: SessionRecord): number {
  const finish = Date.parse(session.endedAt ?? session.endsAt);
  return Math.max(0, Math.round((finish - Date.parse(session.startedAt)) / 1_000));
}
