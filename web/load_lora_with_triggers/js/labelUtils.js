const formatLabel = (label) => {
  const normalized = String(label ?? '').replaceAll('_', ' ').trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith('lora name')) {
    return 'lora';
  }
  if (lower.startsWith('lora strength')) {
    return 'strength';
  }
  if (lower.startsWith('select trigger') || lower.startsWith('select triggers')) {
    return 'select triggers';
  }
  return normalized;
};

export { formatLabel };
