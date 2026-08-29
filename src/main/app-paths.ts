import { app } from 'electron';

export interface AppPaths {
  readonly userData: string;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath('userData');

  return Object.freeze({ userData });
}
