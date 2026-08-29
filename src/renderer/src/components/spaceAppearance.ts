import type { Space } from '../../../shared/data-model';

export type SpaceTone = 'amber' | 'ink' | 'rose' | 'crystal';

export function spaceTone(space: Space): SpaceTone {
  switch (space.accentColor.toLowerCase()) {
    case '#f0b84b':
      return 'amber';
    case '#20242c':
      return 'ink';
    case '#e45a68':
      return 'rose';
    default:
      return 'crystal';
  }
}
