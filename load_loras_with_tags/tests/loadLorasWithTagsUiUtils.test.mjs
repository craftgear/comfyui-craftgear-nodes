import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  calculateSliderValue,
  computeButtonRect,
  computeSplitWidths,
  computeResetButtonRect,
  computeSliderRatio,
  moveIndex,
  resolveComboLabel,
  resolveComboDisplayLabel,
  shouldPreserveUnknownOption,
  normalizeStrengthOptions,
  normalizeOptions,
  loraDialogWidth,
  resolvePopupPosition,
  resolveBelowCenteredPopupPosition,
  shouldCloseDialogOnOverlayClick,
  resolveStrengthDefault,
  shouldCloseStrengthPopupOnRelease,
  shouldCloseStrengthPopupOnInnerClick,
  shouldCloseStrengthPopupOnPress,
  shouldToggleTagSelectionOnKey,
  shouldBlurTagFilterOnKey,
  buildStrengthRangeCss,
  buildStrengthRangeProgressBackground,
  strengthRangeInputClass,
  strengthRangeThumbSize,
  strengthRangeTrackHeight,
  resolveInlineControlLayout,
  resolveCenteredY,
  resolveFixedLabelWidth,
  resolveRowLineHeight,
  resolveToggleSize,
  resolveToggleLabelRect,
  filterLoraOptionIndices,
  filterLoraOptions,
  loraLabelButtonHeightPadding,
  loraLabelTextPadding,
  missingLoraLabelColor,
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
  tagDialogItemBackground,
  tagDialogItemActiveBackground,
  tagDialogItemHoverBackground,
  resolveLoraDialogItemBackground,
  resolveTagDialogItemBackground,
  selectTriggerButtonHeight,
  getFrequencyLabelStyle,
  getHighlightSegments,
  splitLoraLabel,
  resolveVisibleSelection,
  resolveFilteredSelection,
  resolveSelectionByVisibleIndex,
  resolveHoverSelection,
  resolveOption,
  resolveActiveIndex,
  resolveMissingLoraFilterValue,
  resolveLoraDialogFilterValue,
  normalizeDialogFilterValue,
  resolveLoraSlotFilterValue,
  shouldIgnoreLoraDialogKeydownForIme,
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
    assert.equal(loraDialogWidth, '65vw');
    assert.equal(resolveStrengthDefault({ default: 0.7 }), 0.7);
    assert.equal(resolveStrengthDefault({ default: 'oops' }, 0.5), 0.5);
    assert.equal(resolveStrengthDefault(null, 0.5), 0.5);
    assert.equal(normalizeDialogFilterValue('  alpha  '), 'alpha');
    assert.equal(normalizeDialogFilterValue(null), '');
    assert.equal(resolveLoraDialogFilterValue(undefined, 'missing'), 'missing');
    assert.equal(resolveLoraDialogFilterValue('', 'missing'), '');
    assert.equal(resolveLoraDialogFilterValue('beta', 'missing'), 'beta');
    assert.equal(resolveLoraSlotFilterValue({ __loadLorasLoraFilter: 'slot' }, 'missing'), 'slot');
    assert.equal(resolveLoraSlotFilterValue({}, 'missing'), 'missing');
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Enter', isComposing: true }, false, false),
      true,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Enter' }, true, false),
      true,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Enter' }, false, true),
      true,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Process' }, false, false),
      true,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Unidentified', keyCode: 229 }, false, false),
      true,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'Enter' }, false, false),
      false,
    );
    assert.equal(
      shouldIgnoreLoraDialogKeydownForIme({ key: 'ArrowDown' }, false, false),
      false,
    );
    assert.ok(shouldCloseStrengthPopupOnRelease({ type: 'mouseup' }));
    assert.ok(shouldCloseStrengthPopupOnRelease({ type: 'pointerup' }));
    assert.ok(shouldCloseStrengthPopupOnRelease({ type: 'touchend' }));
    assert.ok(!shouldCloseStrengthPopupOnRelease({ type: 'mousedown' }));
    assert.ok(shouldCloseStrengthPopupOnPress({ type: 'mousedown' }));
    assert.ok(shouldCloseStrengthPopupOnPress({ type: 'pointerdown' }));
    assert.ok(shouldCloseStrengthPopupOnPress({ type: 'touchstart' }));
    assert.ok(!shouldCloseStrengthPopupOnPress({ type: 'mouseup' }));
    assert.ok(shouldToggleTagSelectionOnKey({ key: ' ' }, false));
    assert.ok(shouldToggleTagSelectionOnKey({ code: 'Space' }, false));
    assert.ok(shouldToggleTagSelectionOnKey({ key: 'ArrowLeft' }, false));
    assert.ok(shouldToggleTagSelectionOnKey({ key: 'ArrowRight' }, false));
    assert.ok(!shouldToggleTagSelectionOnKey({ key: 'ArrowLeft' }, true));
    assert.ok(shouldBlurTagFilterOnKey({ key: 'ArrowUp' }, true));
    assert.ok(shouldBlurTagFilterOnKey({ key: 'ArrowDown' }, true));
    assert.ok(!shouldBlurTagFilterOnKey({ key: 'ArrowUp' }, false));
    const range = { contains: (target) => target === 'range' };
    const resetButton = { contains: (target) => target === 'reset' };
    assert.equal(
      shouldCloseStrengthPopupOnInnerClick('range', range, resetButton),
      false,
    );
    assert.equal(
      shouldCloseStrengthPopupOnInnerClick('reset', range, resetButton),
      false,
    );
    assert.equal(
      shouldCloseStrengthPopupOnInnerClick('other', range, resetButton),
      true,
    );
    assert.equal(strengthRangeInputClass, 'craftgear-load-loras-with-tags-strength-range');
    assert.deepEqual(strengthRangeThumbSize, { width: 27, height: 18 });
    assert.equal(strengthRangeTrackHeight, 6);
    assert.equal(
      buildStrengthRangeProgressBackground(0.3),
      'linear-gradient(to right, #4aa3ff 0%, #4aa3ff 30%, #3a3a3a 30%, #3a3a3a 100%)',
    );
    assert.equal(
      buildStrengthRangeCss(
        strengthRangeInputClass,
        strengthRangeThumbSize,
        strengthRangeTrackHeight,
      ),
      [
        '.craftgear-load-loras-with-tags-strength-range {',
        '  -webkit-appearance: none;',
        '  appearance: none;',
        '  background: #3a3a3a;',
        '  border-radius: 999px;',
        '}',
        '.craftgear-load-loras-with-tags-strength-range::-webkit-slider-runnable-track {',
        '  height: 6px;',
        '  background: transparent;',
        '  border-radius: 999px;',
        '}',
        '.craftgear-load-loras-with-tags-strength-range::-moz-range-track {',
        '  height: 6px;',
        '  background: #3a3a3a;',
        '  border-radius: 999px;',
        '}',
        '.craftgear-load-loras-with-tags-strength-range::-moz-range-progress {',
        '  height: 6px;',
        '  background: #4aa3ff;',
        '  border-radius: 999px;',
        '}',
        '.craftgear-load-loras-with-tags-strength-range::-webkit-slider-thumb {',
        '  -webkit-appearance: none;',
        '  width: 27px;',
        '  height: 18px;',
        '  background: #d0d0d0;',
        '  border: 1px solid #3a3a3a;',
        '  border-radius: 999px;',
        '  box-sizing: border-box;',
        '  margin-top: -6px;',
        '}',
        '.craftgear-load-loras-with-tags-strength-range::-moz-range-thumb {',
        '  width: 27px;',
        '  height: 18px;',
        '  background: #d0d0d0;',
        '  border: 1px solid #3a3a3a;',
        '  border-radius: 999px;',
        '  box-sizing: border-box;',
        '}',
      ].join('\n'),
    );
    assert.ok(shouldCloseDialogOnOverlayClick(options, options));
    assert.ok(!shouldCloseDialogOnOverlayClick(options, ['None']));
    assert.deepEqual(
      resolvePopupPosition(
        { x: 100, y: 100 },
        { width: 200, height: 100 },
        { width: 1000, height: 800 },
      ),
      { left: 100, top: 108 },
    );
    assert.deepEqual(
      resolvePopupPosition(
        { x: 990, y: 790 },
        { width: 200, height: 100 },
        { width: 1000, height: 800 },
      ),
      { left: 792, top: 692 },
    );
    assert.deepEqual(
      resolvePopupPosition(
        { x: 0, y: 0 },
        { width: 2000, height: 2000 },
        { width: 1000, height: 800 },
      ),
      { left: 8, top: 8 },
    );
    assert.deepEqual(
      resolveBelowCenteredPopupPosition(
        { x: 100, y: 100, width: 80, height: 20 },
        { width: 200, height: 100 },
        { width: 1000, height: 800 },
      ),
      { left: 40, top: 128 },
    );
    assert.deepEqual(
      resolveBelowCenteredPopupPosition(
        { x: 990, y: 790, width: 20, height: 20 },
        { width: 200, height: 100 },
        { width: 1000, height: 800 },
      ),
      { left: 792, top: 692 },
    );
    assert.deepEqual(
      resolveBelowCenteredPopupPosition(
        { x: 0, y: 0, width: 10, height: 10 },
        { width: 2000, height: 2000 },
        { width: 1000, height: 800 },
      ),
      { left: 8, top: 8 },
    );
    assert.deepEqual(resolveInlineControlLayout(300, 40, 80, 4), {
      labelWidth: 172,
      valueWidth: 40,
      buttonWidth: 80,
      gap: 4,
    });
    assert.deepEqual(resolveInlineControlLayout(100, 40, 80, 4), {
      labelWidth: 0,
      valueWidth: 40,
      buttonWidth: 80,
      gap: 4,
    });
    assert.equal(resolveCenteredY(10, 20, 10), 15);
    assert.equal(resolveCenteredY(0, 16, 12), 2);
    assert.equal(resolveFixedLabelWidth(10), 48);
    assert.equal(resolveFixedLabelWidth(8, 3, 2), 28);
    assert.equal(resolveRowLineHeight(24, 4, 16, -6), 10);
    assert.equal(resolveRowLineHeight(24, 4), 16);
    assert.equal(resolveRowLineHeight(8, 4, 16, -4), 12);
    assert.deepEqual(resolveToggleSize(24), { height: 14, width: 25 });
    assert.deepEqual(resolveToggleSize(30), { height: 14, width: 25 });
    assert.deepEqual(resolveToggleSize(12), { height: 10, width: 18 });
    assert.deepEqual(
      resolveToggleLabelRect({ x: 10, y: 20, width: 30, height: 12 }, 50, 4),
      { x: 44, y: 20, width: 50, height: 12 },
    );
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
    assert.deepEqual(getHighlightSegments('cat', 'ct'), [
      { text: 'c', isMatch: true },
      { text: 'a', isMatch: false },
      { text: 't', isMatch: true },
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
    assert.deepEqual(
      resolveFilteredSelection(
        [
          { index: 1, label: 'alpha' },
          { index: 3, label: 'beta' },
        ],
        3,
        true,
      ),
      { selectedVisibleIndex: 0, selectedOptionIndex: 1 },
    );
    assert.deepEqual(
      resolveSelectionByVisibleIndex(
        [
          { index: 0, label: 'None' },
          { index: 2, label: 'b.safetensors' },
        ],
        1,
      ),
      { selectedVisibleIndex: 1, selectedOptionIndex: 2 },
    );
    assert.deepEqual(resolveSelectionByVisibleIndex([{ index: 0, label: 'None' }], 2), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });
    assert.deepEqual(
      resolveHoverSelection(
        [
          { index: 1, label: 'alpha' },
          { index: 3, label: 'beta' },
        ],
        1,
        1,
        true,
      ),
      {
        shouldUpdateSelection: false,
        selectedVisibleIndex: -1,
        selectedOptionIndex: -1,
      },
    );
    assert.deepEqual(
      resolveHoverSelection(
        [
          { index: 1, label: 'alpha' },
          { index: 3, label: 'beta' },
        ],
        5,
        1,
        false,
      ),
      {
        shouldUpdateSelection: false,
        selectedVisibleIndex: -1,
        selectedOptionIndex: -1,
      },
    );
    assert.deepEqual(
      resolveHoverSelection(
        [
          { index: 1, label: 'alpha' },
          { index: 3, label: 'beta' },
        ],
        1,
        3,
        false,
      ),
      {
        shouldUpdateSelection: false,
        selectedVisibleIndex: 1,
        selectedOptionIndex: 3,
      },
    );
    assert.deepEqual(
      resolveHoverSelection(
        [
          { index: 1, label: 'alpha' },
          { index: 3, label: 'beta' },
        ],
        0,
        3,
        false,
      ),
      {
        shouldUpdateSelection: true,
        selectedVisibleIndex: 0,
        selectedOptionIndex: 1,
      },
    );
    assert.deepEqual(resolveSelectionByVisibleIndex([], 0), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });
    assert.equal(resolveActiveIndex([], -1), -1);
    assert.equal(resolveActiveIndex([2, 5], 5), 5);
    assert.equal(resolveActiveIndex([2, 5], 1), 2);
    assert.equal(resolveActiveIndex([2, 5], -1), 2);
    assert.deepEqual(resolveFilteredSelection([], 0, true), {
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    });
    assert.deepEqual(getFrequencyLabelStyle(), {
      minWidth: '40px',
      textAlign: 'center',
      opacity: 0.7,
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',
    });
    assert.equal(selectTriggerButtonHeight, 22);
    assert.deepEqual(
      resolveFilteredSelection([{ index: 2, label: 'gamma' }], 2, false),
      { selectedVisibleIndex: 0, selectedOptionIndex: 2 },
    );

    assert.deepEqual(normalizeStrengthOptions(null), { step: 0.1 });
    assert.deepEqual(normalizeStrengthOptions({ step: 1, min: -2 }), { step: 0.1, min: -2 });
    assert.equal(resolveComboLabel(2, options), 'b.safetensors');
    assert.equal(resolveComboLabel('missing', options), 'None');
    assert.equal(resolveComboLabel('a.safetensors', options), 'a.safetensors');
    assert.equal(resolveComboDisplayLabel(2, options), 'b.safetensors');
    assert.equal(resolveComboDisplayLabel('missing', options), 'missing');
    assert.equal(resolveComboDisplayLabel('a.safetensors', options), 'a.safetensors');
    assert.equal(resolveComboDisplayLabel('None', options), 'None');
    assert.equal(resolveMissingLoraFilterValue('missing.safetensors', options), 'missing');
    assert.equal(resolveMissingLoraFilterValue('dir/missing.safetensors', options), 'missing');
    assert.equal(resolveMissingLoraFilterValue('dir\\missing.safetensors', options), 'missing');
    assert.equal(resolveMissingLoraFilterValue('missing', options), 'missing');
    assert.equal(resolveMissingLoraFilterValue('a.safetensors', options), '');
    assert.equal(resolveMissingLoraFilterValue('None', options), '');
    assert.equal(shouldPreserveUnknownOption('missing', options), true);
    assert.equal(shouldPreserveUnknownOption('a.safetensors', options), false);
    assert.equal(shouldPreserveUnknownOption('None', options), false);
    assert.equal(shouldPreserveUnknownOption(1, options), false);
    assert.equal(loraLabelButtonHeightPadding, 8);
    assert.equal(loraLabelTextPadding, 8);
    assert.equal(loraDialogItemBackground, 'transparent');
    assert.equal(loraDialogItemBorder, 'none');
    assert.equal(loraDialogItemHoverBackground, '#2a2a2a');
    assert.equal(loraDialogItemSelectedBackground, '#424242');
    assert.equal(loraDialogMatchTextColor, '#f2d28b');
    assert.equal(loraDialogMatchFontWeight, '600');
    assert.equal(missingLoraLabelColor, '#ff4d4d');
    assert.equal(loraDialogItemGap, 0);
    assert.equal(loraDialogItemPaddingY, 4);
    assert.equal(loraDialogItemPaddingX, 8);
    assert.equal(tagDialogItemBackground, 'transparent');
    assert.equal(tagDialogItemActiveBackground, '#3a3a3a');
    assert.equal(tagDialogItemHoverBackground, '#333333');
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
    assert.equal(
      resolveTagDialogItemBackground(false, false),
      tagDialogItemBackground,
    );
    assert.equal(
      resolveTagDialogItemBackground(false, true),
      tagDialogItemHoverBackground,
    );
    assert.equal(
      resolveTagDialogItemBackground(true, false),
      tagDialogItemActiveBackground,
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

    assert.deepEqual(computeSplitWidths(120, 2, 1, 6), { first: 76, second: 38 });
    assert.deepEqual(computeSplitWidths(10, 0, 0, 4), { first: 0, second: 0 });
  });
});
