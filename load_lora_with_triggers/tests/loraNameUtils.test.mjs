import assert from 'node:assert/strict';

import { stripLoraExtension } from '../../web/load_lora_with_triggers/js/loraNameUtils.js';

assert.equal(stripLoraExtension('foo.safetensors'), 'foo');
assert.equal(stripLoraExtension('foo.bar.safetensors'), 'foo.bar');
assert.equal(stripLoraExtension('dir/foo.safetensors'), 'dir/foo');
assert.equal(stripLoraExtension('dir.with.dots/foo.safetensors'), 'dir.with.dots/foo');
assert.equal(stripLoraExtension('dir\\foo.safetensors'), 'dir\\foo');
assert.equal(stripLoraExtension('None'), 'None');
assert.equal(stripLoraExtension('foo'), 'foo');
assert.equal(stripLoraExtension('foo.'), 'foo.');
