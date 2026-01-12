const normalizePercentValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 100;
  }
  return Math.min(100, Math.max(1, Math.round(numeric)));
};

const formatPercentLabel = (value) => `${normalizePercentValue(value)}%`;

export { formatPercentLabel, normalizePercentValue };
