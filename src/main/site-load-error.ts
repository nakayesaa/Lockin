function errorText(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const code = 'code' in error ? String(error.code) : '';
  return `${code} ${error.message}`.toUpperCase();
}

export function siteLoadFailureMessage(error: unknown): string {
  const text = errorText(error);
  if (text.includes('CERT_')) {
    return 'LockIn stopped this website because its security certificate is invalid.';
  }
  if (text.includes('TIMED_OUT')) {
    return 'The website took too long to respond. Try again in a moment.';
  }
  if (
    text.includes('INTERNET_DISCONNECTED') ||
    text.includes('NAME_NOT_RESOLVED') ||
    text.includes('CONNECTION_')
  ) {
    return 'The website could not connect. Check your internet connection.';
  }
  return 'The website could not be loaded. Try again in a moment.';
}
