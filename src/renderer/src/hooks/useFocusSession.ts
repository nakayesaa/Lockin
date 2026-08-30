import { useCallback, useEffect, useState } from 'react';
import type { Preset, Space } from '../../../shared/data-model';
import type { SessionRecord } from '../../../shared/session-model';
import { CURRENT_SESSION_VERSION, remainingSessionSeconds } from '../../../shared/session-time';
import { errorMessage } from '../errorMessage';

export interface FocusSessionController {
  readonly session: SessionRecord | null;
  readonly remainingSeconds: number;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly blockedDestination: string | null;
  start(preset: Preset, spaces: Space[]): Promise<boolean>;
  end(): Promise<boolean>;
  clear(): Promise<boolean>;
  openSpace(id: string): Promise<boolean>;
  closeSpace(): Promise<void>;
  dismissNotice(): void;
  dismissBlocked(): void;
}

function previewSession(preset: Preset, spaces: Space[]): SessionRecord {
  const startedAt = new Date();
  const durationSeconds = preset.durationMinutes * 60;
  return {
    version: CURRENT_SESSION_VERSION,
    id: `preview-${Date.now()}`,
    presetId: preset.id,
    presetName: preset.name,
    durationSeconds,
    startedAt: startedAt.toISOString(),
    endsAt: new Date(startedAt.getTime() + durationSeconds * 1_000).toISOString(),
    endedAt: null,
    endReason: null,
    spaces: structuredClone(spaces),
  };
}

export function useFocusSession(): FocusSessionController {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(Boolean(window.lockIn?.getSession));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockedDestination, setBlockedDestination] = useState<string | null>(null);

  const publish = useCallback((next: SessionRecord | null) => {
    setSession(next);
    setRemainingSeconds(next ? remainingSessionSeconds(next) : 0);
  }, []);

  useEffect(() => {
    const api = window.lockIn;
    if (!api?.getSession) return;
    let mounted = true;
    const unsubscribe = api.onSessionEvent?.((event) => {
      if (mounted && event.type === 'navigation-blocked') {
        setBlockedDestination(event.destination);
      }
    });
    api
      .getSession()
      .then((result) => {
        if (!mounted) return;
        publish(result.session);
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
      unsubscribe?.();
    };
  }, [publish]);

  useEffect(() => {
    if (!session || session.endReason !== null) return;
    const tick = () => {
      const remaining = remainingSessionSeconds(session);
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        setSession({ ...session, endedAt: session.endsAt, endReason: 'completed' });
      }
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [session]);

  const run = useCallback(
    async (operation: () => Promise<SessionRecord | null>): Promise<boolean> => {
      setBusy(true);
      try {
        publish(await operation());
        return true;
      } catch (error) {
        setNotice(errorMessage(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [publish],
  );

  const start = useCallback(
    (preset: Preset, spaces: Space[]) =>
      run(async () => {
        const api = window.lockIn;
        if (!api?.startSession) return previewSession(preset, spaces);
        const result = await api.startSession(preset.id);
        if (result.notice) setNotice(result.notice);
        return result.session;
      }),
    [run],
  );

  const end = useCallback(
    () =>
      run(async () => {
        const api = window.lockIn;
        if (api?.endSession) return (await api.endSession()).session;
        if (!session) throw new Error('No focus session exists');
        const endedAt = new Date(Math.min(Date.now(), Date.parse(session.endsAt))).toISOString();
        return { ...session, endedAt, endReason: 'ended-early' };
      }),
    [run, session],
  );

  const clear = useCallback(
    () =>
      run(async () => {
        const api = window.lockIn;
        if (api?.clearSession) await api.clearSession();
        return null;
      }),
    [run],
  );

  const openSpace = useCallback(async (id: string) => {
    try {
      await window.lockIn?.openSite?.(id);
      return true;
    } catch (error) {
      setNotice(errorMessage(error));
      return false;
    }
  }, []);

  const closeSpace = useCallback(async () => {
    try {
      await window.lockIn?.closeSite?.();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  return {
    session,
    remainingSeconds,
    loading,
    busy,
    notice,
    blockedDestination,
    start,
    end,
    clear,
    openSpace,
    closeSpace,
    dismissNotice: () => setNotice(null),
    dismissBlocked: () => setBlockedDestination(null),
  };
}
