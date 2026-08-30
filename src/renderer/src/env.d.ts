/// <reference types="vite/client" />

import type { LockInApi } from '../../shared/contracts';

declare global {
  const __LOCKIN_UI_PREVIEW__: boolean;

  interface Window {
    readonly lockIn?: LockInApi;
  }
}

export {};
