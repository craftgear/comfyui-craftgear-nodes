import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  buildTagDisplaySegments,
  computeDisplayHeight,
  defaultDisplayHeight,
  findInputIndex,
  formatDisabledTagLabel,
  persistInputText,
  readPersistedInputText,
  parseExcludedTags,
  shouldHandleClick,
  shouldForwardWheelToCanvas,
  splitTags,
  toggleTag,
} from '../../web/tag_toggle_text/js/tagToggleTextUtils.js';

describe('tagToggleTextUtils', () => {
  it('splits tags by comma', () => {
    assert.deepEqual(splitTags('a, b, , c'), ['a', 'b', 'c']);
    assert.deepEqual(splitTags(null), []);
  });

  it('parses excluded tags from json or csv', () => {
    assert.deepEqual(parseExcludedTags('["x", "y"]'), ['x', 'y']);
    assert.deepEqual(parseExcludedTags('x, y'), ['x', 'y']);
    assert.deepEqual(parseExcludedTags([' a ', '']), ['a']);
    assert.deepEqual(parseExcludedTags('{bad json'), ['{bad json']);
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

  it('builds an empty segment when no tags exist', () => {
    const segments = buildTagDisplaySegments({ tags: [], excluded: [] });
    assert.deepEqual(segments, [{ type: 'empty', text: '(no tags)' }]);
  });

  it('builds tag and separator segments with excluded flags', () => {
    const segments = buildTagDisplaySegments({
      tags: ['a', 'b'],
      excluded: ['b'],
    });
    assert.deepEqual(segments, [
      { type: 'tag', text: 'a', excluded: false },
      { type: 'separator', text: ', ' },
      { type: 'tag', text: 'b', excluded: true },
    ]);
  });

  it('formats disabled tag label only when excluded tags exist in display list', () => {
    assert.equal(
      formatDisabledTagLabel({ tags: ['a', 'b'], excluded: [] }),
      null,
    );
    assert.equal(
      formatDisabledTagLabel({ tags: ['a', 'b'], excluded: ['b'] }),
      '1 tags are disabled',
    );
    assert.equal(
      formatDisabledTagLabel({ tags: [], excluded: ['x'] }),
      null,
    );
    assert.equal(
      formatDisabledTagLabel({ tags: ['a', 'a'], excluded: ['a'] }),
      '1 tags are disabled',
    );
  });

  it('exposes the default display height', () => {
    assert.equal(defaultDisplayHeight, 100);
  });

  it('uses fallback height when node height is missing', () => {
    const height = computeDisplayHeight({
      nodeHeight: null,
      titleHeight: 20,
      fallbackHeight: defaultDisplayHeight,
      extraPadding: 6,
    });
    assert.equal(height, defaultDisplayHeight);
  });

  it('uses fallback height when computed height is smaller', () => {
    const height = computeDisplayHeight({
      nodeHeight: 100,
      titleHeight: 20,
      fallbackHeight: defaultDisplayHeight,
      extraPadding: 6,
    });
    assert.equal(height, defaultDisplayHeight);
  });

  it('computes display height from node height', () => {
    const height = computeDisplayHeight({
      nodeHeight: 200,
      titleHeight: 20,
      fallbackHeight: defaultDisplayHeight,
      extraPadding: 6,
    });
    assert.equal(height, 174);
  });

  it('finds input index by name', () => {
    const inputs = [{ name: 'a' }, { name: 'excluded_tags' }, { name: 'b' }];
    assert.equal(findInputIndex(inputs, 'excluded_tags'), 1);
    assert.equal(findInputIndex(inputs, 'missing'), -1);
    assert.equal(findInputIndex(null, 'a'), -1);
  });

  it('stores input text in properties', () => {
    const target = {};
    persistInputText(target, 'a, b');
    assert.deepEqual(target.properties, { tagToggleInputText: 'a, b' });
    const untouched = { properties: {} };
    persistInputText(untouched, 123);
    assert.deepEqual(untouched.properties, {});
  });

  it('reads input text from properties', () => {
    const value = readPersistedInputText({
      properties: { tagToggleInputText: 'x, y' },
    });
    assert.equal(value, 'x, y');
  });

  it('returns null when persisted input is missing', () => {
    assert.equal(readPersistedInputText({}), null);
  });

  it('decides when to forward wheel events to the canvas', () => {
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: 1,
        scrollTop: 0,
        scrollHeight: 100,
        clientHeight: 100,
      }),
      true,
    );
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: 1,
        scrollTop: 0,
        scrollHeight: 200,
        clientHeight: 100,
      }),
      false,
    );
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: -1,
        scrollTop: 0,
        scrollHeight: 200,
        clientHeight: 100,
      }),
      true,
    );
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: 1,
        scrollTop: 100,
        scrollHeight: 200,
        clientHeight: 100,
      }),
      true,
    );
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: 0,
        scrollTop: 0,
        scrollHeight: 100,
        clientHeight: 100,
      }),
      false,
    );
    assert.equal(
      shouldForwardWheelToCanvas({
        deltaY: 5,
        scrollTop: 50,
        scrollHeight: 80,
        clientHeight: 100,
      }),
      true,
    );
  });
});
