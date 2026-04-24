// Minimal structured logger. No dep — just JSON lines to stdout.

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, extra?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    svc: 'livedemo-browser',
    msg,
    ...(extra ?? {}),
  });
  // eslint-disable-next-line no-console
  console.log(line);
}

export const log = {
  debug: (m: string, e?: Record<string, unknown>) => emit('debug', m, e),
  info: (m: string, e?: Record<string, unknown>) => emit('info', m, e),
  warn: (m: string, e?: Record<string, unknown>) => emit('warn', m, e),
  error: (m: string, e?: Record<string, unknown>) => emit('error', m, e),
};
