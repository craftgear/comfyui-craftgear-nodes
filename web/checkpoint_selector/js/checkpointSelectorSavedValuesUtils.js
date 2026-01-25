const resolveSavedStride = (values, slotCount) => {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  if (values.length === slotCount) {
    return 1;
  }
  if (values.length % 2 === 0) {
    return 2;
  }
  return 0;
};

const resolveSavedCheckpointValue = (value, options) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && Array.isArray(options)) {
    const offset = options[0] === '' ? 1 : 0;
    const index = value + offset;
    const resolved = options[index];
    return resolved === undefined ? '' : resolved;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const buildCheckpointSavedValues = (slots) => {
  if (!Array.isArray(slots)) {
    return [];
  }
  const values = [];
  slots.forEach((slot) => {
    values.push(slot?.ckptWidget?.value ?? '');
    values.push(!!slot?.activeWidget?.value);
  });
  return values;
};

export { buildCheckpointSavedValues, resolveSavedCheckpointValue, resolveSavedStride };
