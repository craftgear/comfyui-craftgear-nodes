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

export { getTagVisibility, isTagMatch };
