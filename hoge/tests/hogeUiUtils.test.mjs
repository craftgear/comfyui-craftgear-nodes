import assert from 'node:assert/strict';

import {
  calculateSliderValue,
  computeButtonRect,
  computeSliderRatio,
  moveIndex,
  resolveComboLabel,
  normalizeStrengthOptions,
  normalizeOptions,
  resolveOption,
} from '../../web/hoge/js/hogeUiUtils.js';

const options = ['None', 'a.safetensors', 'b.safetensors'];

assert.deepEqual(resolveOption(2, options), { index: 2, label: 'b.safetensors' });
assert.deepEqual(resolveOption('a.safetensors', options), { index: 1, label: 'a.safetensors' });
assert.deepEqual(resolveOption({ name: 'b.safetensors' }, options), {
  index: 2,
  label: 'b.safetensors',
});
assert.deepEqual(resolveOption('missing', options), { index: 0, label: 'missing' });

assert.equal(moveIndex(0, 1, 3), 1);
assert.equal(moveIndex(2, 1, 3), 0);
assert.equal(moveIndex(0, -1, 3), 2);
assert.equal(moveIndex(0, 1, 0), -1);

assert.deepEqual(normalizeOptions(['a', 'b']), ['a', 'b']);
assert.deepEqual(normalizeOptions({ a: 'x', b: 'y' }), ['x', 'y']);
assert.deepEqual(normalizeOptions(null), []);

assert.deepEqual(normalizeStrengthOptions(null), { step: 0.1 });
assert.deepEqual(normalizeStrengthOptions({ step: 1, min: -2 }), { step: 0.1, min: -2 });
assert.equal(resolveComboLabel(2, options), 'b.safetensors');
assert.equal(resolveComboLabel('missing', options), 'None');
assert.equal(resolveComboLabel('a.safetensors', options), 'a.safetensors');

assert.equal(computeSliderRatio(-2, { min: -2, max: 2 }), 0);
assert.equal(computeSliderRatio(0, { min: -2, max: 2 }), 0.5);
assert.equal(computeSliderRatio(2, { min: -2, max: 2 }), 1);
assert.equal(computeSliderRatio(5, { min: 0, max: 4 }), 1);

const sliderRect = { x: 10, width: 100 };
assert.equal(calculateSliderValue(10, sliderRect, { min: 0, max: 1, step: 0.1 }), 0);
assert.equal(calculateSliderValue(60, sliderRect, { min: 0, max: 1, step: 0.1 }), 0.5);
assert.equal(calculateSliderValue(110, sliderRect, { min: -2, max: 2, step: 0.5 }), 2);
assert.equal(calculateSliderValue(85, sliderRect, { min: -2, max: 2, step: 0.5 }), 1);
assert.equal(calculateSliderValue(63, sliderRect, { min: 0, max: 1 }), 0.5);

assert.deepEqual(computeButtonRect(10, 20, 100, 30, 4), {
  x: 14,
  y: 24,
  width: 92,
  height: 22,
});
