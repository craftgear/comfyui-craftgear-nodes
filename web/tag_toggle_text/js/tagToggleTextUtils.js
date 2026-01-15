const normalizeTag = (value) => String(value ?? '').trim();

const splitTags = (value) => {
  if (value == null) {
    return [];
  }
  const text = typeof value === 'string' ? value : String(value);
  if (text === '') {
    return [];
  }
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
};

const parseExcludedTags = (value) => {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((tag) => normalizeTag(tag)).filter((tag) => tag !== '');
  }
  const text = typeof value === 'string' ? value : String(value);
  const trimmed = text.trim();
  if (trimmed === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => normalizeTag(tag)).filter((tag) => tag !== '');
    }
  } catch (_error) {
  }
  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
};

const serializeExcludedTags = (tags) => JSON.stringify(tags);

const toggleTag = (tags, target) => {
  const normalized = normalizeTag(target);
  if (!normalized) {
    return [...tags];
  }
  const next = tags.filter((tag) => tag !== normalized);
  if (next.length === tags.length) {
    return [...tags, normalized];
  }
  return next;
};

const shouldHandleClick = (event) => {
  const type = event?.type;
  if (!type) {
    return true;
  }
  if (type === 'pointerdown' || type === 'mousedown' || type === 'click') {
    return true;
  }
  return false;
};

export {
  parseExcludedTags,
  serializeExcludedTags,
  splitTags,
  shouldHandleClick,
  toggleTag,
};
