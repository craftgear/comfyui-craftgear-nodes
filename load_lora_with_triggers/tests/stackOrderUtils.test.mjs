import assert from 'node:assert/strict';

import {
  compactSlotValues,
  isFilledName,
} from '../../web/load_lora_with_triggers/js/stackOrderUtils.js';

assert.equal(isFilledName('A'), true);
assert.equal(isFilledName('None'), false);
assert.equal(isFilledName('[None]'), false);
assert.equal(isFilledName(''), false);

const values = [
  { loraName: 'A', strength: 1, selection: '["a"]' },
  { loraName: 'None', strength: 0.5, selection: '[]' },
  { loraName: 'B', strength: 0.8, selection: '["b"]' },
];
const compacted = compactSlotValues(values, 0);
assert.deepEqual(compacted[0], values[0]);
assert.deepEqual(compacted[1], values[2]);
assert.equal(compacted[2].loraName, 'None');

const partial = compactSlotValues(values, 1);
assert.deepEqual(partial[0], values[0]);
assert.deepEqual(partial[1], values[2]);
assert.equal(partial[2].loraName, 'None');
