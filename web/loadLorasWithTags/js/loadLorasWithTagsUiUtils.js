const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options;
  }
  if (options && typeof options === 'object') {
    return Object.values(options);
  }
  return [];
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

export {
  calculateSliderValue,
  computeButtonRect,
  computeResetButtonRect,
  computeSliderRatio,
  moveIndex,
  resolveComboLabel,
  normalizeStrengthOptions,
  normalizeOptions,
  resolveOption,
};
