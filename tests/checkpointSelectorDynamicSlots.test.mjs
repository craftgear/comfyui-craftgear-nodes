import { describe, expect, it } from 'vitest';

import { updateVisibleSlots } from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

const createSlot = (value = '') => {
  const ckptWidget = { value };
  const activeWidget = {};
  const rowWidget = { hidden: false };
  return { ckptWidget, activeWidget, rowWidget };
};

describe('CheckpointSelector dynamic slots', () => {
  it('keeps one extra empty slot visible', () => {
    const slots = [createSlot('filledA'), createSlot(''), createSlot('')];
    const state = { slots, node: {} };
    updateVisibleSlots(state);
    expect(slots[0].rowWidget.hidden).toBe(false);
    expect(slots[1].rowWidget.hidden).toBe(false);
    expect(slots[2].rowWidget.hidden).toBe(true);
  });

  it('shows next slot when previous becomes filled', () => {
    const slots = [createSlot('A'), createSlot('B'), createSlot('')];
    const state = { slots, node: {} };
    updateVisibleSlots(state);
    expect(slots.map((s) => s.rowWidget.hidden)).toEqual([false, false, false]);
  });
});
