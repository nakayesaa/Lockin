import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { SpotifyOverlay } from '../../src/renderer/src/components/SpotifyPlayer';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';
import { CURRENT_SESSION_VERSION } from '../../src/shared/session-time';
import type { SessionEvent, SpotifyPlayback } from '../../src/shared/contracts';

describe('LockIn product flow', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: undefined,
    });
  });

  it('renders the setup experience and changes duration', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /one thing at a time/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '45' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '45' })).toHaveAttribute('aria-pressed', 'true'),
    );

    const customDuration = screen.getByRole('spinbutton', {
      name: 'Custom duration in minutes',
    });
    fireEvent.change(customDuration, { target: { value: '1' } });
    fireEvent.blur(customDuration);
    await waitFor(() => expect(customDuration).toHaveValue(1));
    expect(screen.getByRole('button', { name: 'Start focus' })).toHaveTextContent('1 min');
  });

  it('adds a crystal space to the dynamic dock', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add an allowed website' }));
    expect(screen.getByLabelText('Name')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Figma' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'figma.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to focus' }));

    expect(await screen.findByRole('button', { name: 'Open Figma' })).toBeVisible();
  });

  it('closes the space editor with Escape and restores keyboard focus', () => {
    render(<App />);
    const addSpace = screen.getByRole('button', { name: 'Add an allowed website' });
    addSpace.focus();
    fireEvent.click(addSpace);

    expect(screen.getByLabelText('Name')).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Add a space' })).not.toBeInTheDocument();
    expect(addSpace).toHaveFocus();
  });

  it('manages presets without leaving the setup screen', async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open preset menu. Current preset: Deep Work' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create preset' }));
    expect(
      await screen.findByRole('button', { name: 'Open preset menu. Current preset: New Focus' }),
    ).toBeVisible();

    const name = screen.getByLabelText('Preset name');
    fireEvent.change(name, { target: { value: 'Writing' } });
    fireEvent.blur(name);
    await waitFor(() => expect(name).toHaveValue('Writing'));

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByRole('option', { name: /Writing Copy/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Writing Copy/ })).not.toBeInTheDocument(),
    );

    const presetTrigger = screen.getByRole('button', {
      name: /Open preset menu\. Current preset:/,
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(presetTrigger).toHaveFocus());
  });

  it('keeps an unsafe website draft open and shows a useful error', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add an allowed website' }));
    fireEvent.change(screen.getByLabelText('Website'), {
      target: { value: 'http://unsafe.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to focus' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Only secure HTTPS websites are allowed',
    );
    expect(screen.getByRole('region', { name: 'Add a space' })).toBeVisible();
  });

  it('loads persisted data and saves preset duration through the bridge', async () => {
    const initial = createDefaultWorkspace();
    initial.presets[0]!.name = 'Persisted Work';
    const updated = structuredClone(initial);
    updated.presets[0]!.durationMinutes = 45;
    const getWorkspace = vi.fn().mockResolvedValue({ state: initial, notice: null });
    const updatePreset = vi.fn().mockResolvedValue({ state: updated, notice: null });
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: { getWorkspace, updatePreset },
    });

    render(<App />);
    expect(
      await screen.findByRole('button', {
        name: 'Open preset menu. Current preset: Persisted Work',
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '45' }));

    await waitFor(() =>
      expect(updatePreset).toHaveBeenCalledWith('default', {
        name: 'Persisted Work',
        durationMinutes: 45,
        spaceIds: ['leetcode', 'chatgpt', 'youtube'],
      }),
    );
    expect(screen.getByRole('button', { name: '45' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('requires confirmation before clearing private website data', async () => {
    const state = createDefaultWorkspace();
    const clearWebsiteData = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: {
        getWorkspace: vi.fn().mockResolvedValue({ state, notice: null }),
        clearWebsiteData,
      },
    });

    render(<App />);
    const websiteData = screen.getByRole('button', { name: 'Website data' });
    websiteData.focus();
    fireEvent.click(websiteData);
    expect(screen.getByRole('dialog', { name: 'Clear website data?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(clearWebsiteData).not.toHaveBeenCalled();

    const clearData = screen.getByRole('button', { name: 'Clear data' });
    clearData.focus();
    fireEvent.keyDown(clearData, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(clearData);
    await waitFor(() => expect(clearWebsiteData).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('Website data cleared');
    await waitFor(() => expect(websiteData).toHaveFocus());
  });

  it('resumes a persisted session and reports real blocked navigation', async () => {
    const state = createDefaultWorkspace();
    const preset = state.presets[0]!;
    const startedAt = new Date();
    const openSite = vi.fn().mockResolvedValue(undefined);
    let emit: ((event: SessionEvent) => void) | undefined;
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: {
        getWorkspace: vi.fn().mockResolvedValue({ state, notice: null }),
        getSession: vi.fn().mockResolvedValue({
          session: {
            version: CURRENT_SESSION_VERSION,
            id: 'restored-session',
            presetId: preset.id,
            presetName: preset.name,
            durationSeconds: preset.durationMinutes * 60,
            startedAt: startedAt.toISOString(),
            endsAt: new Date(startedAt.getTime() + preset.durationMinutes * 60_000).toISOString(),
            endedAt: null,
            endReason: null,
            spaces: state.spaces,
          },
          notice: null,
        }),
        openSite,
        onSessionEvent: (listener: (event: SessionEvent) => void) => {
          emit = listener;
          return vi.fn();
        },
        closeSite: vi.fn(),
      },
    });

    render(<App />);
    expect(await screen.findByRole('button', { name: 'Open session controls' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    expect(await screen.findByRole('heading', { name: 'Opening ChatGPT…' })).toBeVisible();
    act(() =>
      emit?.({
        type: 'site-state-changed',
        status: 'failed',
        spaceId: 'chatgpt',
        message: 'The website stopped unexpectedly.',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Couldn’t open ChatGPT.' })).toBeVisible();
    expect(screen.getByText('The website stopped unexpectedly.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(openSite).toHaveBeenCalledTimes(2));
    act(() => emit?.({ type: 'navigation-blocked', destination: 'example.com' }));

    expect(
      await screen.findByRole('heading', { name: 'This destination can wait.' }),
    ).toBeVisible();
    expect(screen.getByText(/example\.com isn’t one of the spaces/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back to work' })).toHaveFocus();

    const endsAt = new Date(startedAt.getTime() + preset.durationMinutes * 60_000).toISOString();
    const getSession = window.lockIn?.getSession as ReturnType<typeof vi.fn>;
    getSession.mockResolvedValue({
      session: {
        version: CURRENT_SESSION_VERSION,
        id: 'restored-session',
        presetId: preset.id,
        presetName: preset.name,
        durationSeconds: preset.durationMinutes * 60,
        startedAt: startedAt.toISOString(),
        endsAt,
        endedAt: endsAt,
        endReason: 'completed',
        spaces: state.spaces,
      },
      notice: null,
    });
    act(() => emit?.({ type: 'session-completed' }));
    expect(await screen.findByRole('heading', { name: 'That was time well spent.' })).toBeVisible();
  });

  it('previews the floating album player interactions', () => {
    render(<App />);

    expect(screen.getByRole('complementary', { name: 'Spotify player preview' })).toBeVisible();
    expect(screen.getByText('falling in love')).toBeVisible();
    expect(screen.getByText('Blue Hour')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
    expect(screen.getByText('Soft Current')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
    expect(screen.getByRole('button', { name: 'Play music' })).toBeVisible();
  });

  it('connects and controls live Spotify playback through the desktop bridge', async () => {
    const state = createDefaultWorkspace();
    let playback: SpotifyPlayback = { status: 'disconnected' };
    const connected: SpotifyPlayback = {
      status: 'active',
      isPlaying: true,
      title: 'A Moment Apart',
      artist: 'ODESZA',
      artworkUrl: 'https://i.scdn.co/playlist.jpg',
      spotifyUrl: 'https://open.spotify.com/track/track-id',
      contextName: 'Deep Focus',
      durationMs: 180_000,
      progressMs: 12_000,
      fetchedAt: Date.now(),
    };
    const getSpotifyPlayback = vi.fn(async () => playback);
    const connectSpotify = vi.fn(async () => {
      playback = connected;
      return playback;
    });
    const pauseSpotify = vi.fn(async () => {
      playback = { ...connected, isPlaying: false };
    });
    const nextSpotify = vi.fn(async () => {
      playback = { ...connected, title: 'Bloom' };
    });
    const openSpotify = vi.fn();
    const disconnectSpotify = vi.fn(async () => {
      playback = { status: 'disconnected' };
    });
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: {
        getWorkspace: vi.fn().mockResolvedValue({ state, notice: null }),
        getSpotifyPlayback,
        connectSpotify,
        disconnectSpotify,
        playSpotify: vi.fn(),
        pauseSpotify,
        nextSpotify,
        openSpotify,
      },
    });

    render(<App />);
    expect(screen.queryByText('Premium account required.')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Spotify' }));
    expect(await screen.findByText('A Moment Apart')).toBeVisible();
    expect(screen.getByText('ODESZA · Deep Focus')).toBeVisible();

    const artwork = screen.getByRole('button', { name: 'Open A Moment Apart in Spotify' });
    const artworkImage = artwork.querySelector('img');
    const liveCover = document.querySelector('.spotify-player__live-cover');
    expect(artworkImage).not.toBeNull();
    expect(artwork).not.toHaveClass('is-visible');
    fireEvent.error(artworkImage!);
    expect(artwork).not.toHaveClass('is-visible');
    fireEvent.load(artworkImage!);
    expect(artwork).toHaveClass('is-visible');
    expect(liveCover).toHaveClass('is-visible');

    fireEvent.click(artwork);
    expect(openSpotify).toHaveBeenCalledWith('https://open.spotify.com/track/track-id');
    const pause = screen.getByRole('button', { name: 'Pause music' });
    await waitFor(() => expect(pause).toBeEnabled());
    fireEvent.click(pause);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play music' })).toBeVisible());
    expect(pauseSpotify).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
    expect(await screen.findByText('Bloom')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Spotify' }));
    expect(await screen.findByRole('button', { name: 'Connect Spotify' })).toBeVisible();
    expect(disconnectSpotify).toHaveBeenCalledOnce();
  });

  it('collapses the website Spotify overlay into an expandable disc', async () => {
    const setSpotifyOverlayExpanded = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: {
        getSpotifyPlayback: vi.fn().mockResolvedValue({ status: 'idle' }),
        setSpotifyOverlayExpanded,
      },
    });

    render(<SpotifyOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize Spotify player' }));

    expect(await screen.findByRole('button', { name: 'Expand Spotify player' })).toBeVisible();
    expect(setSpotifyOverlayExpanded).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Spotify player' }));
    expect(await screen.findByRole('button', { name: 'Minimize Spotify player' })).toBeVisible();
    expect(setSpotifyOverlayExpanded).toHaveBeenLastCalledWith(true);
  });

  it('walks from launcher to workspace and blocked navigation', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    expect(screen.getByRole('main')).toHaveClass('is-starting');
    await screen.findByRole('button', { name: 'Open session controls' });
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));

    expect(await screen.findByRole('heading', { name: 'ChatGPT is ready.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(screen.queryByText('Spaces')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview blocked navigation' }));
    expect(screen.getByRole('heading', { name: 'This destination can wait.' })).toBeVisible();
  });

  it('uses a deliberate hold interaction for emergency exit', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    await screen.findByRole('button', { name: 'Open session controls' });
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    const endEarly = screen.getByRole('button', { name: 'End focus early' });
    endEarly.focus();
    fireEvent.click(endEarly);

    expect(
      screen.getByRole('button', { name: 'Press and hold for thirty seconds to end session' }),
    ).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'End focus session' })).toHaveTextContent(
      /^Hold To End$/,
    );
    expect(
      screen.queryByRole('heading', { name: 'End this focus session?' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('END MY SESSION')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'End focus session' })).not.toBeInTheDocument();
    expect(endEarly).toHaveFocus();
  });

  it('keeps the session panel minimal while the countdown ticks', async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('status')).toHaveTextContent('60:00 remaining');
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const sessionTrigger = screen.getByRole('button', { name: 'Open session controls' });
    fireEvent.click(sessionTrigger);

    const controls = screen.getByRole('dialog', { name: 'Focus session controls' });
    expect(controls).toHaveTextContent('59:59remaining');
    expect(controls).not.toHaveTextContent('Focus in progress');
    expect(controls).not.toHaveTextContent('Everything else can wait');
    expect(screen.getByRole('button', { name: 'End focus early' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'End focus early' }), { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Focus session controls' }),
    ).not.toBeInTheDocument();
    expect(sessionTrigger).toHaveFocus();
  });

  it('shows the polished completion summary after a deliberate exit', async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'End focus early' }));
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Press and hold for thirty seconds to end session' }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(30_100));

    expect(screen.getByRole('heading', { name: 'That was time well spent.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start another' })).toHaveFocus();
  });

  it('requires one uninterrupted thirty-second hold to end early', async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'End focus early' }));
    const hold = screen.getByRole('button', {
      name: 'Press and hold for thirty seconds to end session',
    });

    fireEvent.pointerDown(hold);
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    fireEvent.pointerUp(hold);
    fireEvent.pointerDown(hold);
    await act(async () => vi.advanceTimersByTimeAsync(15_100));
    expect(screen.getByRole('dialog', { name: 'End focus session' })).toBeVisible();

    await act(async () => vi.advanceTimersByTimeAsync(14_900));
    expect(screen.getByRole('heading', { name: 'That was time well spent.' })).toBeVisible();
  });
});
