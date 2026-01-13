import assert from 'node:assert/strict';

import {
  getTagVisibility,
  isTagMatch,
} from '../../web/load_lora_with_triggers/js/tagFilterUtils.js';

assert.equal(isTagMatch('Cat', 'ca'), true);
assert.equal(isTagMatch('Cat', 'CAT'), true);
assert.equal(isTagMatch('Cat', 'dog'), false);
assert.equal(isTagMatch('Cat', ''), true);
assert.equal(isTagMatch('', 'a'), false);

assert.deepEqual(getTagVisibility(['cat', 'dog'], 'ca'), [true, false]);
assert.deepEqual(getTagVisibility(['cat', 'dog'], ''), [true, true]);
