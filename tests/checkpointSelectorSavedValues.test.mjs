import { describe, expect, it } from 'vitest';

import {
  buildCheckpointSavedValues,
  resolveSavedCheckpointValue,
  resolveSavedStride,
} from '../web/checkpoint_selector/js/checkpointSelectorSavedValuesUtils.js';

const createSlot = (name, active) => ({
  ckptWidget: { value: name },
  activeWidget: { value: active },
});

describe('checkpoint selector saved values utils', () => {
  it('builds saved values as name and active pairs', () => {
    const values = buildCheckpointSavedValues([
      createSlot('modelA', true),
      createSlot('', false),
    ]);
    expect(values).toEqual(['modelA', true, '', false]);
  });

  it('resolves saved stride', () => {
    expect(resolveSavedStride([], 2)).toBe(0);
    expect(resolveSavedStride(['a', true, 'b', false], 2)).toBe(2);
    expect(resolveSavedStride(['a', 'b'], 2)).toBe(1);
    expect(resolveSavedStride(['a', 'b', 'c'], 2)).toBe(0);
  });

  it('maps numeric saved value to option', () => {
    const options = ['', 'one', 'two'];
    expect(resolveSavedCheckpointValue(0, options)).toBe('one');
    expect(resolveSavedCheckpointValue(1, options)).toBe('two');
    expect(resolveSavedCheckpointValue(2, options)).toBe('');
  });

  it('keeps string saved value', () => {
    const options = ['', 'one'];
    expect(resolveSavedCheckpointValue('custom', options)).toBe('custom');
  });

  it('falls back to empty for null', () => {
    const options = ['', 'one'];
    expect(resolveSavedCheckpointValue(null, options)).toBe('');
  });
});
