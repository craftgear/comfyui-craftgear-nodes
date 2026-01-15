import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  parseExcludedTags,
  shouldHandleClick,
  splitTags,
  toggleTag,
} from '../../web/tag_toggle_text/js/tagToggleTextUtils.js';

describe('tagToggleTextUtils', () => {
  it('splits tags by comma', () => {
    assert.deepEqual(splitTags('a, b, , c'), ['a', 'b', 'c']);
  });

  it('parses excluded tags from json or csv', () => {
    assert.deepEqual(parseExcludedTags('["x", "y"]'), ['x', 'y']);
    assert.deepEqual(parseExcludedTags('x, y'), ['x', 'y']);
  });

  it('toggles tags on and off', () => {
    const once = toggleTag(['a'], 'b');
    assert.deepEqual(once, ['a', 'b']);
    const twice = toggleTag(once, 'b');
    assert.deepEqual(twice, ['a']);
  });

  it('handles click events once', () => {
    assert.equal(shouldHandleClick({ type: 'pointerdown' }), true);
    assert.equal(shouldHandleClick({ type: 'mousedown' }), true);
    assert.equal(shouldHandleClick({ type: 'click' }), true);
    assert.equal(shouldHandleClick({ type: 'pointerup' }), false);
    assert.equal(shouldHandleClick({ type: 'mouseup' }), false);
    assert.equal(shouldHandleClick({}), true);
  });
});
