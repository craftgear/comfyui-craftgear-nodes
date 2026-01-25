import { describe, expect, it } from 'vitest';

import {
  enforceSingleActiveSlot,
  resolveActiveSlotIndex,
  resolveRowBackground,
  resolveCheckpointRowLabelFont,
  resolveCheckpointDialogItemBackground,
  getCheckpointHighlightSegments,
  normalizeCheckpointDialogFilterValue,
} from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

describe('CheckpointSelector radio behavior', () => {
  it('enforces single active slot', () => {
    const slots = [
      { active: true },
      { active: true },
      { active: false },
    ];
    const next = enforceSingleActiveSlot(slots, 1);
    expect(next.map((slot) => slot.active)).toEqual([false, true, false]);
  });

  it('resolves active slot index with fallback to first', () => {
    expect(resolveActiveSlotIndex([])).toBe(0);
    expect(resolveActiveSlotIndex([{ active: false }, { active: true }])).toBe(1);
    expect(resolveActiveSlotIndex([{ active: false }, { active: false }])).toBe(0);
  });
});

describe('CheckpointSelector row styling', () => {
  it('highlights active row', () => {
    expect(resolveRowBackground({ active: true, hover: false })).toBe('#2f4363');
  });

  it('uses hover color when hovered but not active', () => {
    expect(resolveRowBackground({ active: false, hover: true })).toBe('#2b2b2b');
  });

  it('uses bold font when active', () => {
    expect(resolveCheckpointRowLabelFont(true)).toContain('bold');
    expect(resolveCheckpointRowLabelFont(false)).not.toContain('bold');
  });
});

describe('CheckpointSelector dialog highlight', () => {
  it('normalizes filter values', () => {
    expect(normalizeCheckpointDialogFilterValue('')).toBe('');
    expect(normalizeCheckpointDialogFilterValue('  a ')).toBe('a');
  });

  it('highlights matches', () => {
    expect(getCheckpointHighlightSegments('Alpha', 'Al')).toEqual([
      { text: 'Al', isMatch: true },
      { text: 'pha', isMatch: false },
    ]);
  });
});

describe('CheckpointSelector dialog background', () => {
  it('returns selected and hover backgrounds', () => {
    expect(resolveCheckpointDialogItemBackground(true, false)).toBe('#424242');
    expect(resolveCheckpointDialogItemBackground(false, true)).toBe('#2a2a2a');
  });
});
