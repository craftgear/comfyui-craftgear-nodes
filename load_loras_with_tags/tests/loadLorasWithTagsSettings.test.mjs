import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AUTO_SELECT_MISSING_LORA,
  DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
  DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
  DEFAULT_MIN_FREQUENCY,
  normalizeAutoSelectMissingLora,
  normalizeAutoSelectInfinityWordsOnly,
  normalizeLoraPreviewZoomScale,
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

describe('normalizeLoraPreviewZoomScale', () => {
  it('returns default when value is not a finite number', () => {
    expect(normalizeLoraPreviewZoomScale(undefined)).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeLoraPreviewZoomScale(null)).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeLoraPreviewZoomScale(Number.NaN)).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeLoraPreviewZoomScale('not-a-number')).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
  });

  it('returns default when value is less than 1', () => {
    expect(normalizeLoraPreviewZoomScale(0)).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeLoraPreviewZoomScale(-2)).toBe(
      DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
    );
  });

  it('returns the numeric value when valid', () => {
    expect(normalizeLoraPreviewZoomScale(1)).toBe(1);
    expect(normalizeLoraPreviewZoomScale(2.5)).toBe(2.5);
    expect(normalizeLoraPreviewZoomScale('3')).toBe(3);
  });
});
