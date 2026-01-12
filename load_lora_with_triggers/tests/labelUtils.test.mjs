import assert from 'node:assert/strict';

import { formatLabel } from '../../web/load_lora_with_triggers/js/labelUtils.js';

assert.equal(formatLabel('lora_name_1'), 'lora name 1');
assert.equal(formatLabel('trigger_selection'), 'trigger selection');
assert.equal(formatLabel('select_trigger_1'), 'select trigger 1');
assert.equal(formatLabel('lora strength'), 'lora strength');
