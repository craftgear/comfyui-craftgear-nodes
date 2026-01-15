import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { stripLoraExtension } from '../../web/loadLorasWithTags/js/loraNameUtils.js';

describe('stripLoraExtension', () => {
  it('removes only the lora extension', () => {
    assert.equal(stripLoraExtension('foo.safetensors'), 'foo');
    assert.equal(stripLoraExtension('foo.bar.safetensors'), 'foo.bar');
    assert.equal(stripLoraExtension('dir/foo.safetensors'), 'dir/foo');
    assert.equal(stripLoraExtension('dir.with.dots/foo.safetensors'), 'dir.with.dots/foo');
    assert.equal(stripLoraExtension('dir\\foo.safetensors'), 'dir\\foo');
    assert.equal(stripLoraExtension('None'), 'None');
    assert.equal(stripLoraExtension('foo'), 'foo');
    assert.equal(stripLoraExtension('foo.'), 'foo.');
  });
});
