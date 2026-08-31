import { app } from 'electron';

export interface AppPaths {
  readonly userData: string;
  readonly logs: string;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath('userData');
  const logs = app.getPath('logs');

  return Object.freeze({ userData, logs });
}
