import assert from 'node:assert/strict';

import {
  getTagVisibility,
  isTagMatch,
  getTopNVisibility,
} from '../../web/load_lora_with_triggers/js/tagFilterUtils.js';

assert.equal(isTagMatch('Cat', 'ca'), true);
assert.equal(isTagMatch('Cat', 'CAT'), true);
assert.equal(isTagMatch('Cat', 'dog'), false);
assert.equal(isTagMatch('Cat', ''), true);
assert.equal(isTagMatch('', 'a'), false);

assert.deepEqual(getTagVisibility(['cat', 'dog'], 'ca'), [true, false]);
assert.deepEqual(getTagVisibility(['cat', 'dog'], ''), [true, true]);

// getTopNVisibility: 上位N件のタグのみを表示
const tags = ['a', 'b', 'c', 'd'];
const frequencies = { a: 10, b: 50, c: 30, d: 20 };

// topN=0はすべて表示
assert.deepEqual(getTopNVisibility(tags, frequencies, 0), [true, true, true, true]);

// topN=1は最も頻度の高いタグのみ表示 (b: 50)
assert.deepEqual(getTopNVisibility(tags, frequencies, 1), [false, true, false, false]);

// topN=2は上位2件を表示 (b: 50, c: 30)
assert.deepEqual(getTopNVisibility(tags, frequencies, 2), [false, true, true, false]);

// topN=3は上位3件を表示 (b: 50, c: 30, d: 20)
assert.deepEqual(getTopNVisibility(tags, frequencies, 3), [false, true, true, true]);

// topNがタグ数以上の場合はすべて表示
assert.deepEqual(getTopNVisibility(tags, frequencies, 10), [true, true, true, true]);

// frequenciesが空の場合はすべて表示
assert.deepEqual(getTopNVisibility(tags, {}, 2), [true, true, true, true]);

// frequenciesがnullの場合はすべて表示
assert.deepEqual(getTopNVisibility(tags, null, 2), [true, true, true, true]);

// tagsが空の場合は空配列
assert.deepEqual(getTopNVisibility([], frequencies, 2), []);

// 同じ頻度のタグがある場合は元の順序を維持
const sameFreqTags = ['x', 'y', 'z'];
const sameFreq = { x: 10, y: 10, z: 10 };
assert.deepEqual(getTopNVisibility(sameFreqTags, sameFreq, 2), [true, true, false]);
