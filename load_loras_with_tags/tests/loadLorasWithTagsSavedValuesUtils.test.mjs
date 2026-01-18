import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  getSavedSlotValues,
  resolveSavedValuesStride,
} from '../../web/loadLorasWithTags/js/loadLorasWithTagsSavedValuesUtils.js';

describe('loadLorasWithTagsSavedValuesUtils', () => {
  it('detects stride 5', () => {
    const values = new Array(10).fill(0);
    assert.equal(resolveSavedValuesStride(values), 5);
  });

  it('extracts filter values for stride 5', () => {
    const values = [
      'lora_a',
      1,
      true,
      'sel_a',
      'filter_a',
      'lora_b',
      2,
      false,
      'sel_b',
      'filter_b',
    ];
    const entry = getSavedSlotValues(values, 1);
    assert.ok(entry);
    assert.equal(entry.loraValue, 'lora_b');
    assert.equal(entry.selectionValue, 'sel_b');
    assert.equal(entry.filterValue, 'filter_b');
  });

  it('extracts selection values for stride 4', () => {
    const values = ['lora_a', 1, true, 'sel_a', 'lora_b', 2, false, 'sel_b'];
    const entry = getSavedSlotValues(values, 0);
    assert.ok(entry);
    assert.equal(entry.selectionValue, 'sel_a');
    assert.equal(entry.filterValue, undefined);
  });

  it('supports overriding the stride', () => {
    const values = ['lora_a', 1, true, 'sel_a', 'lora_b', 2, false, 'sel_b'];
    const entry = getSavedSlotValues(values, 1, 4);
    assert.ok(entry);
    assert.equal(entry.loraValue, 'lora_b');
  });
});
