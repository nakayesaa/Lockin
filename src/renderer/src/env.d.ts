/// <reference types="vite/client" />

import type { LockInApi } from '../../shared/contracts';

declare global {
  interface Window {
    readonly lockIn: LockInApi;
  }
}

export {};
