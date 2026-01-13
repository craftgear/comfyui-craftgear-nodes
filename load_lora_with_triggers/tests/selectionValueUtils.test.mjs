import assert from 'node:assert/strict';

import {
  normalizeSelectionValue,
} from '../../web/load_lora_with_triggers/js/selectionValueUtils.js';

assert.equal(normalizeSelectionValue(null), '');
assert.equal(normalizeSelectionValue(undefined), '');
assert.equal(normalizeSelectionValue('["a"]'), '["a"]');
assert.equal(normalizeSelectionValue(0), '0');
