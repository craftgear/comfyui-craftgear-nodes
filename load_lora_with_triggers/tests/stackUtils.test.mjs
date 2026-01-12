import assert from 'node:assert/strict';

import { normalizeSavedValues } from '../../web/load_lora_with_triggers/js/stackUtils.js';

const maxStack = 2;
const legacyValues = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
assert.deepEqual(normalizeSavedValues(legacyValues, maxStack), ['a', 'b', 'e', 'f', 'g', 'j']);

const leadingExtra = ['x', 'a', 'b', 'c', 'd', 'e'];
assert.deepEqual(normalizeSavedValues(leadingExtra, maxStack), ['a', 'b', 'c', 'd', 'e']);

const legacyWithLeading = ['x', ...legacyValues];
assert.deepEqual(normalizeSavedValues(legacyWithLeading, maxStack), ['a', 'b', 'e', 'f', 'g', 'j']);

const extraValues = ['x', 'y', 'z', '1', '2', '3', '4'];
assert.deepEqual(normalizeSavedValues(extraValues, maxStack), ['x', 'y', 'z', '1', '2', '3']);

const shortValues = ['only', 'two'];
assert.deepEqual(normalizeSavedValues(shortValues, maxStack), ['only', 'two']);

assert.equal(normalizeSavedValues(null, maxStack), null);
