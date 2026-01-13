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
  return tags.map((tag) => isTagMatch(tag, query));
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
  // タグとインデックスのペアを頻度でソート
  const indexed = tags.map((tag, index) => ({
    tag,
    index,
    freq: frequencies[tag] ?? 0,
  }));
  indexed.sort((a, b) => {
    if (b.freq !== a.freq) {
      return b.freq - a.freq;
    }
    return a.index - b.index;
  });
  // 上位N件のインデックスを取得
  const topIndices = new Set(indexed.slice(0, topN).map((item) => item.index));
  return tags.map((_, index) => topIndices.has(index));
};

export { getTagVisibility, isTagMatch, getTopNVisibility };
