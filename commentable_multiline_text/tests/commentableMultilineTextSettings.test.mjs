import { describe, expect, it } from 'vitest';

import {
    DEFAULT_FONT_SIZE,
    normalizeFontSize,
} from '../../web/commentable_multiline_text/js/commentableMultilineTextSettings.js';

describe('normalizeFontSize', () => {
    it('returns default when value is not a finite number', () => {
        expect(normalizeFontSize(undefined)).toBe(DEFAULT_FONT_SIZE);
        expect(normalizeFontSize(null)).toBe(DEFAULT_FONT_SIZE);
        expect(normalizeFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE);
        expect(normalizeFontSize('not-a-number')).toBe(DEFAULT_FONT_SIZE);
    });

    it('returns default when value is zero or negative', () => {
        expect(normalizeFontSize(0)).toBe(DEFAULT_FONT_SIZE);
        expect(normalizeFontSize(-5)).toBe(DEFAULT_FONT_SIZE);
    });

    it('returns the value when value is positive', () => {
        expect(normalizeFontSize(12)).toBe(12);
        expect(normalizeFontSize('18')).toBe(18);
    });
});
