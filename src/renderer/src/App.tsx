import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Space } from '../../shared/data-model';
import wallpaperUrl from './assets/polo-wallpaper.png';
import {
  ArrowLeftIcon,
  BatteryIcon,
  CheckIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  ShieldIcon,
  WifiIcon,
} from './components/Icons';
import { PresetControl } from './components/PresetControl';
import { SpaceDock, type DraftSpace } from './components/SpaceDock';
import { spaceTone } from './components/spaceAppearance';
import { SpotifyPlayer } from './components/SpotifyPlayer';
import { useWorkspace } from './hooks/useWorkspace';

type AppScreen = 'setup' | 'launcher' | 'workspace' | 'blocked' | 'complete';

const durationOptions = [25, 45, 60, 90];
const emptyDraft: DraftSpace = {
  name: '',
  url: '',
  iconDataUrl: null,
  includeSubdomains: false,
  accentColor: '#d9e8ff',
  symbol: null,
};

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  disabled,
}: {
  duration: number;
  onDurationChange: (duration: number) => void;
  onStart: () => void;
  starting: boolean;
  disabled: boolean;
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
            disabled={disabled}
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
            disabled={disabled}
            onClick={() => onDurationChange(Math.min(240, duration + 5))}
          >
            <PlusIcon />
          </button>
        </div>
        <div className="duration-presets" aria-label="Duration presets">
          {durationOptions.map((option) => (
            <button
              type="button"
              disabled={disabled}
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
        disabled={starting || disabled}
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
  const tone = spaceTone(space);
  return (
    <section className="workspace" aria-label={`${space.name} website preview`}>
      <button type="button" className="immersive-back" onClick={onBack}>
        <span className="immersive-back__icon">
          <ArrowLeftIcon />
        </span>
        <span className="immersive-back__label">Back</span>
      </button>
      <span className="immersive-timer" aria-label={`${remaining} remaining`}>
        {remaining}
      </span>
      <div className={`website-surface website-surface--${tone}`}>
        <div className="website-surface__ambient" aria-hidden="true" />
        <div className="website-content">
          <span className={`preview-emblem preview-emblem--${tone}`}>{space.symbol ?? '◌'}</span>
          <p className="eyebrow">Immersive website preview</p>
          <h2>{space.name} is ready.</h2>
          <p>
            In the connected app, the real website fills this entire surface—without browser or
            LockIn chrome.
          </p>
          <button type="button" onClick={onBlocked}>
            Preview blocked navigation
          </button>
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
    let progress = 0;
    holdTimer.current = window.setInterval(() => {
      progress = Math.min(100, progress + 1);
      setHoldProgress(progress);
      if (progress === 100) {
        if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
        holdTimer.current = null;
        onExit();
      }
    }, 100);
  }, [onExit]);

  useEffect(() => stopHolding, [stopHolding]);
  useEffect(() => {
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', cancelWithEscape);
    return () => window.removeEventListener('keydown', cancelWithEscape);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop minimal-exit-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="End focus session"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <button
        type="button"
        className="hold-exit-button"
        style={{ '--hold-progress': `${holdProgress}%` } as CSSProperties}
        aria-label="Press and hold for ten seconds to end session"
        onPointerDown={(event) => {
          event.stopPropagation();
          startHolding();
        }}
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
        <span>Hold To End</span>
      </button>
    </div>
  );
}

export function App() {
  const workspace = useWorkspace();
  const duration = workspace.activePreset.durationMinutes;
  const spaces = workspace.activeSpaces;
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(duration * 60);
  const startTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (startTimer.current !== null) window.clearTimeout(startTimer.current);
    },
    [],
  );

  const focusActive = screen !== 'setup' && screen !== 'complete';
  const remaining = formatClock(remainingSeconds);
  const remainingPercent = (remainingSeconds / (duration * 60)) * 100;

  useEffect(() => {
    if (!focusActive) return;
    const timer = window.setInterval(
      () => setRemainingSeconds((current) => Math.max(0, current - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [focusActive]);

  const openSpace = (space: Space) => {
    if (screen === 'setup') {
      setDraft({
        name: space.name,
        url: space.startUrl,
        iconDataUrl: space.iconDataUrl,
        includeSubdomains: space.includeSubdomains,
        accentColor: space.accentColor,
        symbol: space.symbol,
      });
      setEditingSpaceId(space.id);
      setEditorOpen(true);
      return;
    }
    setActiveSpace(space);
    setScreen('workspace');
  };

  const saveSpace = async () => {
    const saved = await workspace.saveSpace(editingSpaceId, {
      name: draft.name,
      url: draft.url,
      includeSubdomains: draft.includeSubdomains,
      iconDataUrl: draft.iconDataUrl,
      accentColor: draft.accentColor,
      symbol: draft.symbol,
    });
    if (saved) {
      setDraft(emptyDraft);
      setEditingSpaceId(null);
      setEditorOpen(false);
    }
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
    setRemainingSeconds(duration * 60);
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
      {screen !== 'workspace' ? (
        <SystemChrome remaining={focusActive && screen === 'launcher' ? remaining : undefined} />
      ) : null}

      {screen === 'setup' || isStarting ? (
        <section className={`setup-screen ${isStarting ? 'setup-screen--departing' : ''}`}>
          {screen === 'setup' ? (
            <PresetControl
              presets={workspace.state.presets}
              spaces={workspace.state.spaces}
              activePreset={workspace.activePreset}
              saving={workspace.saving || workspace.loading}
              onSelect={workspace.setActivePreset}
              onCreate={workspace.createPreset}
              onRename={workspace.renamePreset}
              onDuplicate={workspace.duplicatePreset}
              onDelete={workspace.deletePreset}
              onToggleSpace={workspace.togglePresetSpace}
            />
          ) : null}
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
            onDurationChange={(value) => void workspace.setDuration(value)}
            onStart={startSession}
            starting={isStarting}
            disabled={workspace.loading || workspace.saving}
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
                <div className="focus-panel__time">
                  <strong>{remaining}</strong>
                  <span>remaining</span>
                </div>
                <div className="focus-panel__progress" aria-hidden="true">
                  <span style={{ width: `${remainingPercent}%` }} />
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
        <section className="centered-state centered-state--complete">
          <div className="completion-card">
            <div className="completion-mark" aria-hidden="true">
              <span className="completion-mark__halo" />
              <span className="completion-mark__check">
                <CheckIcon />
              </span>
            </div>
            <p className="eyebrow">Session complete</p>
            <h2>That was time well spent.</h2>
            <p className="completion-lead">You gave one thing your full attention.</p>
            <div className="completion-summary">
              <div>
                <strong>{duration}:00</strong>
                <span>focused</span>
              </div>
              <span className="completion-summary__divider" aria-hidden="true" />
              <div>
                <strong>{spaces.length}</strong>
                <span>spaces</span>
              </div>
            </div>
            <div className="completion-actions">
              <button
                type="button"
                className="completion-button completion-button--quiet"
                onClick={() => setScreen('setup')}
              >
                Done
              </button>
              <button
                type="button"
                className="completion-button completion-button--primary"
                onClick={() => {
                  setRemainingSeconds(duration * 60);
                  setScreen('launcher');
                }}
              >
                Start another
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
          saving={workspace.saving || workspace.loading}
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
          onAddSave={() => void saveSpace()}
          onDelete={() => {
            if (!editingSpaceId) return;
            void workspace.deleteSpace(editingSpaceId).then((deleted) => {
              if (deleted) {
                setDraft(emptyDraft);
                setEditingSpaceId(null);
                setEditorOpen(false);
              }
            });
          }}
          onMove={(direction) => {
            if (editingSpaceId) void workspace.moveSpace(editingSpaceId, direction);
          }}
        />
      ) : null}

      {workspace.notice ? (
        <div className="app-notice" role="status">
          <span>{workspace.notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={workspace.dismissNotice}>
            ×
          </button>
        </div>
      ) : null}

      {emergencyOpen ? (
        <EmergencyExit onCancel={() => setEmergencyOpen(false)} onExit={finishSession} />
      ) : null}
      {screen === 'setup' || screen === 'launcher' ? <SpotifyPlayer /> : null}
    </main>
  );
}
