import { describe, expect, it } from 'vitest';

import { resolveCheckpointLabel } from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

describe('CheckpointSelector placeholder label', () => {
  it('returns placeholder for empty', () => {
    expect(resolveCheckpointLabel('')).toBe('None');
    expect(resolveCheckpointLabel(null)).toBe('None');
    expect(resolveCheckpointLabel(undefined)).toBe('None');
  });

  it('returns text when provided', () => {
    expect(resolveCheckpointLabel('modelA')).toBe('modelA');
  });
});
