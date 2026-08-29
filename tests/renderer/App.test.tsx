import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import type { LockInApi } from '../../src/shared/contracts';

describe('Phase 3 product flow', () => {
  afterEach(cleanup);

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

  it('walks from launcher to workspace and blocked navigation', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    expect(screen.getByRole('main')).toHaveClass('is-starting');
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));

    expect(screen.getByRole('heading', { name: 'ChatGPT is ready.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Preview blocked navigation' }));
    expect(screen.getByRole('heading', { name: 'This destination can wait.' })).toBeVisible();
  });

  it('uses a deliberate hold interaction for emergency exit', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open session controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'End focus early' }));

    expect(screen.getByRole('heading', { name: 'End this focus session?' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Press and hold for three seconds to end session' }),
    ).toBeVisible();
    expect(screen.queryByPlaceholderText('END MY SESSION')).not.toBeInTheDocument();
  });
});
