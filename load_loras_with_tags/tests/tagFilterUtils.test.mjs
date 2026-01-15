import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { getTagVisibility, isTagMatch, getTopNVisibility } from '../../web/loadLorasWithTags/js/tagFilterUtils.js';

describe('tagFilterUtils', () => {
  it('matches tags by query', () => {
    assert.equal(isTagMatch('Cat', 'ca'), true);
    assert.equal(isTagMatch('Cat', 'CAT'), true);
    assert.equal(isTagMatch('Cat', 'dog'), false);
    assert.equal(isTagMatch('Cat', ''), true);
    assert.equal(isTagMatch('', 'a'), false);
  });

  it('filters visibility by query', () => {
    assert.deepEqual(getTagVisibility(['cat', 'dog'], 'ca'), [true, false]);
    assert.deepEqual(getTagVisibility(['cat', 'dog'], 'ct'), [true, false]);
    assert.deepEqual(getTagVisibility(['cat', 'dog'], ''), [true, true]);
  });

  it('computes top N visibility', () => {
    const tags = ['a', 'b', 'c', 'd'];
    const frequencies = { a: 10, b: 50, c: 30, d: 20 };

    assert.deepEqual(getTopNVisibility(tags, frequencies, 0), [true, true, true, true]);
    assert.deepEqual(getTopNVisibility(tags, frequencies, 1), [false, true, false, false]);
    assert.deepEqual(getTopNVisibility(tags, frequencies, 2), [false, true, true, false]);
    assert.deepEqual(getTopNVisibility(tags, frequencies, 3), [false, true, true, true]);
    assert.deepEqual(getTopNVisibility(tags, frequencies, 10), [true, true, true, true]);
    assert.deepEqual(getTopNVisibility(tags, {}, 2), [true, true, true, true]);
    assert.deepEqual(getTopNVisibility(tags, null, 2), [true, true, true, true]);
    assert.deepEqual(getTopNVisibility([], frequencies, 2), []);

    const sameFreqTags = ['x', 'y', 'z'];
    const sameFreq = { x: 10, y: 10, z: 10 };
    assert.deepEqual(getTopNVisibility(sameFreqTags, sameFreq, 2), [true, true, false]);
  });
});
