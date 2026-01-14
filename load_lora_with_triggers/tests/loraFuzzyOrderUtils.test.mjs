import assert from 'node:assert/strict';

import { buildFuzzyReindexMap } from '../../web/load_lora_with_triggers/js/loraFuzzyOrderUtils.js';

assert.deepEqual(buildFuzzyReindexMap([]), {});
assert.deepEqual(buildFuzzyReindexMap([2, 5, 6, 3, 4]), {
	2: 0,
	3: 3,
	4: 4,
	5: 1,
	6: 2,
});
