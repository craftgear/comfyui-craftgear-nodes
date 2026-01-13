import assert from 'node:assert/strict';

import { ensureSelectionSerializable } from '../../web/load_lora_with_triggers/js/selectionSerializeUtils.js';

const widgetWithSerialize = {
  value: null,
  serializeValue() {
    return this.value.replace('a', 'b');
  },
};

ensureSelectionSerializable(widgetWithSerialize);
assert.equal(widgetWithSerialize.serializeValue(), '');

const widgetWithoutSerialize = { value: null };
ensureSelectionSerializable(widgetWithoutSerialize);
assert.equal(widgetWithoutSerialize.serializeValue(), '');

const looseSerialize = widgetWithSerialize.serializeValue;
assert.equal(looseSerialize(), '');
