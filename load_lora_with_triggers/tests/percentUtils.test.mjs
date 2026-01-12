import assert from 'node:assert/strict';

import {
  formatPercentLabel,
  normalizePercentValue,
} from '../../web/load_lora_with_triggers/js/percentUtils.js';

assert.equal(normalizePercentValue(0), 1);
assert.equal(normalizePercentValue(50), 50);
assert.equal(normalizePercentValue(101), 100);
assert.equal(normalizePercentValue('42'), 42);
assert.equal(normalizePercentValue('oops'), 100);
assert.equal(formatPercentLabel(7), '7%');
