const normalizeTag = (value) => String(value ?? '').trim();
const defaultDisplayHeight = 100;

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

const buildTagDisplaySegments = ({ tags, excluded }) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [{ type: 'empty', text: '(no tags)' }];
  }
  const excludedSet = new Set(
    Array.isArray(excluded) ? excluded.map((tag) => normalizeTag(tag)).filter(Boolean) : [],
  );
  const segments = [];
  tags.forEach((tag, index) => {
    const normalized = normalizeTag(tag);
    if (!normalized) {
      return;
    }
    segments.push({
      type: 'tag',
      text: normalized,
      excluded: excludedSet.has(normalized),
    });
    if (index < tags.length - 1) {
      segments.push({ type: 'separator', text: ', ' });
    }
  });
  if (segments.length === 0) {
    return [{ type: 'empty', text: '(no tags)' }];
  }
  return segments;
};

const computeDisplayHeight = ({
  nodeHeight,
  titleHeight,
  fallbackHeight,
  extraPadding = 0,
}) => {
  const fallback = Number.isFinite(fallbackHeight) ? fallbackHeight : 0;
  if (!Number.isFinite(nodeHeight)) {
    return fallback;
  }
  const header = Number.isFinite(titleHeight) ? titleHeight : 0;
  const padding = Number.isFinite(extraPadding) ? extraPadding : 0;
  const height = nodeHeight - header - padding;
  if (height <= 0) {
    return fallback;
  }
  return height < fallback ? fallback : height;
};

const findInputIndex = (inputs, name) => {
  if (!Array.isArray(inputs) || !name) {
    return -1;
  }
  return inputs.findIndex((input) => input?.name === name);
};

const formatDisabledTagLabel = ({ tags, excluded }) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  const available = new Set(tags.map((tag) => normalizeTag(tag)).filter(Boolean));
  if (available.size === 0) {
    return null;
  }
  const excludedSet = new Set(
    Array.isArray(excluded) ? excluded.map((tag) => normalizeTag(tag)).filter(Boolean) : [],
  );
  let count = 0;
  excludedSet.forEach((tag) => {
    if (available.has(tag)) {
      count += 1;
    }
  });
  if (count === 0) {
    return null;
  }
  return `${count} tags are disabled`;
};

const persistInputText = (target, inputText) => {
  if (!target || typeof inputText !== 'string') {
    return;
  }
  if (!target.properties || typeof target.properties !== 'object') {
    target.properties = {};
  }
  target.properties.tagToggleInputText = inputText;
};

const readPersistedInputText = (info) => {
  const value = info?.properties?.tagToggleInputText;
  return typeof value === 'string' ? value : null;
};

const shouldForwardWheelToCanvas = ({
  deltaY,
  scrollTop,
  scrollHeight,
  clientHeight,
}) => {
  const movement = Number(deltaY) || 0;
  if (movement === 0) {
    return false;
  }
  const safeScrollHeight = Math.max(0, Number(scrollHeight) || 0);
  const safeClientHeight = Math.max(0, Number(clientHeight) || 0);
  if (safeScrollHeight <= safeClientHeight) {
    return true;
  }
  const maxScrollTop = Math.max(0, safeScrollHeight - safeClientHeight);
  const safeScrollTop = Math.max(0, Number(scrollTop) || 0);
  if (movement < 0) {
    return safeScrollTop <= 0;
  }
  return safeScrollTop >= maxScrollTop;
};

export {
  buildTagDisplaySegments,
  computeDisplayHeight,
  defaultDisplayHeight,
  findInputIndex,
  formatDisabledTagLabel,
  persistInputText,
  readPersistedInputText,
  parseExcludedTags,
  serializeExcludedTags,
  splitTags,
  shouldHandleClick,
  shouldForwardWheelToCanvas,
  toggleTag,
};
