import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  normalizeSelectionValue,
  resolveTagSelection,
  shouldAutoSelectInfinityTagsOnly,
} from '../../web/loadLorasWithTags/js/selectionValueUtils.js';

describe('normalizeSelectionValue', () => {
  it('normalizes selection values', () => {
    assert.equal(normalizeSelectionValue(null), '');
    assert.equal(normalizeSelectionValue(undefined), '');
    assert.equal(normalizeSelectionValue('["a"]'), '["a"]');
    assert.equal(normalizeSelectionValue(0), '0');
  });
});

describe('resolveTagSelection', () => {
  it('returns only infinity tags when auto select is enabled', () => {
    const triggers = ['alpha', 'beta', 'gamma'];
    const frequencies = { alpha: 3, beta: Infinity, gamma: 'Infinity' };
    const selected = resolveTagSelection({
      selectionText: '["alpha"]',
      triggers,
      frequencies,
      autoSelectInfinityWordsOnly: true,
    });
    assert.deepEqual([...selected], ['beta', 'gamma']);
  });

  it('falls back to selection text when auto select is disabled', () => {
    const triggers = ['alpha', 'beta'];
    const selected = resolveTagSelection({
      selectionText: '["beta"]',
      triggers,
      frequencies: { alpha: Infinity, beta: Infinity },
      autoSelectInfinityWordsOnly: false,
    });
    assert.deepEqual([...selected], ['beta']);
  });

  it('defaults to all triggers when selection text is empty', () => {
    const triggers = ['alpha', 'beta'];
    const selected = resolveTagSelection({
      selectionText: '',
      triggers,
      frequencies: { alpha: 1, beta: 2 },
      autoSelectInfinityWordsOnly: false,
    });
    assert.deepEqual([...selected], ['alpha', 'beta']);
  });

  it('returns empty when selection text is empty and emptySelectionAsNone is true', () => {
    const triggers = ['alpha', 'beta'];
    const selected = resolveTagSelection({
      selectionText: '',
      triggers,
      frequencies: { alpha: 1, beta: 2 },
      autoSelectInfinityWordsOnly: false,
      emptySelectionAsNone: true,
    });
    assert.deepEqual([...selected], []);
  });
});

describe('shouldAutoSelectInfinityTagsOnly', () => {
  it('returns true only when both flags are true', () => {
    assert.equal(shouldAutoSelectInfinityTagsOnly(true, true), true);
    assert.equal(shouldAutoSelectInfinityTagsOnly(true, false), false);
    assert.equal(shouldAutoSelectInfinityTagsOnly(false, true), false);
    assert.equal(shouldAutoSelectInfinityTagsOnly(false, false), false);
  });
});
