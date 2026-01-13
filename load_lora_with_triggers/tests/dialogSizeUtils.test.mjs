import assert from 'node:assert/strict';

import { getLockedHeight } from '../../web/load_lora_with_triggers/js/dialogSizeUtils.js';

assert.equal(getLockedHeight(400, 500), 400);
assert.equal(getLockedHeight(600, 500), 500);
assert.equal(getLockedHeight(0, 500), null);
assert.equal(getLockedHeight(100, 0), 100);
