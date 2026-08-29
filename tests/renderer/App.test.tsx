import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import type { LockInApi } from '../../src/shared/contracts';

describe('Phase 3 product flow', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    const api: LockInApi = {
      getAppInfo: vi.fn().mockResolvedValue({
        name: 'LockIn',
        version: '0.1.0',
        platform: 'win32',
        isPackaged: false,
      }),
      ping: vi.fn(),
    };

    Object.defineProperty(window, 'lockIn', {
      configurable: true,
      value: api,
    });
  });

  it('renders the setup experience and changes duration', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /one thing at a time/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '45' }));
    expect(screen.getByRole('button', { name: '45' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a crystal space to the dynamic dock', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add an allowed website' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Figma' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'figma.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to focus' }));

    expect(screen.getByRole('button', { name: 'Open Figma' })).toBeVisible();
  });

  it('previews the floating album player interactions', () => {
    render(<App />);

    expect(screen.getByRole('complementary', { name: 'Spotify player preview' })).toBeVisible();
    expect(screen.getByText('Blue Hour')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
    expect(screen.getByText('Soft Current')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
    expect(screen.getByRole('button', { name: 'Play music' })).toBeVisible();
  });

  it('walks from launcher to workspace and blocked navigation', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    expect(screen.getByRole('main')).toHaveClass('is-starting');
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));

    expect(screen.getByRole('heading', { name: 'ChatGPT is ready.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(screen.queryByText('Spaces')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview blocked navigation' }));
    expect(screen.getByRole('heading', { name: 'This destination can wait.' })).toBeVisible();
  });

  it('uses a deliberate hold interaction for emergency exit', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'End focus early' }));

    expect(
      screen.getByRole('button', { name: 'Press and hold for ten seconds to end session' }),
    ).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'End focus session' })).toHaveTextContent(
      /^Hold To End$/,
    );
    expect(
      screen.queryByRole('heading', { name: 'End this focus session?' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('END MY SESSION')).not.toBeInTheDocument();
  });

  it('keeps the session panel minimal while the countdown ticks', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));

    const controls = screen.getByRole('dialog', { name: 'Focus session controls' });
    expect(controls).toHaveTextContent('59:59remaining');
    expect(controls).not.toHaveTextContent('Focus in progress');
    expect(controls).not.toHaveTextContent('Everything else can wait');
  });

  it('shows the polished completion summary after a deliberate exit', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'End focus early' }));
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Press and hold for ten seconds to end session' }),
    );
    act(() => vi.advanceTimersByTime(10_100));

    expect(screen.getByRole('heading', { name: 'That was time well spent.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start another' })).toBeVisible();
  });
});
