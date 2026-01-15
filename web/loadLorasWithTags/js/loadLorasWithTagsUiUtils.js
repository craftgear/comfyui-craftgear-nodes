import { stripLoraExtension } from './loraNameUtils.js';
import { matchFuzzyPositions, rankFuzzyIndices } from './loraFuzzyMatch.js';

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options;
  }
  if (options && typeof options === 'object') {
    return Object.values(options);
  }
  return [];
};

const filterLoraOptionIndices = (query, options) => {
  const list = normalizeOptions(options);
  const normalized = String(query ?? '').trim();
  if (!normalized) {
    return list.map((_item, index) => index);
  }
  const bases = list.map((label) => stripLoraExtension(label));
  return rankFuzzyIndices(normalized, bases);
};

const filterLoraOptions = (query, options) => {
  const list = normalizeOptions(options);
  const indices = filterLoraOptionIndices(query, list);
  return indices.map((index) => list[index]).filter((label) => label !== undefined);
};

const splitLoraLabel = (label) => {
  const text = String(label ?? '');
  const base = stripLoraExtension(text);
  return { base, extension: text.slice(base.length) };
};

const getHighlightSegments = (text, query) => {
  const source = String(text ?? '');
  const rawQuery = String(query ?? '').trim();
  if (!rawQuery) {
    return [{ text: source, isMatch: false }];
  }
  const positions = matchFuzzyPositions(rawQuery, source);
  if (!positions || positions.length === 0) {
    return [{ text: source, isMatch: false }];
  }
  const positionSet = new Set(positions);
  const segments = [];
  let buffer = '';
  let currentMatch = null;

  for (let i = 0; i < source.length; i += 1) {
    const isMatch = positionSet.has(i);
    if (currentMatch === null) {
      currentMatch = isMatch;
      buffer = source[i];
      continue;
    }
    if (isMatch === currentMatch) {
      buffer += source[i];
      continue;
    }
    if (buffer) {
      segments.push({ text: buffer, isMatch: currentMatch });
    }
    buffer = source[i];
    currentMatch = isMatch;
  }
  if (buffer) {
    segments.push({ text: buffer, isMatch: !!currentMatch });
  }
  return segments.length > 0 ? segments : [{ text: source, isMatch: false }];
};

const resolveOption = (rawValue, options) => {
  const list = normalizeOptions(options);
  let value = rawValue;
  if (value && typeof value === 'object') {
    if ('value' in value) {
      value = value.value;
    } else if ('name' in value) {
      value = value.name;
    }
  }

  let label = '';
  let index = -1;
  if (typeof value === 'number' && Number.isFinite(value)) {
    index = Math.trunc(value);
    label = String(list[index] ?? '');
  } else if (value !== undefined && value !== null) {
    label = String(value);
    index = list.indexOf(label);
  }

  if (index < 0 && list.length > 0) {
    index = 0;
  }
  if (!label && index >= 0) {
    label = String(list[index] ?? '');
  }

  return { index, label };
};

const resolveComboLabel = (rawValue, options, fallback = 'None') => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return fallback;
  }
  const { index, label } = resolveOption(rawValue, list);
  if (label && list.includes(label)) {
    return label;
  }
  if (Number.isFinite(index) && index >= 0 && index < list.length) {
    return String(list[index]);
  }
  return String(list[0] ?? fallback);
};

const moveIndex = (currentIndex, direction, length) => {
  if (!Number.isFinite(length) || length <= 0) {
    return -1;
  }
  const base = Number.isFinite(currentIndex) ? Math.trunc(currentIndex) : 0;
  const step = direction < 0 ? -1 : 1;
  let next = base + step;
  if (next < 0) {
    next = length - 1;
  }
  if (next >= length) {
    next = 0;
  }
  return next;
};

const resolveVisibleSelection = (visibleOptions, selectedOptionIndex) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  if (!Number.isFinite(selectedOptionIndex) || selectedOptionIndex < 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  const indexInVisible = visibleOptions.findIndex((entry) => entry.index === selectedOptionIndex);
  if (indexInVisible < 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  return { selectedVisibleIndex: indexInVisible, selectedOptionIndex };
};

const resolveFilteredSelection = (visibleOptions, selectedOptionIndex, forceTop = false) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  if (forceTop) {
    const firstIndex = visibleOptions[0]?.index;
    return {
      selectedVisibleIndex: 0,
      selectedOptionIndex: Number.isFinite(firstIndex) ? firstIndex : -1,
    };
  }
  return resolveVisibleSelection(visibleOptions, selectedOptionIndex);
};

const computeButtonRect = (x, y, width, height, padding = 0) => {
  const safePadding = Math.max(0, padding);
  const rectWidth = Math.max(0, width - safePadding * 2);
  const rectHeight = Math.max(0, height - safePadding * 2);
  return {
    x: x + safePadding,
    y: y + safePadding,
    width: rectWidth,
    height: rectHeight,
  };
};

const computeSplitWidths = (totalWidth, firstRatio, secondRatio, gap = 0) => {
  const safeWidth = Math.max(0, Number(totalWidth) || 0);
  const safeGap = Math.max(0, Number(gap) || 0);
  const available = Math.max(0, safeWidth - safeGap);
  const firstWeight = Math.max(0, Number(firstRatio) || 0);
  const secondWeight = Math.max(0, Number(secondRatio) || 0);
  const totalWeight = firstWeight + secondWeight;
  if (totalWeight <= 0 || available <= 0) {
    return { first: 0, second: 0 };
  }
  const first = Math.floor((available * firstWeight) / totalWeight);
  const second = Math.max(0, available - first);
  return { first, second };
};

const computeResetButtonRect = (rect, size, padding = 0) => {
  const safeSize = Math.max(0, size);
  const safePadding = Math.max(0, padding);
  return {
    x: rect.x + rect.width - safeSize - safePadding,
    y: rect.y + (rect.height - safeSize) / 2,
    width: safeSize,
    height: safeSize,
  };
};

const clampNumber = (value, min, max) => {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  if (!Number.isFinite(value)) {
    return low;
  }
  if (value < low) {
    return low;
  }
  if (value > high) {
    return high;
  }
  return value;
};

const getStepDecimals = (step) => {
  if (!Number.isFinite(step)) {
    return 0;
  }
  const text = String(step);
  const parts = text.split('.');
  if (parts.length < 2) {
    return 0;
  }
  return parts[1].length;
};

const calculateSliderValue = (posX, rect, options) => {
  const min = Number(options?.min ?? 0);
  const max = Number(options?.max ?? 1);
  const width = Number(rect?.width ?? 0);
  const startX = Number(rect?.x ?? 0);
  if (!Number.isFinite(width) || width <= 0) {
    return clampNumber(min, min, max);
  }
  const ratio = (posX - startX) / width;
  const clampedRatio = clampNumber(ratio, 0, 1);
  const rangeMin = Math.min(min, max);
  const rangeMax = Math.max(min, max);
  const raw = rangeMin + clampedRatio * (rangeMax - rangeMin);
  const step = Number(options?.step ?? 0.1);
  if (Number.isFinite(step) && step > 0) {
    const steps = Math.round((raw - rangeMin) / step);
    const stepped = rangeMin + steps * step;
    const decimals = getStepDecimals(step);
    return clampNumber(
      decimals > 0 ? Number(stepped.toFixed(decimals)) : stepped,
      rangeMin,
      rangeMax,
    );
  }
  return clampNumber(raw, rangeMin, rangeMax);
};

const normalizeStrengthOptions = (options) => {
  const base = options && typeof options === 'object' ? options : {};
  return { ...base, step: 0.1 };
};

const computeSliderRatio = (value, options) => {
  const min = Number(options?.min ?? 0);
  const max = Number(options?.max ?? 1);
  const rangeMin = Math.min(min, max);
  const rangeMax = Math.max(min, max);
  const safeValue = Number.isFinite(value) ? value : rangeMin;
  if (rangeMax === rangeMin) {
    return 0;
  }
  const ratio = (safeValue - rangeMin) / (rangeMax - rangeMin);
  return clampNumber(ratio, 0, 1);
};

const loraLabelTextPadding = 8;
const loraLabelButtonHeightPadding = loraLabelTextPadding;
const loraDialogItemBackground = 'transparent';
const loraDialogItemBorder = 'none';
const loraDialogItemHoverBackground = '#2a2a2a';
const loraDialogItemSelectedBackground = '#424242';
const loraDialogMatchTextColor = '#f2d28b';
const loraDialogMatchFontWeight = '600';
const loraDialogItemGap = 0;
const loraDialogItemPaddingY = 4;
const loraDialogItemPaddingX = 8;

const resolveLoraDialogItemBackground = (isSelected, isHovered) => {
  if (isSelected) {
    return loraDialogItemSelectedBackground;
  }
  if (isHovered) {
    return loraDialogItemHoverBackground;
  }
  return loraDialogItemBackground;
};

const resetIconPath =
  'M18 28A12 12 0 1 0 6 16v6.2l-3.6-3.6L1 20l6 6l6-6l-1.4-1.4L8 22.2V16a10 10 0 1 1 10 10Z';

const focusInputLater = (input, schedule) => {
  if (!input || typeof input.focus !== 'function') {
    return;
  }
  const runner =
    schedule ??
    (typeof requestAnimationFrame === 'function'
      ? (callback) => requestAnimationFrame(callback)
      : (callback) => setTimeout(callback, 0));
  runner(() => input.focus());
};

export {
  calculateSliderValue,
  computeButtonRect,
  computeSplitWidths,
  computeResetButtonRect,
  computeSliderRatio,
  moveIndex,
  resolveFilteredSelection,
  resolveVisibleSelection,
  resolveComboLabel,
  normalizeStrengthOptions,
  normalizeOptions,
  filterLoraOptionIndices,
  filterLoraOptions,
  loraLabelButtonHeightPadding,
  loraLabelTextPadding,
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
  splitLoraLabel,
  getHighlightSegments,
  focusInputLater,
  resolveOption,
  resetIconPath,
};
