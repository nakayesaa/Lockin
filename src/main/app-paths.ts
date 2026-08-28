import { app } from 'electron';
import { join } from 'node:path';

export interface AppPaths {
  readonly userData: string;
  readonly logs: string;
  readonly browserProfile: string;
  readonly icons: string;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath('userData');

  return Object.freeze({
    userData,
    logs: join(userData, 'logs'),
    browserProfile: join(userData, 'browser-profile'),
    icons: join(userData, 'icons'),
  });
}
