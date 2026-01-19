const normalizeSelectionValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
};

const parseSelection = (selectionText, triggers) => {
  if (!Array.isArray(triggers)) {
    return new Set();
  }
  if (!selectionText) {
    return new Set(triggers.map((trigger) => String(trigger)));
  }
  try {
    const parsed = JSON.parse(selectionText);
    if (!Array.isArray(parsed)) {
      return new Set(triggers.map((trigger) => String(trigger)));
    }
    return new Set(parsed.map((item) => String(item)));
  } catch (_error) {
    return new Set(triggers.map((trigger) => String(trigger)));
  }
};

const resolveTagSelection = ({
  selectionText,
  triggers,
  frequencies,
  autoSelectInfinityWordsOnly,
}) => {
  if (!Array.isArray(triggers)) {
    return new Set();
  }
  if (autoSelectInfinityWordsOnly) {
    const selected = triggers.filter((trigger) => {
      const raw = frequencies?.[trigger];
      const value = raw === null || raw === undefined ? Number.NaN : Number(raw);
      return value === Infinity;
    });
    return new Set(selected.map((trigger) => String(trigger)));
  }
  return parseSelection(selectionText, triggers);
};

const shouldAutoSelectInfinityTagsOnly = (
  autoSelectInfinityWordsOnly,
  isNewLoraSelection,
) => autoSelectInfinityWordsOnly === true && isNewLoraSelection === true;

export {
  normalizeSelectionValue,
  parseSelection,
  resolveTagSelection,
  shouldAutoSelectInfinityTagsOnly,
};
