const resolveSavedValuesStride = (savedValues) => {
  if (!Array.isArray(savedValues)) {
    return 0;
  }
  const length = savedValues.length;
  if (length === 0) {
    return 0;
  }
  if (length % 5 === 0) {
    return 5;
  }
  if (length % 4 === 0) {
    return 4;
  }
  if (length % 3 === 0) {
    return 3;
  }
  return 4;
};

const getSavedSlotValues = (savedValues, slotIndex, strideOverride) => {
  const stride = Number.isFinite(strideOverride)
    ? strideOverride
    : resolveSavedValuesStride(savedValues);
  if (stride === 0) {
    return null;
  }
  const base = slotIndex * stride;
  if (savedValues.length <= base) {
    return null;
  }
  return {
    loraValue: savedValues[base],
    strengthValue: savedValues[base + 1],
    toggleValue: savedValues[base + 2],
    selectionValue: stride >= 4 ? savedValues[base + 3] : undefined,
    filterValue: stride >= 5 ? savedValues[base + 4] : undefined,
    stride,
  };
};

export { getSavedSlotValues, resolveSavedValuesStride };
