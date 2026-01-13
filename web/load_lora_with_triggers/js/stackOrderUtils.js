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
  for (let index = 0; index < tail.length; index += 1) {
    result.push(
      compacted[index] ?? { loraName: 'None', strength: null, selection: '' },
    );
  }
  return result;
};

export { compactSlotValues, isFilledName };
