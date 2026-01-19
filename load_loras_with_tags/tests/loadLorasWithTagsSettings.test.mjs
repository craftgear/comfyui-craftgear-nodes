import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AUTO_SELECT_MISSING_LORA,
  DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
  DEFAULT_MIN_FREQUENCY,
  normalizeAutoSelectMissingLora,
  normalizeAutoSelectInfinityWordsOnly,
  normalizeMinFrequency,
} from '../../web/loadLorasWithTags/js/loadLorasWithTagsSettings.js';

describe('normalizeMinFrequency', () => {
  it('returns default when value is not a finite number', () => {
    expect(normalizeMinFrequency(undefined)).toBe(DEFAULT_MIN_FREQUENCY);
    expect(normalizeMinFrequency(null)).toBe(DEFAULT_MIN_FREQUENCY);
    expect(normalizeMinFrequency(Number.NaN)).toBe(DEFAULT_MIN_FREQUENCY);
    expect(normalizeMinFrequency('not-a-number')).toBe(DEFAULT_MIN_FREQUENCY);
  });

  it('returns default when value is negative', () => {
    expect(normalizeMinFrequency(-1)).toBe(DEFAULT_MIN_FREQUENCY);
  });

  it('returns a floored non-negative value', () => {
    expect(normalizeMinFrequency(3.7)).toBe(3);
    expect(normalizeMinFrequency('5')).toBe(5);
  });
});

describe('normalizeAutoSelectMissingLora', () => {
  it('returns default when value is not a boolean true', () => {
    expect(normalizeAutoSelectMissingLora(undefined)).toBe(
      DEFAULT_AUTO_SELECT_MISSING_LORA,
    );
    expect(normalizeAutoSelectMissingLora(null)).toBe(
      DEFAULT_AUTO_SELECT_MISSING_LORA,
    );
    expect(normalizeAutoSelectMissingLora(false)).toBe(
      DEFAULT_AUTO_SELECT_MISSING_LORA,
    );
    expect(normalizeAutoSelectMissingLora('true')).toBe(
      DEFAULT_AUTO_SELECT_MISSING_LORA,
    );
  });

  it('returns true when value is boolean true', () => {
    expect(normalizeAutoSelectMissingLora(true)).toBe(true);
  });
});

describe('normalizeAutoSelectInfinityWordsOnly', () => {
  it('returns default when value is not a boolean true', () => {
    expect(normalizeAutoSelectInfinityWordsOnly(undefined)).toBe(
      DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
    );
    expect(normalizeAutoSelectInfinityWordsOnly(null)).toBe(
      DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
    );
    expect(normalizeAutoSelectInfinityWordsOnly(false)).toBe(
      DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
    );
    expect(normalizeAutoSelectInfinityWordsOnly('true')).toBe(
      DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
    );
  });

  it('returns true when value is boolean true', () => {
    expect(normalizeAutoSelectInfinityWordsOnly(true)).toBe(true);
  });
});
