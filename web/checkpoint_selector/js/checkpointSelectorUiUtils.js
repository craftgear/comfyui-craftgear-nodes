import { matchFuzzyPositions, rankFuzzyIndices } from './checkpointFuzzyMatch.js';

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options.slice();
  }
  if (options == null) {
    return [];
  }
  return [options];
};

const resolveOption = (rawValue, options) => {
  if (!Array.isArray(options) || options.length === 0) {
    return { index: -1, label: '' };
  }
  let value = rawValue;
  if (value && typeof value === 'object') {
    if ('value' in value) {
      value = value.value;
    } else if ('name' in value) {
      value = value.name;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const idx = Math.floor(value);
    if (idx >= 0 && idx < options.length) {
      return { index: idx, label: String(options[idx]) };
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed !== '' && /^[0-9]+$/.test(trimmed)) {
      const idx = Number.parseInt(trimmed, 10);
      if (idx >= 0 && idx < options.length) {
        return { index: idx, label: String(options[idx]) };
      }
    }
    const matchIndex = options.indexOf(trimmed);
    if (matchIndex >= 0) {
      return { index: matchIndex, label: trimmed };
    }
    return { index: -1, label: trimmed };
  }
  return { index: -1, label: '' };
};

const shouldPreserveUnknownOption = (rawValue, options, fallback) => {
  if (typeof rawValue !== 'string') {
    return false;
  }
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === fallback) {
    return false;
  }
  return !options.includes(trimmed);
};

const resolveRawComboLabel = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return '';
  }
  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }
  return String(rawValue);
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

const resolveComboDisplayLabel = (rawValue, options, fallback = 'None') => {
  if (shouldPreserveUnknownOption(rawValue, options, fallback)) {
    const text = resolveRawComboLabel(rawValue);
    return text || fallback;
  }
  return resolveComboLabel(rawValue, options, fallback);
};

const isPointInRect = (pos, rect) => {
  if (!Array.isArray(pos) || !rect) {
    return false;
  }
  const [x, y] = pos;
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
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

const setWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  widget.value = value;
  if (typeof widget.callback === 'function') {
    widget.callback(value);
  }
};

const setComboWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  const options = normalizeOptions(widget?.options?.values);
  if (options.length > 0) {
    const resolved = resolveComboLabel(value, options);
    setWidgetValue(widget, resolved);
    return;
  }
  setWidgetValue(widget, value);
};

const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  if (!widget.__checkpointSelectorOriginalComputeSize) {
    widget.__checkpointSelectorOriginalComputeSize = widget.computeSize;
    widget.computeSize = (width) => {
      if (widget.__checkpointSelectorHidden) {
        return [0, -4];
      }
      if (
        widget.__checkpointSelectorOriginalComputeSize &&
        widget.__checkpointSelectorOriginalComputeSize !== widget.computeSize
      ) {
        return widget.__checkpointSelectorOriginalComputeSize(width);
      }
      return [width, 20];
    };
  }
  widget.__checkpointSelectorHidden = hidden;
};

const createDebouncedRunner = (callback, delayMs) => {
  let timer = null;
  const run = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, delayMs);
  };
  const flush = () => {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    timer = null;
    callback();
  };
  const cancel = () => {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  };
  return { run, flush, cancel };
};

const normalizeDialogFilterValue = (value) => String(value ?? '').trim();

const filterOptionIndicesFromBase = (query, options, baseIndices = null) => {
  const normalizedQuery = normalizeDialogFilterValue(query);
  if (!normalizedQuery) {
    if (Array.isArray(baseIndices)) {
      return baseIndices.slice();
    }
    return options.map((_value, index) => index);
  }
  const baseOptions = Array.isArray(baseIndices)
    ? baseIndices.map((index) => options[index])
    : options;
  const ranked = rankFuzzyIndices(normalizedQuery, baseOptions);
  if (!Array.isArray(baseIndices)) {
    return ranked;
  }
  return ranked.map((index) => baseIndices[index]).filter((index) => index !== undefined);
};

const resolveNoneOptionIndex = (options) => {
  if (!Array.isArray(options)) {
    return -1;
  }
  return options.findIndex((option) => option === 'None');
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
    if (currentMatch === isMatch) {
      buffer += source[i];
      continue;
    }
    segments.push({ text: buffer, isMatch: currentMatch });
    buffer = source[i];
    currentMatch = isMatch;
  }

  if (buffer !== '') {
    segments.push({ text: buffer, isMatch: !!currentMatch });
  }

  return segments.length > 0 ? segments : [{ text: source, isMatch: false }];
};

const splitCheckpointLabel = (label) => {
  const text = String(label ?? '');
  const dotIndex = text.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { base: text, extension: '' };
  }
  return {
    base: text.slice(0, dotIndex),
    extension: text.slice(dotIndex),
  };
};

const isFilledName = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  const text = String(value).trim();
  return text !== '' && text !== 'None';
};

const resolveVisibleSlotCount = (slotValues, maxSlots) => {
  const values = Array.isArray(slotValues) ? slotValues : [];
  const limit = Number.isFinite(maxSlots) ? maxSlots : 1;
  let lastFilledIndex = -1;
  values.forEach((value, index) => {
    if (isFilledName(value)) {
      lastFilledIndex = index;
    }
  });
  const nextCount = Math.max(1, lastFilledIndex + 2);
  return Math.min(nextCount, Math.max(1, limit));
};

const normalizeSelectedSlotIndex = (value, visibleCount, slotValues) => {
  const maxCount = Number.isFinite(visibleCount) ? Math.max(1, visibleCount) : 1;
  const raw = value === null || value === undefined ? null : Number(value);
  if (Number.isFinite(raw)) {
    const index = Math.floor(raw);
    if (index >= 1 && index <= maxCount) {
      return index;
    }
  }
  if (Array.isArray(slotValues)) {
    const found = slotValues.findIndex((item) => isFilledName(item));
    if (found >= 0) {
      return Math.min(found + 1, maxCount);
    }
  }
  return 1;
};

export {
  computeButtonRect,
  createDebouncedRunner,
  filterOptionIndicesFromBase,
  getHighlightSegments,
  isPointInRect,
  normalizeDialogFilterValue,
  normalizeOptions,
  normalizeSelectedSlotIndex,
  resolveComboDisplayLabel,
  resolveComboLabel,
  resolveNoneOptionIndex,
  resolveOption,
  resolveVisibleSlotCount,
  setComboWidgetValue,
  setWidgetHidden,
  setWidgetValue,
  splitCheckpointLabel,
};
