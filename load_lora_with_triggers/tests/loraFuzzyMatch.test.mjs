import assert from 'node:assert/strict';

import { rankFuzzy, scoreFuzzy } from '../../web/load_lora_with_triggers/js/loraFuzzyMatch.js';

assert.equal(scoreFuzzy('abc', 'def'), Number.NEGATIVE_INFINITY);
assert.equal(scoreFuzzy('abc', 'a_x_b_x_c'), Number.NEGATIVE_INFINITY);
assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'abc_x'));

const ranked = rankFuzzy('abc', ['axbyc', 'abc', 'zzz', 'ab']);
assert.deepEqual(ranked, ['abc']);
