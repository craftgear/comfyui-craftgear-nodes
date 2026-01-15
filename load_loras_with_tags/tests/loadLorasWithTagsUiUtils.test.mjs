import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  calculateSliderValue,
  computeButtonRect,
  computeResetButtonRect,
  computeSliderRatio,
  moveIndex,
  resolveComboLabel,
  normalizeStrengthOptions,
  normalizeOptions,
  filterLoraOptionIndices,
  filterLoraOptions,
  loraLabelButtonHeightPadding,
  loraLabelTextPadding,
  focusInputLater,
  loraDialogItemBackground,
  loraDialogItemBorder,
  loraDialogItemHoverBackground,
  loraDialogItemSelectedBackground,
  loraDialogMatchTextColor,
  loraDialogMatchFontWeight,
  loraDialogItemGap,
  loraDialogItemPaddingY,
  loraDialogItemPaddingX,
  resolveLoraDialogItemBackground,
  getHighlightSegments,
  splitLoraLabel,
  resolveVisibleSelection,
  resolveOption,
  resetIconPath,
} from '../../web/loadLorasWithTags/js/loadLorasWithTagsUiUtils.js';

describe('loadLorasWithTagsUiUtils', () => {
  it('validates utility helpers', () => {
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
    assert.equal(moveIndex(-1, 1, 3), 0);
    assert.equal(moveIndex(-1, -1, 3), 2);
    assert.equal(moveIndex(0, 1, 0), -1);

    assert.deepEqual(normalizeOptions(['a', 'b']), ['a', 'b']);
    assert.deepEqual(normalizeOptions({ a: 'x', b: 'y' }), ['x', 'y']);
    assert.deepEqual(normalizeOptions(null), []);
    assert.deepEqual(filterLoraOptionIndices('', options), [0, 1, 2]);
    assert.deepEqual(filterLoraOptionIndices('a', options), [1]);
    assert.deepEqual(filterLoraOptionIndices('b', options), [2]);
    assert.deepEqual(filterLoraOptions('', options), options);
    assert.deepEqual(filterLoraOptions('a', options), ['a.safetensors']);
    assert.deepEqual(filterLoraOptions('b', options), ['b.safetensors']);
    assert.deepEqual(splitLoraLabel('a.safetensors'), { base: 'a', extension: '.safetensors' });
    assert.deepEqual(splitLoraLabel('foo'), { base: 'foo', extension: '' });
    assert.deepEqual(getHighlightSegments('alpha', 'al'), [
      { text: 'al', isMatch: true },
      { text: 'pha', isMatch: false },
    ]);
    assert.deepEqual(getHighlightSegments('abcde', 'ae'), [
      { text: 'a', isMatch: true },
      { text: 'bcd', isMatch: false },
      { text: 'e', isMatch: true },
    ]);
    assert.deepEqual(getHighlightSegments('alpha', ''), [{ text: 'alpha', isMatch: false }]);
    assert.deepEqual(getHighlightSegments('alpha', 'zz'), [{ text: 'alpha', isMatch: false }]);
    assert.deepEqual(
      resolveVisibleSelection(
        [
          { index: 0, label: 'None' },
          { index: 2, label: 'b.safetensors' },
        ],
        2,
      ),
      { selectedVisibleIndex: 1, selectedOptionIndex: 2 },
    );
    assert.deepEqual(resolveVisibleSelection([{ index: 0, label: 'None' }], -1), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });
    assert.deepEqual(resolveVisibleSelection([{ index: 0, label: 'None' }], 2), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });
    assert.deepEqual(resolveVisibleSelection([], 0), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });

    assert.deepEqual(normalizeStrengthOptions(null), { step: 0.1 });
    assert.deepEqual(normalizeStrengthOptions({ step: 1, min: -2 }), { step: 0.1, min: -2 });
    assert.equal(resolveComboLabel(2, options), 'b.safetensors');
    assert.equal(resolveComboLabel('missing', options), 'None');
    assert.equal(resolveComboLabel('a.safetensors', options), 'a.safetensors');
    assert.equal(loraLabelButtonHeightPadding, 8);
    assert.equal(loraLabelTextPadding, 8);
    assert.equal(loraDialogItemBackground, 'transparent');
    assert.equal(loraDialogItemBorder, 'none');
    assert.equal(loraDialogItemHoverBackground, '#2a2a2a');
    assert.equal(loraDialogItemSelectedBackground, '#424242');
    assert.equal(loraDialogMatchTextColor, '#f2d28b');
    assert.equal(loraDialogMatchFontWeight, '600');
    assert.equal(loraDialogItemGap, 0);
    assert.equal(loraDialogItemPaddingY, 4);
    assert.equal(loraDialogItemPaddingX, 8);
    assert.equal(
      resolveLoraDialogItemBackground(false, false),
      loraDialogItemBackground,
    );
    assert.equal(
      resolveLoraDialogItemBackground(false, true),
      loraDialogItemHoverBackground,
    );
    assert.equal(
      resolveLoraDialogItemBackground(true, false),
      loraDialogItemSelectedBackground,
    );
    assert.equal(
      resolveLoraDialogItemBackground(true, true),
      loraDialogItemSelectedBackground,
    );
    {
      let focused = false;
      let scheduled = false;
      const input = { focus: () => { focused = true; } };
      const schedule = (fn) => { scheduled = true; fn(); };
      focusInputLater(input, schedule);
      assert.equal(scheduled, true);
      assert.equal(focused, true);
    }
    assert.equal(
      resetIconPath,
      'M18 28A12 12 0 1 0 6 16v6.2l-3.6-3.6L1 20l6 6l6-6l-1.4-1.4L8 22.2V16a10 10 0 1 1 10 10Z',
    );
    assert.deepEqual(computeResetButtonRect({ x: 10, y: 20, width: 100, height: 40 }, 12), {
      x: 98,
      y: 34,
      width: 12,
      height: 12,
    });

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
  });
});
