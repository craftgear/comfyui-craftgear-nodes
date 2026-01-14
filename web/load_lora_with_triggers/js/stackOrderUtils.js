const isFilledName = (name) => {
  const text = String(name ?? '').trim();
  return text !== '' && text !== 'None' && text !== '[None]';
};

const compactSlotValues = (values, startIndex = 0) => {
  if (!Array.isArray(values)) {
    return [];
  }
  const safeStart = Math.max(0, Math.min(startIndex, values.length));
  const head = values.slice(0, safeStart);
  const tail = values.slice(safeStart);
  const compacted = tail.filter((item) => isFilledName(item?.loraName));
  const result = head.slice();
  const normalizeSlotData = (data) => ({
    loraName: data?.loraName ?? 'None',
    strength: data?.strength ?? null,
    selection: data?.selection ?? '',
    on: data?.on ?? true,
  });
  for (let index = 0; index < tail.length; index += 1) {
    result.push(normalizeSlotData(compacted[index]));
  }
  return result;
};

export { compactSlotValues, isFilledName };
