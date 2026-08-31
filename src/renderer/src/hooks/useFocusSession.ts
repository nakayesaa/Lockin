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
  readonly siteState: SiteState;
  start(preset: Preset, spaces: Space[]): Promise<boolean>;
  end(): Promise<boolean>;
  clear(): Promise<boolean>;
  openSpace(id: string): Promise<boolean>;
  closeSpace(): Promise<void>;
  hideSiteControls(): void;
  clearWebsiteData(): Promise<boolean>;
  dismissNotice(): void;
  dismissBlocked(): void;
}

export type SiteState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' | 'ready'; readonly spaceId: string }
  | { readonly status: 'failed'; readonly spaceId: string; readonly message: string };

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
  const [siteState, setSiteState] = useState<SiteState>({ status: 'idle' });

  const publish = useCallback((next: SessionRecord | null) => {
    setSession(next);
    setRemainingSeconds(next ? remainingSessionSeconds(next) : 0);
  }, []);

  useEffect(() => {
    const api = window.lockIn;
    if (!api?.getSession) return;
    let mounted = true;
    const unsubscribe = api.onSessionEvent?.((event) => {
      if (!mounted) return;
      if (event.type === 'session-completed') {
        setSiteState({ status: 'idle' });
        setBlockedDestination(null);
        void api
          .getSession()
          .then((result) => {
            if (mounted) publish(result.session);
          })
          .catch((error: unknown) => {
            if (mounted) setNotice(errorMessage(error));
          });
      } else if (event.type === 'navigation-blocked') {
        setSiteState({ status: 'idle' });
        setBlockedDestination(event.destination);
      } else if (event.status === 'failed') {
        setSiteState({ status: event.status, spaceId: event.spaceId, message: event.message });
      } else {
        setSiteState({ status: event.status, spaceId: event.spaceId });
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
      if (remaining === 0 && !window.lockIn?.getSession) {
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
    setSiteState({ status: 'loading', spaceId: id });
    try {
      const openSite = window.lockIn?.openSite;
      if (openSite) await openSite(id);
      else setSiteState({ status: 'ready', spaceId: id });
      return true;
    } catch (error) {
      setSiteState({ status: 'idle' });
      setNotice(errorMessage(error));
      return false;
    }
  }, []);

  const closeSpace = useCallback(async () => {
    try {
      await window.lockIn?.closeSite?.();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSiteState({ status: 'idle' });
    }
  }, []);

  const hideSiteControls = useCallback(() => {
    void window.lockIn?.setSiteControlsVisible(false).catch((error: unknown) => {
      setNotice(errorMessage(error));
    });
  }, []);

  const clearWebsiteData = useCallback(async () => {
    setBusy(true);
    try {
      await window.lockIn?.clearWebsiteData?.();
      setNotice('Website data cleared. You’ll sign in again next time.');
      return true;
    } catch (error) {
      setNotice(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    session,
    remainingSeconds,
    loading,
    busy,
    notice,
    blockedDestination,
    siteState,
    start,
    end,
    clear,
    openSpace,
    closeSpace,
    hideSiteControls,
    clearWebsiteData,
    dismissNotice: () => setNotice(null),
    dismissBlocked: () => setBlockedDestination(null),
  };
}
