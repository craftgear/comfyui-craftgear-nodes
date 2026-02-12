import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  normalizeSelectionValue,
  parseSelection,
  resolveSelectionValueOnLoraChange,
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

  it('falls back to all triggers on malformed JSON or non-array', () => {
    const triggers = ['alpha', 'beta'];
    const malformed = resolveTagSelection({
      selectionText: '[invalid',
      triggers,
      autoSelectInfinityWordsOnly: false,
    });
    assert.deepEqual([...malformed], ['alpha', 'beta']);

    const notArray = resolveTagSelection({
      selectionText: '{"foo":1}',
      triggers,
      autoSelectInfinityWordsOnly: false,
    });
    assert.deepEqual([...notArray], ['alpha', 'beta']);
  });

  it('returns empty set when triggers are not provided', () => {
    const selected = resolveTagSelection({
      selectionText: '["a"]',
      triggers: null,
      autoSelectInfinityWordsOnly: false,
    });
    assert.deepEqual([...selected], []);
  });

  it('parses selections directly and handles invalid formats', () => {
    const parsed = parseSelection('["a","b"]', ['a', 'b']);
    assert.deepEqual([...parsed], ['a', 'b']);
    const fallback = parseSelection('{"foo":1}', ['a']);
    assert.deepEqual([...fallback], ['a']);
    const none = parseSelection('["a"]', null);
    assert.deepEqual([...none], []);
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

describe('resolveSelectionValueOnLoraChange', () => {
  it('returns empty selection when auto select is disabled', () => {
    const value = resolveSelectionValueOnLoraChange({
      autoSelectInfinityWordsOnly: false,
      triggers: ['alpha', 'beta'],
      frequencies: { alpha: Infinity, beta: 1 },
    });

    assert.equal(value, '[]');
  });

  it('returns only infinity-frequency tags when auto select is enabled', () => {
    const value = resolveSelectionValueOnLoraChange({
      autoSelectInfinityWordsOnly: true,
      triggers: ['alpha', 'beta', 'gamma'],
      frequencies: { alpha: 2, beta: Infinity, gamma: 'Infinity' },
    });

    assert.equal(value, '["beta","gamma"]');
  });

  it('returns empty selection when infinity tags do not exist', () => {
    const value = resolveSelectionValueOnLoraChange({
      autoSelectInfinityWordsOnly: true,
      triggers: ['alpha', 'beta'],
      frequencies: { alpha: 2, beta: 1 },
    });

    assert.equal(value, '[]');
  });
});
