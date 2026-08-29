import type { Space } from './data-model';

export interface NormalizedWebsite {
  readonly startUrl: string;
  readonly hostname: string;
}

export function normalizeWebsiteUrl(input: string): NormalizedWebsite {
  const value = input.trim();
  if (!value) throw new Error('Enter a website address');

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    throw new Error('Enter a valid website address');
  }

  if (parsed.protocol !== 'https:') throw new Error('Only secure HTTPS websites are allowed');
  if (parsed.username || parsed.password) throw new Error('Website credentials are not allowed');

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  const validLabels = labels.every(
    (label) => /^(?!-)[a-z\d-]{1,63}(?<!-)$/.test(label) && label.length > 0,
  );

  if (
    hostname.length > 253 ||
    hostname === 'localhost' ||
    isIpAddress ||
    labels.length < 2 ||
    !validLabels ||
    /^\d+$/.test(labels.at(-1) ?? '')
  ) {
    throw new Error('Enter a public website hostname');
  }

  parsed.hostname = hostname;
  parsed.hash = '';

  return { startUrl: parsed.toString(), hostname };
}

export function hostnameMatches(
  allowedHostname: string,
  candidateHostname: string,
  includeSubdomains: boolean,
): boolean {
  const allowed = allowedHostname.toLowerCase().replace(/\.$/, '');
  const candidate = candidateHostname.toLowerCase().replace(/\.$/, '');
  return candidate === allowed || (includeSubdomains && candidate.endsWith(`.${allowed}`));
}

export function hostRulesOverlap(first: Space, second: Space): boolean {
  return (
    hostnameMatches(first.hostname, second.hostname, first.includeSubdomains) ||
    hostnameMatches(second.hostname, first.hostname, second.includeSubdomains)
  );
}

export function displayNameFromHostname(hostname: string): string {
  const firstLabel = hostname.replace(/^www\./, '').split('.')[0] ?? hostname;
  return firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1);
}
