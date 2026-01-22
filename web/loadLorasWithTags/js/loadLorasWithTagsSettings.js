export const MIN_FREQUENCY_SETTING_ID =
  'craftgear.loadLorasWithTags.minFrequencyThreshold';
export const DEFAULT_MIN_FREQUENCY = 0;
export const AUTO_SELECT_MISSING_LORA_SETTING_ID =
  'craftgear.loadLorasWithTags.autoSelectMissingLora';
export const DEFAULT_AUTO_SELECT_MISSING_LORA = false;
export const AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID =
  'craftgear.loadLorasWithTags.autoSelectInfinityWordsOnly';
export const DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY = false;
export const LORA_PREVIEW_ZOOM_SCALE_SETTING_ID =
  'craftgear.loadLorasWithTags.previewZoomScale';
export const DEFAULT_LORA_PREVIEW_ZOOM_SCALE = 2;
export const LORA_STRENGTH_MIN_SETTING_ID =
  'craftgear.loadLorasWithTags.loraStrengthMin';
export const LORA_STRENGTH_MAX_SETTING_ID =
  'craftgear.loadLorasWithTags.loraStrengthMax';
export const DEFAULT_LORA_STRENGTH_MIN = -2;
export const DEFAULT_LORA_STRENGTH_MAX = 2;

export const normalizeMinFrequency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MIN_FREQUENCY;
  }
  return Math.floor(parsed);
};

export const normalizeAutoSelectMissingLora = (value) => value === true;
export const normalizeAutoSelectInfinityWordsOnly = (value) => value === true;
export const normalizeLoraPreviewZoomScale = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LORA_PREVIEW_ZOOM_SCALE;
  }
  return parsed;
};

const parseFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveLoraStrengthRange = (minValue, maxValue) => {
  const parsedMin = parseFiniteNumber(minValue);
  const parsedMax = parseFiniteNumber(maxValue);
  const resolvedMin =
    parsedMin !== null ? parsedMin : DEFAULT_LORA_STRENGTH_MIN;
  const resolvedMax =
    parsedMax !== null ? parsedMax : DEFAULT_LORA_STRENGTH_MAX;
  if (resolvedMin < resolvedMax) {
    return { min: resolvedMin, max: resolvedMax };
  }
  return {
    min: DEFAULT_LORA_STRENGTH_MIN,
    max: DEFAULT_LORA_STRENGTH_MAX,
  };
};
