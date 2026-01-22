export const COPY_SOURCE_MISSING_MESSAGE =
  'No source LoRA node is available to copy.';

export const resolveCopySourceMessage = (sources) => {
  const count = Array.isArray(sources)
    ? sources.length
    : Number.isFinite(Number(sources))
      ? Number(sources)
      : 0;
  if (count <= 0) {
    return COPY_SOURCE_MISSING_MESSAGE;
  }
  return '';
};
