export function errorMessage(
  error: unknown,
  fallback = 'The request could not be completed.',
): string {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}
