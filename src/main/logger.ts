import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogDetails = Readonly<Record<string, string | number | boolean | null>>;

const maxLogBytes = 1_000_000;
let logFilePath: string | null = null;

export interface Logger {
  debug(message: string, details?: LogDetails): void;
  info(message: string, details?: LogDetails): void;
  warn(message: string, details?: LogDetails): void;
  error(message: string, details?: LogDetails): void;
}

function write(level: LogLevel, scope: string, message: string, details?: LogDetails): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(details ? { details } : {}),
  };
  const output = JSON.stringify(entry);

  if (logFilePath) {
    void appendFile(logFilePath, `${output}\n`, 'utf8').catch((error: unknown) => {
      console.error(
        `Could not write LockIn log: ${error instanceof Error ? error.message : error}`,
      );
    });
  }

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

export async function initializeFileLogging(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const current = join(directory, 'lockin.log');
  const previous = join(directory, 'lockin.previous.log');
  const details = await stat(current).catch(() => null);

  if (details && details.size >= maxLogBytes) {
    await rm(previous, { force: true });
    await rename(current, previous);
  }

  logFilePath = current;
  return current;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, details) => write('debug', scope, message, details),
    info: (message, details) => write('info', scope, message, details),
    warn: (message, details) => write('warn', scope, message, details),
    error: (message, details) => write('error', scope, message, details),
  };
}
