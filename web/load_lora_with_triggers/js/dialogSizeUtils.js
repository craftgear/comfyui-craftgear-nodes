const getLockedHeight = (currentHeight, maxHeight) => {
  if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
    return null;
  }
  if (Number.isFinite(maxHeight) && maxHeight > 0) {
    return Math.min(currentHeight, maxHeight);
  }
  return currentHeight;
};

export { getLockedHeight };
