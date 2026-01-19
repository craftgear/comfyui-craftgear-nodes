export const MIN_FREQUENCY_SETTING_ID =
  'craftgear.loadLorasWithTags.minFrequencyThreshold';
export const DEFAULT_MIN_FREQUENCY = 0;
export const AUTO_SELECT_MISSING_LORA_SETTING_ID =
  'craftgear.loadLorasWithTags.autoSelectMissingLora';
export const DEFAULT_AUTO_SELECT_MISSING_LORA = false;
export const AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID =
  'craftgear.loadLorasWithTags.autoSelectInfinityWordsOnly';
export const DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY = false;

export const normalizeMinFrequency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MIN_FREQUENCY;
  }
  return Math.floor(parsed);
};

export const normalizeAutoSelectMissingLora = (value) => value === true;
export const normalizeAutoSelectInfinityWordsOnly = (value) => value === true;
