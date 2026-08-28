import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/contracts';

type AppScreen = 'home';

export function App() {
  const [screen] = useState<AppScreen>('home');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    window.lockIn
      .getAppInfo()
      .then((info) => {
        if (active) setAppInfo(info);
      })
      .catch(() => {
        if (active) setError('The secure app connection is unavailable.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-8 text-stone-900">
      <section className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-7 rounded-full border-[7px] border-stone-900" />
          <p className="text-sm font-semibold tracking-[0.18em] uppercase">LockIn</p>
        </div>
        <h1 className="mt-12 text-4xl font-semibold tracking-tight">
          Production foundation ready.
        </h1>
        <p className="mt-4 max-w-lg leading-7 text-stone-600">
          The secure Electron, React, and TypeScript shell is running. The complete visual system
          arrives in Phase 3.
        </p>
        <dl className="mt-10 grid gap-3 rounded-2xl bg-stone-50 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Screen</dt>
            <dd className="mt-1 font-medium">{screen}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Runtime</dt>
            <dd className="mt-1 font-medium">
              {appInfo ? `${appInfo.name} ${appInfo.version}` : 'Connecting…'}
            </dd>
          </div>
        </dl>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}
