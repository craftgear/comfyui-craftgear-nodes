import assert from 'node:assert/strict';

import { getResizedNodeSize } from '../../web/load_lora_with_triggers/js/nodeSizeUtils.js';

const makeNode = (computeSize, size) => ({
  computeSize,
  size,
});

const node = makeNode(() => [120, 80], [240, 60]);
assert.deepEqual(getResizedNodeSize(node, { keepWidth: true }), [240, 80]);
assert.deepEqual(getResizedNodeSize(node, { keepWidth: false }), [120, 80]);

const nodeWithoutWidth = makeNode(() => [100, 50], undefined);
assert.deepEqual(getResizedNodeSize(nodeWithoutWidth, { keepWidth: true }), [100, 50]);

const invalidNode = makeNode(() => null, [200, 50]);
assert.equal(getResizedNodeSize(invalidNode, { keepWidth: true }), null);
