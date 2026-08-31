// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { siteLoadFailureMessage } from '../../src/main/site-load-error';

describe('site load failure messaging', () => {
  it('distinguishes certificate, timeout, connection, and unknown failures', () => {
    expect(siteLoadFailureMessage(new Error('net::ERR_CERT_DATE_INVALID'))).toContain(
      'security certificate',
    );
    expect(siteLoadFailureMessage(new Error('net::ERR_TIMED_OUT'))).toContain('too long');
    expect(siteLoadFailureMessage(new Error('net::ERR_INTERNET_DISCONNECTED'))).toContain(
      'internet connection',
    );
    expect(siteLoadFailureMessage(new Error('unexpected failure'))).toBe(
      'The website could not be loaded. Try again in a moment.',
    );
    expect(siteLoadFailureMessage('unknown')).toBe(
      'The website could not be loaded. Try again in a moment.',
    );
  });
});
