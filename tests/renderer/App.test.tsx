import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import type { LockInApi } from '../../src/shared/contracts';

describe('App shell', () => {
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

  it('renders the production shell and reads validated app information', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Production foundation ready.' })).toBeVisible();
    expect(await screen.findByText('LockIn 0.1.0')).toBeVisible();
  });
});
