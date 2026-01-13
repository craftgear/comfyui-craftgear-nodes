const normalizeSelectionValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
};

export { normalizeSelectionValue };
