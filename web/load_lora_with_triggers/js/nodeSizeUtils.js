const getResizedNodeSize = (node, options = {}) => {
  const size = node?.computeSize?.();
  if (!size || !Array.isArray(size)) {
    return null;
  }
  const nextSize = [size[0], size[1]];
  if (options.keepWidth) {
    const width = node?.size?.[0];
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      nextSize[0] = width;
    }
  }
  return nextSize;
};

export { getResizedNodeSize };
