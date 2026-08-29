import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppInfo } from '../../shared/contracts';
import wallpaperUrl from './assets/polo-wallpaper.png';
import {
  ArrowLeftIcon,
  BatteryIcon,
  CheckIcon,
  CloseIcon,
  MinusIcon,
  MoreIcon,
  PlayIcon,
  PlusIcon,
  ShieldIcon,
  WifiIcon,
} from './components/Icons';
import { SpaceDock, type DraftSpace, type Space } from './components/SpaceDock';

type AppScreen = 'setup' | 'launcher' | 'workspace' | 'blocked' | 'complete';

const durationOptions = [25, 45, 60, 90];
const initialSpaces: Space[] = [
  { id: 'leetcode', name: 'LeetCode', url: 'https://leetcode.com', mark: 'L', tone: 'amber' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', mark: '✦', tone: 'ink' },
  { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', mark: '▶', tone: 'rose' },
];
const emptyDraft: DraftSpace = { name: '', url: '', logoUrl: undefined };

function formatClock(totalMinutes: number) {
  return `${String(totalMinutes).padStart(2, '0')}:00`;
}

function SystemChrome({ remaining }: { remaining: string | undefined }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="system-chrome" aria-label="Session status">
      <div className="camera-island" aria-hidden="true">
        <span />
      </div>
      <div className="system-chrome__right">
        <WifiIcon />
        <BatteryIcon />
        <span>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        {remaining ? <span className="session-chip">{remaining}</span> : null}
      </div>
    </header>
  );
}

function SetupCard({
  duration,
  onDurationChange,
  onStart,
  starting,
}: {
  duration: number;
  onDurationChange: (duration: number) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const [referenceTime] = useState(Date.now);
  const endTime = useMemo(() => {
    const date = new Date(referenceTime + duration * 60_000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [duration, referenceTime]);

  return (
    <div className="setup-stack">
      <section className="duration-card" aria-labelledby="focus-heading">
        <div className="duration-card__meta">
          <span>Focus duration</span>
          <span>until {endTime}</span>
        </div>
        <div className="duration-stepper">
          <button
            type="button"
            aria-label="Decrease duration"
            onClick={() => onDurationChange(Math.max(5, duration - 5))}
          >
            <MinusIcon />
          </button>
          <div aria-live="polite">
            <strong>{duration}</strong>
            <span>min</span>
          </div>
          <button
            type="button"
            aria-label="Increase duration"
            onClick={() => onDurationChange(Math.min(240, duration + 5))}
          >
            <PlusIcon />
          </button>
        </div>
        <div className="duration-presets" aria-label="Duration presets">
          {durationOptions.map((option) => (
            <button
              type="button"
              className={duration === option ? 'is-selected' : ''}
              aria-pressed={duration === option}
              key={option}
              onClick={() => onDurationChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>
      <button
        className="start-button"
        type="button"
        aria-label="Start focus"
        disabled={starting}
        onClick={onStart}
      >
        <span className="start-button__icon">
          <PlayIcon />
        </span>
        <span>{starting ? 'Locking in…' : 'Start focus'}</span>
        <span className="start-button__duration">{duration} min</span>
      </button>
    </div>
  );
}

function Workspace({
  space,
  remaining,
  onBack,
  onBlocked,
}: {
  space: Space;
  remaining: string;
  onBack: () => void;
  onBlocked: () => void;
}) {
  return (
    <section className="workspace" aria-label={`${space.name} website preview`}>
      <header className="workspace-bar">
        <button type="button" className="workspace-back" onClick={onBack}>
          <ArrowLeftIcon />
          <span>Spaces</span>
        </button>
        <div className="workspace-identity">
          <span className={`mini-space-mark mini-space-mark--${space.tone}`}>
            {space.mark ?? '◌'}
          </span>
          <span>{space.name}</span>
          <ShieldIcon />
        </div>
        <span className="workspace-timer">{remaining}</span>
      </header>
      <div className="browser-canvas">
        <div className="browser-window">
          <div className="browser-toolbar">
            <div className="traffic-lights" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="address-pill">
              <ShieldIcon />
              <span>{space.url.replace('https://', '')}</span>
            </div>
            <MoreIcon />
          </div>
          <div className="browser-placeholder">
            <span className={`preview-emblem preview-emblem--${space.tone}`}>
              {space.mark ?? '◌'}
            </span>
            <p className="eyebrow">Controlled workspace</p>
            <h2>{space.name} is ready.</h2>
            <p>This is the static website shell. The live secure browser arrives in Phase 6.</p>
            <button type="button" onClick={onBlocked}>
              Preview blocked navigation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmergencyExit({ onCancel, onExit }: { onCancel: () => void; onExit: () => void }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<number | null>(null);

  const stopHolding = useCallback(() => {
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldProgress(0);
  }, []);

  const startHolding = useCallback(() => {
    if (holdTimer.current !== null) return;
    holdTimer.current = window.setInterval(() => {
      setHoldProgress((current) => {
        const next = Math.min(100, current + 2);
        if (next === 100) {
          if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
          holdTimer.current = null;
          window.queueMicrotask(onExit);
        }
        return next;
      });
    }, 60);
  }, [onExit]);

  useEffect(() => stopHolding, [stopHolding]);

  return (
    <div className="modal-backdrop">
      <section className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <div className="dialog-icon dialog-icon--warning">
          <ShieldIcon />
        </div>
        <p className="eyebrow">Emergency exit</p>
        <h2 id="exit-title">End this focus session?</h2>
        <p>Your setup stays safe. This focus session will simply end early.</p>
        <div className="exit-assurance">
          <span aria-hidden="true">3s</span>
          <p>A deliberate hold prevents accidental exits. Release anytime to keep focusing.</p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="hold-exit-button"
            style={{ '--hold-progress': `${holdProgress}%` } as CSSProperties}
            aria-label="Press and hold for three seconds to end session"
            onPointerDown={startHolding}
            onPointerUp={stopHolding}
            onPointerCancel={stopHolding}
            onPointerLeave={stopHolding}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) startHolding();
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') stopHolding();
            }}
          >
            <span className="hold-exit-button__fill" aria-hidden="true" />
            <span>{holdProgress > 0 ? 'Keep holding…' : 'Hold to end'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [duration, setDuration] = useState(60);
  const [spaces, setSpaces] = useState(initialSpaces);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startTimer = useRef<number | null>(null);
  const [, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!window.lockIn) return;
    let active = true;
    window.lockIn
      .getAppInfo()
      .then((info) => {
        if (active) setAppInfo(info);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (startTimer.current !== null) window.clearTimeout(startTimer.current);
    },
    [],
  );

  const remaining = formatClock(duration);
  const focusActive = screen !== 'setup' && screen !== 'complete';

  const openSpace = (space: Space) => {
    if (screen === 'setup') {
      setDraft({ name: space.name, url: space.url, logoUrl: space.logoUrl });
      setEditingSpaceId(space.id);
      setEditorOpen(true);
      return;
    }
    setActiveSpace(space);
    setScreen('workspace');
  };

  const saveSpace = () => {
    const trimmedUrl = draft.url.trim();
    const normalizedUrl = /^https:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    const nextSpace: Space = {
      id: `space-${Date.now()}`,
      name: draft.name.trim(),
      url: normalizedUrl,
      tone: 'crystal',
      ...(draft.logoUrl ? { logoUrl: draft.logoUrl } : {}),
    };
    setSpaces((current) =>
      editingSpaceId
        ? current.map((space) =>
            space.id === editingSpaceId ? { ...nextSpace, id: editingSpaceId } : space,
          )
        : [...current, nextSpace],
    );
    setDraft(emptyDraft);
    setEditingSpaceId(null);
    setEditorOpen(false);
  };

  const finishSession = () => {
    setEmergencyOpen(false);
    setSessionMenuOpen(false);
    setActiveSpace(null);
    setScreen('complete');
  };

  const startSession = () => {
    if (isStarting) return;
    setEditorOpen(false);
    setEditingSpaceId(null);
    setSessionMenuOpen(false);
    setIsStarting(true);
    setScreen('launcher');
    startTimer.current = window.setTimeout(() => {
      setIsStarting(false);
      startTimer.current = null;
    }, 900);
  };

  return (
    <main
      className={`app-shell ${isStarting ? 'is-starting' : ''}`}
      style={{ '--wallpaper': `url(${wallpaperUrl})` } as CSSProperties}
    >
      <SystemChrome remaining={focusActive && screen === 'launcher' ? remaining : undefined} />

      {screen === 'setup' || isStarting ? (
        <section className={`setup-screen ${isStarting ? 'setup-screen--departing' : ''}`}>
          <div className="hero-copy">
            <p className="brand-kicker">LockIn</p>
            <h1 id="focus-heading" aria-label="One thing at a time.">
              One thing
              <br />
              at a time.
            </h1>
            <p>Choose the time. Keep only what helps.</p>
          </div>
          <SetupCard
            duration={duration}
            onDurationChange={setDuration}
            onStart={startSession}
            starting={isStarting}
          />
        </section>
      ) : null}

      {screen === 'launcher' ? (
        <section className="launcher-screen">
          <div className="launcher-message" aria-hidden="true">
            <span>Stay with the work.</span>
          </div>
          <div className="session-control-wrap">
            <button
              className="session-control"
              type="button"
              aria-label="Open session controls"
              aria-expanded={sessionMenuOpen}
              onClick={() => setSessionMenuOpen((open) => !open)}
            >
              <span className="session-control__ring">
                <span />
              </span>
            </button>
            {sessionMenuOpen ? (
              <div className="focus-panel" role="dialog" aria-label="Focus session controls">
                <div className="focus-panel__header">
                  <span className="focus-panel__glyph" aria-hidden="true">
                    <span />
                  </span>
                  <div>
                    <p className="eyebrow">Focus in progress</p>
                    <strong>Everything else can wait.</strong>
                  </div>
                  <button
                    type="button"
                    aria-label="Close session controls"
                    onClick={() => setSessionMenuOpen(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="focus-panel__time">
                  <strong>{remaining}</strong>
                  <span>remaining</span>
                </div>
                <div className="focus-panel__progress" aria-hidden="true">
                  <span />
                </div>
                <div className="focus-panel__meta">
                  <span>{spaces.length} spaces available</span>
                  <span>{duration} min session</span>
                </div>
                <button
                  className="focus-panel__exit"
                  type="button"
                  onClick={() => setEmergencyOpen(true)}
                >
                  End focus early
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {screen === 'workspace' && activeSpace ? (
        <Workspace
          space={activeSpace}
          remaining={remaining}
          onBack={() => setScreen('launcher')}
          onBlocked={() => setScreen('blocked')}
        />
      ) : null}

      {screen === 'blocked' ? (
        <section className="centered-state">
          <div className="state-card">
            <div className="dialog-icon">
              <ShieldIcon />
            </div>
            <p className="eyebrow">Outside your session</p>
            <h2>This destination can wait.</h2>
            <p>example.com isn’t one of the spaces you chose for this focus session.</p>
            <button className="primary-button" type="button" onClick={() => setScreen('workspace')}>
              <ArrowLeftIcon />
              Back to work
            </button>
          </div>
        </section>
      ) : null}

      {screen === 'complete' ? (
        <section className="centered-state">
          <div className="state-card state-card--complete">
            <div className="dialog-icon dialog-icon--success">
              <CheckIcon />
            </div>
            <p className="eyebrow">Session complete</p>
            <h2>You made space for what matters.</h2>
            <p className="completion-time">{duration}:00</p>
            <p>Focused with {spaces.length} carefully chosen spaces.</p>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setScreen('setup')}>
                Finish
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => setScreen('launcher')}
              >
                Start again
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {screen === 'setup' || screen === 'launcher' ? (
        <SpaceDock
          spaces={spaces}
          allowAdding={screen === 'setup'}
          editing={editingSpaceId !== null}
          activeEditor={editorOpen}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={openSpace}
          onAddRequest={() => {
            setDraft(emptyDraft);
            setEditingSpaceId(null);
            setEditorOpen(true);
          }}
          onAddCancel={() => {
            setDraft(emptyDraft);
            setEditingSpaceId(null);
            setEditorOpen(false);
          }}
          onAddSave={saveSpace}
        />
      ) : null}

      {emergencyOpen ? (
        <EmergencyExit onCancel={() => setEmergencyOpen(false)} onExit={finishSession} />
      ) : null}
      {screen === 'setup' ? (
        <button className="quiet-close" type="button" aria-label="Close LockIn">
          <CloseIcon />
        </button>
      ) : null}
    </main>
  );
}
