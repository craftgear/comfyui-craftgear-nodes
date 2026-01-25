import { describe, expect, it } from 'vitest';

import {
    isToggleShortcut,
    toggleLineComment,
} from '../../web/commentable_multiline_text/js/commentableMultilineTextUtils.js';

describe('isToggleShortcut', () => {
    it('returns true for Ctrl+C', () => {
        expect(isToggleShortcut({ key: 'c', ctrlKey: true })).toBe(true);
    });

    it('returns true for Cmd+C', () => {
        expect(isToggleShortcut({ key: 'c', metaKey: true })).toBe(true);
    });

    it('returns false for other keys or modifiers', () => {
        expect(isToggleShortcut({ key: 'x', ctrlKey: true })).toBe(false);
        expect(isToggleShortcut({ key: 'c', altKey: true, ctrlKey: true })).toBe(false);
        expect(isToggleShortcut({ key: 'c', shiftKey: true, ctrlKey: true })).toBe(false);
        expect(isToggleShortcut({})).toBe(false);
    });
});

describe('toggleLineComment', () => {
    it('adds comment prefix to the current line', () => {
        const result = toggleLineComment('alpha\nbeta', 1);
        expect(result.text).toBe('# alpha\nbeta');
        expect(result.cursor).toBe(3);
    });

    it('removes comment prefix from the current line', () => {
        const result = toggleLineComment('# alpha\nbeta', 4);
        expect(result.text).toBe('alpha\nbeta');
        expect(result.cursor).toBe(2);
    });

    it('removes double slash comments while keeping indentation', () => {
        const result = toggleLineComment('  // alpha\nbeta', 6);
        expect(result.text).toBe('  alpha\nbeta');
        expect(result.cursor).toBe(3);
    });
});
