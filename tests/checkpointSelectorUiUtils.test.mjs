import { describe, expect, it } from 'vitest';

import {
  normalizeSelectedSlotIndex,
  resolveVisibleSlotCount,
} from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

describe('resolveVisibleSlotCount', () => {
  it('shows one slot when all are empty', () => {
    expect(resolveVisibleSlotCount(['None', 'None'], 20)).toBe(1);
  });

  it('adds one extra slot after the last filled value', () => {
    expect(resolveVisibleSlotCount(['None', 'A.safetensors', 'None'], 20)).toBe(3);
  });

  it('caps at the max slot count', () => {
    const values = Array.from({ length: 25 }, () => 'A.safetensors');
    expect(resolveVisibleSlotCount(values, 20)).toBe(20);
  });
});

describe('normalizeSelectedSlotIndex', () => {
  it('keeps selection within range', () => {
    expect(normalizeSelectedSlotIndex(5, 3, ['None', 'None', 'None'])).toBe(1);
  });

  it('falls back to first filled slot', () => {
    expect(normalizeSelectedSlotIndex(null, 5, ['None', 'B.safetensors'])).toBe(2);
  });
});
