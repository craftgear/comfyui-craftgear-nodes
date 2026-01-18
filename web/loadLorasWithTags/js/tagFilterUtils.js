import { rankFuzzy } from './loraFuzzyMatch.js';

const normalizeQuery = (query) => String(query ?? '').trim().toLowerCase();

const isTagMatch = (tag, query) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return true;
  }
  const target = String(tag ?? '').toLowerCase();
  if (!target) {
    return false;
  }
  return target.includes(normalized);
};

const getTagVisibility = (tags, query) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) {
    return tags.map(() => true);
  }
  const tagList = tags.map((tag) => String(tag ?? ''));
  const matched = rankFuzzy(normalizedQuery, tagList);
  const matchedSet = new Set(matched);
  return tagList.map((tag) => matchedSet.has(tag));
};

// 頻度の上位N件のタグのみを表示するフィルタ
const getTopNVisibility = (tags, frequencies, topN) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  if (topN <= 0 || topN >= tags.length || !frequencies || typeof frequencies !== 'object') {
    return tags.map(() => true);
  }
  const hasAnyFrequency = Object.keys(frequencies).length > 0;
  if (!hasAnyFrequency) {
    return tags.map(() => true);
  }
  const indexed = tags.map((tag, index) => ({
    tag,
    index,
    freq: (() => {
      const raw = frequencies[tag];
      if (raw === null || raw === undefined) {
        return 0;
      }
      const value = Number(raw);
      return Number.isNaN(value) ? 0 : value;
    })(),
  }));
  indexed.sort((a, b) => {
    if (b.freq !== a.freq) {
      return b.freq - a.freq;
    }
    return a.index - b.index;
  });
  const topIndices = new Set(indexed.slice(0, topN).map((item) => item.index));
  return tags.map((_, index) => topIndices.has(index));
};

const getMinFrequencyVisibility = (tags, frequencies, minFrequency) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  const threshold = Number(minFrequency);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return tags.map(() => true);
  }
  if (!frequencies || typeof frequencies !== 'object') {
    return tags.map(() => true);
  }
  const hasAnyFrequency = Object.keys(frequencies).length > 0;
  if (!hasAnyFrequency) {
    return tags.map(() => true);
  }
  return tags.map((tag) => {
    const raw = frequencies[tag];
    const value = raw === null || raw === undefined ? 0 : Number(raw);
    if (value === Infinity) {
      return true;
    }
    const freq = Number.isFinite(value) ? value : 0;
    return freq > threshold;
  });
};

export { getMinFrequencyVisibility, getTagVisibility, isTagMatch, getTopNVisibility };
