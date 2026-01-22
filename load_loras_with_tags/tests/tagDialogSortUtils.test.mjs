import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  resolveTagDialogSortValue,
  resolveTagDialogTopNLabel,
  sortTagDialogItems,
} from '../../web/loadLorasWithTags/js/loadLorasWithTagsUiUtils.js';

describe('sortTagDialogItems', () => {
  it('sorts by frequency by default', () => {
    const items = [
      { trigger: 'beta', checked: false },
      { trigger: 'alpha', checked: true },
      { trigger: 'gamma', checked: false },
    ];
    const frequencies = { alpha: 5, beta: 10, gamma: 1 };
    const sorted = sortTagDialogItems(items, undefined, frequencies);

    assert.deepEqual(
      sorted.map((item) => item.trigger),
      ['beta', 'alpha', 'gamma'],
    );
  });

  it('sorts by name', () => {
    const items = [
      { trigger: 'beta', checked: false },
      { trigger: 'alpha', checked: true },
      { trigger: 'gamma', checked: false },
    ];
    const sorted = sortTagDialogItems(items, 'name', {});

    assert.deepEqual(
      sorted.map((item) => item.trigger),
      ['alpha', 'beta', 'gamma'],
    );
  });

  it('sorts by checked first and keeps order for ties', () => {
    const items = [
      { trigger: 'beta', checked: false },
      { trigger: 'alpha', checked: true },
      { trigger: 'gamma', checked: false },
    ];
    const sorted = sortTagDialogItems(items, 'checked', {});

    assert.deepEqual(
      sorted.map((item) => item.trigger),
      ['alpha', 'beta', 'gamma'],
    );
  });
});

describe('resolveTagDialogSortValue', () => {
  it('falls back to frequency for unknown values', () => {
    assert.equal(resolveTagDialogSortValue(undefined), 'frequency');
    assert.equal(resolveTagDialogSortValue('unknown'), 'frequency');
  });

  it('accepts known values', () => {
    assert.equal(resolveTagDialogSortValue('frequency'), 'frequency');
    assert.equal(resolveTagDialogSortValue('name'), 'name');
    assert.equal(resolveTagDialogSortValue('checked'), 'checked');
  });
});

describe('resolveTagDialogTopNLabel', () => {
  it('builds the label with the given value', () => {
    assert.equal(resolveTagDialogTopNLabel(3), 'Show top 3 tags');
  });
});
