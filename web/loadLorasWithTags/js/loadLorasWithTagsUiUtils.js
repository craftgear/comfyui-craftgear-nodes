import { stripLoraBasename, stripLoraExtension } from "./loraNameUtils.js";
import { matchFuzzyPositions, rankFuzzyIndices } from "./loraFuzzyMatch.js";
import { normalizeFontSize } from "./loadLorasWithTagsSettings.js";

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options;
  }
  if (options && typeof options === "object") {
    return Object.values(options);
  }
  return [];
};

const filterLoraOptionIndices = (query, options) => {
  const list = normalizeOptions(options);
  const normalized = String(query ?? "").trim();
  if (!normalized) {
    return list.map((_item, index) => index);
  }
  const bases = list.map((label) => stripLoraExtension(label));
  return rankFuzzyIndices(normalized, bases);
};

const filterLoraOptionIndicesFromBase = (query, options, baseIndices) => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return [];
  }
  const normalized = String(query ?? "").trim();
  const indices = Array.isArray(baseIndices)
    ? baseIndices.filter((index) => Number.isFinite(index))
    : list.map((_item, index) => index);
  if (!normalized) {
    return indices;
  }
  const bases = indices.map((index) => stripLoraExtension(list[index]));
  const ranked = rankFuzzyIndices(normalized, bases);
  return ranked
    .map((rankedIndex) => indices[rankedIndex])
    .filter((index) => index !== undefined);
};

const filterLoraOptions = (query, options) => {
  const list = normalizeOptions(options);
  const indices = filterLoraOptionIndices(query, list);
  return indices
    .map((index) => list[index])
    .filter((label) => label !== undefined);
};

const splitLoraLabel = (label) => {
  const text = String(label ?? "");
  const base = stripLoraExtension(text);
  return { base, extension: text.slice(base.length) };
};

const getHighlightSegments = (text, query) => {
  const source = String(text ?? "");
  const rawQuery = String(query ?? "").trim();
  if (!rawQuery) {
    return [{ text: source, isMatch: false }];
  }
  const positions = matchFuzzyPositions(rawQuery, source);
  if (!positions || positions.length === 0) {
    return [{ text: source, isMatch: false }];
  }
  const positionSet = new Set(positions);
  const segments = [];
  let buffer = "";
  let currentMatch = null;

  for (let i = 0; i < source.length; i += 1) {
    const isMatch = positionSet.has(i);
    if (currentMatch === null) {
      currentMatch = isMatch;
      buffer = source[i];
      continue;
    }
    if (isMatch === currentMatch) {
      buffer += source[i];
      continue;
    }
    if (buffer) {
      segments.push({ text: buffer, isMatch: currentMatch });
    }
    buffer = source[i];
    currentMatch = isMatch;
  }
  if (buffer) {
    segments.push({ text: buffer, isMatch: !!currentMatch });
  }
  return segments.length > 0 ? segments : [{ text: source, isMatch: false }];
};

const resolveOption = (rawValue, options) => {
  const list = normalizeOptions(options);
  let value = rawValue;
  if (value && typeof value === "object") {
    if ("value" in value) {
      value = value.value;
    } else if ("name" in value) {
      value = value.name;
    }
  }

  let label = "";
  let index = -1;
  if (typeof value === "number" && Number.isFinite(value)) {
    index = Math.trunc(value);
    label = String(list[index] ?? "");
  } else if (value !== undefined && value !== null) {
    label = String(value);
    index = list.indexOf(label);
  }

  if (index < 0 && list.length > 0) {
    index = 0;
  }
  if (!label && index >= 0) {
    label = String(list[index] ?? "");
  }

  return { index, label };
};

const resolveComboOptionIndex = (rawValue, options, fallback = 'None') => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return -1;
  }
  let value = rawValue;
  if (value && typeof value === 'object') {
    if ('value' in value) {
      value = value.value;
    } else if ('name' in value) {
      value = value.name;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const index = Math.trunc(value);
    return index >= 0 && index < list.length ? index : -1;
  }
  const label = String(value ?? '').trim();
  if (!label) {
    const fallbackIndex = list.indexOf(fallback);
    return fallbackIndex >= 0 ? fallbackIndex : -1;
  }
  const index = list.indexOf(label);
  return index >= 0 ? index : -1;
};

const resolveNoneOptionIndex = (options, fallback = 'None') => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return -1;
  }
  return list.indexOf(fallback);
};

const resolveSameNameLoraIndex = (rawValue, options, fallback = 'None') => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return -1;
  }
  const label = resolveRawComboLabel(rawValue);
  if (!label || label === fallback) {
    return -1;
  }
  const extractBasename = (value) => {
    const text = String(value ?? '');
    if (!text) {
      return '';
    }
    const lastSlash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
    return lastSlash >= 0 ? text.slice(lastSlash + 1) : text;
  };
  const target = extractBasename(label);
  if (!target || target === fallback) {
    return -1;
  }
  return list.findIndex((entry) => extractBasename(entry) === target);
};

const resolveComboLabel = (rawValue, options, fallback = "None") => {
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return fallback;
  }
  const { index, label } = resolveOption(rawValue, list);
  if (label && list.includes(label)) {
    return label;
  }
  if (Number.isFinite(index) && index >= 0 && index < list.length) {
    return String(list[index]);
  }
  return String(list[0] ?? fallback);
};

const resolveRawComboLabel = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return '';
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return '';
  }
  let value = rawValue;
  if (value && typeof value === 'object') {
    if ('value' in value) {
      value = value.value;
    } else if ('name' in value) {
      value = value.name;
    }
  }
  return String(value ?? '').trim();
};

const shouldPreserveUnknownOption = (rawValue, options, fallback = 'None') => {
  const text = resolveRawComboLabel(rawValue);
  if (!text) {
    return false;
  }
  if (text === fallback) {
    return false;
  }
  const list = normalizeOptions(options);
  if (list.length === 0) {
    return false;
  }
  return !list.includes(text);
};

const resolveComboDisplayLabel = (rawValue, options, fallback = 'None') => {
  if (shouldPreserveUnknownOption(rawValue, options, fallback)) {
    const text = resolveRawComboLabel(rawValue);
    return text || fallback;
  }
  return resolveComboLabel(rawValue, options, fallback);
};

const resolveMissingLoraFilterValue = (rawValue, options, fallback = 'None') => {
  if (!shouldPreserveUnknownOption(rawValue, options, fallback)) {
    return '';
  }
  const label = resolveComboDisplayLabel(rawValue, options, fallback);
  if (!label || label === fallback) {
    return '';
  }
  return stripLoraBasename(label);
};

const normalizeDialogFilterValue = (value) => String(value ?? '').trim();

const resolveTagDialogFilterValue = (savedFilter) => {
  if (savedFilter === undefined || savedFilter === null) {
    return '';
  }
  return normalizeDialogFilterValue(savedFilter);
};

const shouldSelectTagDialogFilterOnOpen = (savedFilter) =>
  resolveTagDialogFilterValue(savedFilter) !== '';

const resolveTagDialogSortValue = (value) => {
  if (value === 'frequency' || value === 'name' || value === 'checked') {
    return value;
  }
  return 'frequency';
};

const resolveTagDialogTopNLabel = (value) => {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : 0;
  return `Show top ${resolved} tags`;
};

const resolveTagDialogFrequencyValue = (frequencies, trigger) => {
  if (!frequencies || typeof frequencies !== 'object') {
    return Number.NEGATIVE_INFINITY;
  }
  const raw = frequencies[trigger];
  const resolved = Number(raw);
  if (Number.isNaN(resolved)) {
    return Number.NEGATIVE_INFINITY;
  }
  return resolved;
};

const resolveTagDialogCheckedValue = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  if (typeof entry.checked === 'boolean') {
    return entry.checked;
  }
  return !!entry.checkbox?.checked;
};

const compareTagDialogNumbersDesc = (a, b) => {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
};

const compareTagDialogNames = (a, b) =>
  String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

const sortTagDialogItems = (entries, sortValue, frequencies) => {
  if (!Array.isArray(entries)) {
    return [];
  }
  const normalizedSort = resolveTagDialogSortValue(sortValue);
  const indexed = entries.map((entry, index) => ({ entry, index }));
  const compareWithFallback = (result, indexA, indexB) =>
    result === 0 ? indexA - indexB : result;

  indexed.sort((a, b) => {
    if (normalizedSort === 'name') {
      const nameResult = compareTagDialogNames(a.entry?.trigger, b.entry?.trigger);
      return compareWithFallback(nameResult, a.index, b.index);
    }
    if (normalizedSort === 'checked') {
      const checkedResult = compareTagDialogNumbersDesc(
        Number(resolveTagDialogCheckedValue(a.entry)),
        Number(resolveTagDialogCheckedValue(b.entry)),
      );
      return compareWithFallback(checkedResult, a.index, b.index);
    }
    const freqA = resolveTagDialogFrequencyValue(frequencies, a.entry?.trigger);
    const freqB = resolveTagDialogFrequencyValue(frequencies, b.entry?.trigger);
    const isInfA = freqA === Infinity;
    const isInfB = freqB === Infinity;
    if (isInfA && isInfB) {
      const nameResult = compareTagDialogNames(a.entry?.trigger, b.entry?.trigger);
      return compareWithFallback(nameResult, a.index, b.index);
    }
    if (isInfA !== isInfB) {
      return isInfA ? -1 : 1;
    }
    const frequencyResult = compareTagDialogNumbersDesc(freqA, freqB);
    return compareWithFallback(frequencyResult, a.index, b.index);
  });
  return indexed.map((item) => item.entry);
};

const resolveLoraDialogFilterValue = (savedFilter, missingFilter) => {
  const normalizedMissing = normalizeDialogFilterValue(missingFilter);
  if (savedFilter === undefined || savedFilter === null) {
    return normalizedMissing;
  }
  const normalizedSaved = normalizeDialogFilterValue(savedFilter);
  if (normalizedMissing === '' && normalizedSaved === 'None') {
    return '';
  }
  return normalizedSaved;
};

const resolveLoraSlotFilterValue = (slot, missingFilter) =>
  resolveLoraDialogFilterValue(slot?.__loadLorasLoraFilter, missingFilter);

const shouldSelectLoraDialogFilterOnOpen = (savedFilter) => {
  if (savedFilter === undefined || savedFilter === null) {
    return false;
  }
  const normalized = normalizeDialogFilterValue(savedFilter);
  if (!normalized || normalized === 'None') {
    return false;
  }
  return true;
};

const shouldIgnoreLoraDialogKeydownForIme = (
  event,
  isComposing,
  suppressEnterOnce,
) => {
  if (!event || typeof event !== 'object') {
    return false;
  }
  if (event.key === 'Process' || event.keyCode === 229) {
    return true;
  }
  if (event.key !== 'Enter') {
    return false;
  }
  if (event.isComposing) {
    return true;
  }
  if (isComposing) {
    return true;
  }
  return !!suppressEnterOnce;
};

const reorderListByMove = (list, fromIndex, toIndex) => {
  if (!Array.isArray(list)) {
    return [];
  }
  const length = list.length;
  if (length === 0) {
    return [];
  }
  const from = Math.trunc(fromIndex);
  const to = Math.trunc(toIndex);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return list.slice();
  }
  if (from < 0 || to < 0 || from >= length || to >= length) {
    return list.slice();
  }
  if (from === to) {
    return list.slice();
  }
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const resolveDragSlotOffset = (sourceIndex, targetIndex, slotIndex, step) => {
  if (
    !Number.isFinite(sourceIndex) ||
    !Number.isFinite(targetIndex) ||
    !Number.isFinite(slotIndex) ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return 0;
  }
  if (sourceIndex === targetIndex || slotIndex === sourceIndex) {
    return 0;
  }
  if (sourceIndex < targetIndex) {
    if (slotIndex > sourceIndex && slotIndex <= targetIndex) {
      return -step;
    }
    return 0;
  }
  if (slotIndex >= targetIndex && slotIndex < sourceIndex) {
    return step;
  }
  return 0;
};

const compactListByPredicate = (items, isFilled) => {
  if (!Array.isArray(items)) {
    return [];
  }
  if (typeof isFilled !== "function") {
    return items.slice();
  }
  const filled = [];
  const empty = [];
  items.forEach((item) => {
    if (isFilled(item)) {
      filled.push(item);
      return;
    }
    empty.push(item);
  });
  return filled.concat(empty);
};

const moveIndex = (currentIndex, direction, length) => {
  if (!Number.isFinite(length) || length <= 0) {
    return -1;
  }
  const base = Number.isFinite(currentIndex) ? Math.trunc(currentIndex) : 0;
  const step = direction < 0 ? -1 : 1;
  let next = base + step;
  if (next < 0) {
    next = length - 1;
  }
  if (next >= length) {
    next = 0;
  }
  return next;
};

const resolveVisibleSelection = (visibleOptions, selectedOptionIndex) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  if (!Number.isFinite(selectedOptionIndex) || selectedOptionIndex < 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  const indexInVisible = visibleOptions.findIndex(
    (entry) => entry.index === selectedOptionIndex,
  );
  if (indexInVisible < 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  return { selectedVisibleIndex: indexInVisible, selectedOptionIndex };
};

const resolveSelectionByVisibleIndex = (visibleOptions, visibleIndex) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  if (!Number.isFinite(visibleIndex)) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  const safeIndex = Math.trunc(visibleIndex);
  if (safeIndex < 0 || safeIndex >= visibleOptions.length) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  const optionIndex = visibleOptions[safeIndex]?.index;
  if (!Number.isFinite(optionIndex)) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  return { selectedVisibleIndex: safeIndex, selectedOptionIndex: optionIndex };
};

const resolveHoverSelection = (
  visibleOptions,
  hoveredVisibleIndex,
  selectedOptionIndex,
  suppressSelection = false,
) => {
  if (suppressSelection) {
    return {
      shouldUpdateSelection: false,
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    };
  }
  const resolved = resolveSelectionByVisibleIndex(
    visibleOptions,
    hoveredVisibleIndex,
  );
  if (resolved.selectedOptionIndex < 0) {
    return {
      shouldUpdateSelection: false,
      selectedVisibleIndex: -1,
      selectedOptionIndex: -1,
    };
  }
  return {
    shouldUpdateSelection: resolved.selectedOptionIndex !== selectedOptionIndex,
    selectedVisibleIndex: resolved.selectedVisibleIndex,
    selectedOptionIndex: resolved.selectedOptionIndex,
  };
};

const resolveFilteredSelection = (
  visibleOptions,
  selectedOptionIndex,
  forceTop = false,
) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return { selectedVisibleIndex: -1, selectedOptionIndex: -1 };
  }
  if (forceTop) {
    const firstIndex = visibleOptions[0]?.index;
    return {
      selectedVisibleIndex: 0,
      selectedOptionIndex: Number.isFinite(firstIndex) ? firstIndex : -1,
    };
  }
  return resolveVisibleSelection(visibleOptions, selectedOptionIndex);
};

const resolvePreviewVisibleIndex = (visibleOptions, selectedOptionIndex) => {
  if (!Array.isArray(visibleOptions) || visibleOptions.length === 0) {
    return -1;
  }
  if (!Number.isFinite(selectedOptionIndex) || selectedOptionIndex < 0) {
    return -1;
  }
  const checkedIndex = visibleOptions.findIndex(
    (entry) => entry?.index === selectedOptionIndex,
  );
  return checkedIndex >= 0 ? checkedIndex : -1;
};

const resolveActiveIndex = (visibleIndices, activeIndex) => {
  if (!Array.isArray(visibleIndices) || visibleIndices.length === 0) {
    return -1;
  }
  if (visibleIndices.includes(activeIndex)) {
    return activeIndex;
  }
  return visibleIndices[0];
};

const computeButtonRect = (x, y, width, height, padding = 0) => {
  const safePadding = Math.max(0, padding);
  const rectWidth = Math.max(0, width - safePadding * 2);
  const rectHeight = Math.max(0, height - safePadding * 2);
  return {
    x: x + safePadding,
    y: y + safePadding,
    width: rectWidth,
    height: rectHeight,
  };
};

const isRectFullyVisible = (containerRect, targetRect) => {
  if (!containerRect || !targetRect) {
    return false;
  }
  const containerTop = Number(containerRect.top);
  const containerBottom = Number(containerRect.bottom);
  const targetTop = Number(targetRect.top);
  const targetBottom = Number(targetRect.bottom);
  if (
    !Number.isFinite(containerTop) ||
    !Number.isFinite(containerBottom) ||
    !Number.isFinite(targetTop) ||
    !Number.isFinite(targetBottom)
  ) {
    return false;
  }
  return targetTop >= containerTop && targetBottom <= containerBottom;
};

const computeSplitWidths = (totalWidth, firstRatio, secondRatio, gap = 0) => {
  const safeWidth = Math.max(0, Number(totalWidth) || 0);
  const safeGap = Math.max(0, Number(gap) || 0);
  const available = Math.max(0, safeWidth - safeGap);
  const firstWeight = Math.max(0, Number(firstRatio) || 0);
  const secondWeight = Math.max(0, Number(secondRatio) || 0);
  const totalWeight = firstWeight + secondWeight;
  if (totalWeight <= 0 || available <= 0) {
    return { first: 0, second: 0 };
  }
  const first = Math.floor((available * firstWeight) / totalWeight);
  const second = Math.max(0, available - first);
  return { first, second };
};

const computeResetButtonRect = (rect, size, padding = 0) => {
  const safeSize = Math.max(0, size);
  const safePadding = Math.max(0, padding);
  return {
    x: rect.x + rect.width - safeSize - safePadding,
    y: rect.y + (rect.height - safeSize) / 2,
    width: safeSize,
    height: safeSize,
  };
};

const clampNumber = (value, min, max) => {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  if (!Number.isFinite(value)) {
    return low;
  }
  if (value < low) {
    return low;
  }
  if (value > high) {
    return high;
  }
  return value;
};

const resolveZoomBackgroundPosition = (
  cursor,
  container,
  content,
  scale = 2,
) => {
  const safeScale = Math.max(1, Number(scale) || 1);
  const containerWidth = Math.max(0, Number(container?.width) || 0);
  const containerHeight = Math.max(0, Number(container?.height) || 0);
  if (containerWidth === 0 || containerHeight === 0) {
    return { x: 0, y: 0 };
  }
  const contentWidth =
    Math.max(0, Number(content?.width) || 0) || containerWidth;
  const contentHeight =
    Math.max(0, Number(content?.height) || 0) || containerHeight;
  const offsetX = Math.max(0, Number(content?.offsetX) || 0);
  const offsetY = Math.max(0, Number(content?.offsetY) || 0);
  const relativeX = clampNumber(
    Number(cursor?.x) - offsetX,
    0,
    contentWidth,
  );
  const relativeY = clampNumber(
    Number(cursor?.y) - offsetY,
    0,
    contentHeight,
  );
  const zoomWidth = contentWidth * safeScale;
  const zoomHeight = contentHeight * safeScale;
  if (zoomWidth === 0 || zoomHeight === 0) {
    return { x: 0, y: 0 };
  }
  const rawX = containerWidth / 2 - relativeX * safeScale;
  const rawY = containerHeight / 2 - relativeY * safeScale;
  const minX = containerWidth - zoomWidth;
  const minY = containerHeight - zoomHeight;
  return {
    x: clampNumber(rawX, minX, 0),
    y: clampNumber(rawY, minY, 0),
  };
};

const resolvePopupPosition = (
  anchor,
  popupSize,
  viewport,
  offset = { x: 0, y: 8 },
  margin = 8,
) => {
  const safeMargin = Math.max(0, Number(margin) || 0);
  const safeOffsetX = Number(offset?.x ?? 0) || 0;
  const safeOffsetY = Number(offset?.y ?? 0) || 0;
  const popupWidth = Math.max(0, Number(popupSize?.width ?? 0) || 0);
  const popupHeight = Math.max(0, Number(popupSize?.height ?? 0) || 0);
  const viewportWidth = Math.max(0, Number(viewport?.width ?? 0) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height ?? 0) || 0);
  const maxLeft = Math.max(safeMargin, viewportWidth - popupWidth - safeMargin);
  const maxTop = Math.max(safeMargin, viewportHeight - popupHeight - safeMargin);
  const left = clampNumber(
    Number(anchor?.x ?? 0) + safeOffsetX,
    safeMargin,
    maxLeft,
  );
  const top = clampNumber(
    Number(anchor?.y ?? 0) + safeOffsetY,
    safeMargin,
    maxTop,
  );
  return { left, top };
};

const resolveBelowCenteredPopupPosition = (
  anchor,
  popupSize,
  viewport,
  gap = 8,
  margin = 8,
) => {
  const anchorWidth = Math.max(0, Number(anchor?.width ?? 0) || 0);
  const anchorHeight = Math.max(0, Number(anchor?.height ?? 0) || 0);
  const anchorX = Number(anchor?.x ?? 0) || 0;
  const anchorY = Number(anchor?.y ?? 0) || 0;
  const popupWidth = Math.max(0, Number(popupSize?.width ?? 0) || 0);
  const centeredLeft = anchorX + anchorWidth / 2 - popupWidth / 2;
  const top = anchorY + anchorHeight + gap;
  return resolvePopupPosition(
    { x: centeredLeft, y: top },
    popupSize,
    viewport,
    { x: 0, y: 0 },
    margin,
  );
};

const resolveInlineControlLayout = (
  availableWidth,
  valueWidth,
  buttonWidth,
  gap = 4,
) => {
  const safeAvailable = Math.max(0, Number(availableWidth) || 0);
  const safeValueWidth = Math.max(0, Number(valueWidth) || 0);
  const safeButtonWidth = Math.max(0, Number(buttonWidth) || 0);
  const safeGap = Math.max(0, Number(gap) || 0);
  const totalGap = safeGap * 2;
  const labelWidth = Math.max(
    0,
    safeAvailable - safeValueWidth - safeButtonWidth - totalGap,
  );
  return {
    labelWidth,
    valueWidth: safeValueWidth,
    buttonWidth: safeButtonWidth,
    gap: safeGap,
  };
};

const resolveFixedLabelWidth = (charWidth, charCount = 4, padding = 4) => {
  const safeCharWidth = Math.max(0, Number(charWidth) || 0);
  const safeCount = Math.max(0, Number(charCount) || 0);
  const safePadding = Math.max(0, Number(padding) || 0);
  return safeCharWidth * safeCount + safePadding * 2;
};

const strengthRangeInputClass = "craftgear-load-loras-with-tags-strength-range";
const strengthRangeThumbSize = { width: 27, height: 18 };
const strengthRangeTrackHeight = 6;
const strengthRangeFillColor = "#4aa3ff";
const strengthRangeBaseColor = "#3a3a3a";

const buildStrengthRangeProgressBackground = (
  ratio,
  fillColor = strengthRangeFillColor,
  baseColor = strengthRangeBaseColor,
) => {
  const safeRatio = clampNumber(Number(ratio) || 0, 0, 1);
  const percent = Math.round(safeRatio * 100);
  return `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, ${baseColor} ${percent}%, ${baseColor} 100%)`;
};

const buildStrengthRangeCss = (className, size, trackHeight) => {
  const safeClass = String(className ?? "").trim();
  if (!safeClass) {
    return "";
  }
  const width = Math.max(0, Number(size?.width ?? 0) || 0);
  const height = Math.max(0, Number(size?.height ?? 0) || 0);
  const safeTrackHeight = Math.max(0, Number(trackHeight ?? 0) || 0);
  const thumbOffset = Math.round((safeTrackHeight - height) / 2);
  return [
    `.${safeClass} {`,
    "  -webkit-appearance: none;",
    "  appearance: none;",
    `  background: ${strengthRangeBaseColor};`,
    "  border-radius: 999px;",
    "}",
    `.${safeClass}::-webkit-slider-runnable-track {`,
    `  height: ${safeTrackHeight}px;`,
    "  background: transparent;",
    "  border-radius: 999px;",
    "}",
    `.${safeClass}::-moz-range-track {`,
    `  height: ${safeTrackHeight}px;`,
    `  background: ${strengthRangeBaseColor};`,
    "  border-radius: 999px;",
    "}",
    `.${safeClass}::-moz-range-progress {`,
    `  height: ${safeTrackHeight}px;`,
    `  background: ${strengthRangeFillColor};`,
    "  border-radius: 999px;",
    "}",
    `.${safeClass}::-webkit-slider-thumb {`,
    "  -webkit-appearance: none;",
    `  width: ${width}px;`,
    `  height: ${height}px;`,
    "  background: #d0d0d0;",
    "  border: 1px solid #3a3a3a;",
    "  border-radius: 999px;",
    "  box-sizing: border-box;",
    `  margin-top: ${thumbOffset}px;`,
    "}",
    `.${safeClass}::-moz-range-thumb {`,
    `  width: ${width}px;`,
    `  height: ${height}px;`,
    "  background: #d0d0d0;",
    "  border: 1px solid #3a3a3a;",
    "  border-radius: 999px;",
    "  box-sizing: border-box;",
    "}",
  ].join("\n");
};

const resolveCenteredY = (top, height, itemHeight) => {
  const safeTop = Number(top) || 0;
  const safeHeight = Math.max(0, Number(height) || 0);
  const safeItemHeight = Math.max(0, Number(itemHeight) || 0);
  return safeTop + (safeHeight - safeItemHeight) / 2;
};

const resolveRowLineHeight = (
  rowHeight,
  paddingY,
  minHeight = 16,
  adjust = 0,
) => {
  const safeRow = Math.max(0, Number(rowHeight) || 0);
  const safePadding = Math.max(0, Number(paddingY) || 0);
  const safeMin = Math.max(0, Number(minHeight) || 0);
  const safeAdjust = Number.isFinite(adjust) ? adjust : 0;
  const available = safeRow - safePadding * 2;
  const base = Math.max(safeMin, available);
  return Math.max(0, base + safeAdjust);
};

const resolveToggleSize = (rowHeight) => {
  const safeHeight = Math.max(0, Number(rowHeight) || 0);
  const height = Math.max(10, Math.min(14, safeHeight - 8));
  return { height, width: Math.round(height * 1.8) };
};

const resolveToggleLabelRect = (toggleRect, textWidth, innerMargin = 0) => {
  const rectX = Number(toggleRect?.x ?? 0) || 0;
  const rectY = Number(toggleRect?.y ?? 0) || 0;
  const rectWidth = Number(toggleRect?.width ?? 0) || 0;
  const rectHeight = Number(toggleRect?.height ?? 0) || 0;
  const safeWidth = Math.max(0, Number(textWidth) || 0);
  const safeMargin = Math.max(0, Number(innerMargin) || 0);
  return {
    x: rectX + rectWidth + safeMargin,
    y: rectY,
    width: safeWidth,
    height: rectHeight,
  };
};

const shouldCloseDialogOnOverlayClick = (overlay, target) => overlay === target;

const resolveStrengthDefault = (options, fallback = 1.0) => {
  const value = Number(options?.default ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};

const shouldCloseStrengthPopupOnRelease = (event) => {
  const type = event?.type;
  return type === "mouseup" || type === "pointerup" || type === "touchend";
};

const shouldCloseStrengthPopupOnPress = (event) => {
  const type = event?.type;
  return type === "mousedown" || type === "pointerdown" || type === "touchstart";
};

const shouldCloseStrengthPopupOnInnerClick = (target, range, resetButton) => {
  const canContain = (node, child) =>
    node && typeof node.contains === "function" && node.contains(child);
  if (canContain(range, target)) {
    return false;
  }
  if (canContain(resetButton, target)) {
    return false;
  }
  return true;
};

const shouldToggleTagSelectionOnKey = (event, isTextInput) => {
  if (isTextInput) {
    return false;
  }
  const key = event?.key;
  const code = event?.code;
  return (
    key === " " ||
    key === "Spacebar" ||
    code === "Space" ||
    key === "ArrowLeft" ||
    key === "ArrowRight"
  );
};

const shouldBlurTagFilterOnKey = (event, isTextInput) => {
  if (!isTextInput) {
    return false;
  }
  const key = event?.key;
  return key === "ArrowUp" || key === "ArrowDown";
};

const getStepDecimals = (step) => {
  if (!Number.isFinite(step)) {
    return 0;
  }
  const text = String(step);
  const parts = text.split(".");
  if (parts.length < 2) {
    return 0;
  }
  return parts[1].length;
};

const calculateSliderValue = (posX, rect, options) => {
  const min = Number(options?.min ?? 0);
  const max = Number(options?.max ?? 1);
  const width = Number(rect?.width ?? 0);
  const startX = Number(rect?.x ?? 0);
  if (!Number.isFinite(width) || width <= 0) {
    return clampNumber(min, min, max);
  }
  const ratio = (posX - startX) / width;
  const clampedRatio = clampNumber(ratio, 0, 1);
  const rangeMin = Math.min(min, max);
  const rangeMax = Math.max(min, max);
  const raw = rangeMin + clampedRatio * (rangeMax - rangeMin);
  const step = Number(options?.step ?? 0.1);
  if (Number.isFinite(step) && step > 0) {
    const steps = Math.round((raw - rangeMin) / step);
    const stepped = rangeMin + steps * step;
    const decimals = getStepDecimals(step);
    return clampNumber(
      decimals > 0 ? Number(stepped.toFixed(decimals)) : stepped,
      rangeMin,
      rangeMax,
    );
  }
  return clampNumber(raw, rangeMin, rangeMax);
};

const normalizeStrengthOptions = (options) => {
  const base = options && typeof options === "object" ? options : {};
  return { ...base, step: 0.1 };
};

const computeSliderRatio = (value, options) => {
  const min = Number(options?.min ?? 0);
  const max = Number(options?.max ?? 1);
  const rangeMin = Math.min(min, max);
  const rangeMax = Math.max(min, max);
  const safeValue = Number.isFinite(value) ? value : rangeMin;
  if (rangeMax === rangeMin) {
    return 0;
  }
  const ratio = (safeValue - rangeMin) / (rangeMax - rangeMin);
  return clampNumber(ratio, 0, 1);
};

const resolveLoadLorasFontSizes = (value) => {
  const base = Math.max(8, Math.round(normalizeFontSize(value)));
  const heading = Math.max(8, Math.round(base * 0.875));
  const small = Math.max(8, Math.round(base * 0.75));
  return { base, heading, small };
};

const loraLabelTextPadding = 8;
const loraLabelButtonHeightPadding = loraLabelTextPadding;
const loraDialogItemBackground = "transparent";
const loraDialogItemBorder = "none";
const loraDialogItemHoverBackground = "#2a2a2a";
const loraDialogItemSelectedBackground = "#424242";
const loraDialogMatchTextColor = "#f2d28b";
const loraDialogMatchFontWeight = "600";
const missingLoraLabelColor = "#ff4d4d";
const loraDialogItemGap = 0;
const loraDialogItemPaddingY = 4;
const loraDialogItemPaddingX = 8;
const loraDialogWidth = "65vw";
const loraDialogHeaderOrder = ["filter", "cancel", "trash"];
const tagDialogItemBackground = "transparent";
const tagDialogItemActiveBackground = "#3a3a3a";
const tagDialogItemHoverBackground = "#333333";
const selectTriggerButtonHeight = 22;

const getFrequencyLabelStyle = () => ({
  minWidth: "40px",
  textAlign: "center",
  opacity: 0.7,
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
});

const getTagDialogListStyle = (fontSize) => {
  const base = Math.max(8, Math.round(Number(fontSize) || 0));
  return {
    overflow: "auto",
    padding: "8px",
    background: "#2a2a2a",
    borderRadius: "6px",
    flex: "1 1 auto",
    fontSize: `${base}px`,
  };
};

const getLoraDialogListStyle = () => ({
  overflow: "auto",
  overflowX: "hidden",
  padding: "8px",
  background: "#2a2a2a",
  borderRadius: "6px",
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  gap: `${loraDialogItemGap}px`,
});

const getLoraPreviewPanelStyle = (width, padding) => ({
  width: `${width}px`,
  padding: `${padding}px`,
  background: "transparent",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  overflow: "hidden",
});

const resolveLoraDialogItemBackground = (isSelected, isHovered) => {
  if (isSelected) {
    return loraDialogItemSelectedBackground;
  }
  if (isHovered) {
    return loraDialogItemHoverBackground;
  }
  return loraDialogItemBackground;
};

const resolveTagDialogItemBackground = (isActive, isHovered) => {
  if (isActive) {
    return tagDialogItemActiveBackground;
  }
  if (isHovered) {
    return tagDialogItemHoverBackground;
  }
  return tagDialogItemBackground;
};

const loraDialogSelectedIconPath =
  "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 12l2 2l4 -4";
const loraDialogSelectedIconSize = 19.2;
const loraDialogOpenFolderIconPath =
  'M13.5 6a.5.5 0 0 0 .5-.5A1.5 1.5 0 0 0 12.5 4h-5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 5 2H1.5A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h11.1a1.49 1.49 0 0 0 1.42-1.03l1.77-5.32a.5.5 0 0 0-.474-.658h-10.8a.75.75 0 0 0-.712.513l-1.83 5.49h-.5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h3.5l.9 1.2c.378.504.97.8 1.6.8h5c.276 0 .5.224.5.5s.224.5.5.5z';
const loraDialogOpenFolderIconSize = 19.2;
const resetIconPath =
  "M18 28A12 12 0 1 0 6 16v6.2l-3.6-3.6L1 20l6 6l6-6l-1.4-1.4L8 22.2V16a10 10 0 1 1 10 10Z";
const trashIconPath =
  "M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6z";

const createDebouncedRunner = (callback, wait = 0, timers) => {
  if (typeof callback !== "function") {
    return {
      run: () => {},
      flush: () => {},
      cancel: () => {},
    };
  }
  const schedule = timers?.setTimeout ?? setTimeout;
  const cancelTimer = timers?.clearTimeout ?? clearTimeout;
  let handle = null;
  let lastArgs = [];
  const run = (...args) => {
    lastArgs = args;
    if (handle !== null) {
      cancelTimer(handle);
    }
    handle = schedule(() => {
      handle = null;
      callback(...lastArgs);
    }, wait);
  };
  const flush = () => {
    if (handle === null) {
      return;
    }
    cancelTimer(handle);
    handle = null;
    callback(...lastArgs);
  };
  const cancel = () => {
    if (handle === null) {
      return;
    }
    cancelTimer(handle);
    handle = null;
  };
  return { run, flush, cancel };
};

const focusInputLater = (input, schedule) => {
  if (!input || typeof input.focus !== "function") {
    return;
  }
  const runner =
    schedule ??
    (typeof requestAnimationFrame === "function"
      ? (callback) => requestAnimationFrame(callback)
      : (callback) => setTimeout(callback, 0));
  runner(() => input.focus());
};

export {
  calculateSliderValue,
  computeButtonRect,
  isRectFullyVisible,
  computeSplitWidths,
  computeResetButtonRect,
  computeSliderRatio,
  createDebouncedRunner,
  moveIndex,
  resolveFilteredSelection,
  resolveVisibleSelection,
  resolveSelectionByVisibleIndex,
  resolveHoverSelection,
  resolvePreviewVisibleIndex,
  resolveZoomBackgroundPosition,
  resolveComboLabel,
  resolveComboDisplayLabel,
  resolveComboOptionIndex,
  resolveMissingLoraFilterValue,
  resolveTagDialogFilterValue,
  shouldSelectTagDialogFilterOnOpen,
  resolveTagDialogSortValue,
  resolveTagDialogTopNLabel,
  sortTagDialogItems,
  resolveLoraDialogFilterValue,
  shouldSelectLoraDialogFilterOnOpen,
  resolveLoraSlotFilterValue,
  normalizeDialogFilterValue,
  shouldIgnoreLoraDialogKeydownForIme,
  reorderListByMove,
  resolveDragSlotOffset,
  compactListByPredicate,
  shouldPreserveUnknownOption,
  normalizeStrengthOptions,
  normalizeOptions,
  resolveLoadLorasFontSizes,
  filterLoraOptionIndices,
  filterLoraOptionIndicesFromBase,
  filterLoraOptions,
  loraLabelButtonHeightPadding,
  loraLabelTextPadding,
  loraDialogItemBackground,
  loraDialogItemBorder,
  loraDialogItemHoverBackground,
  loraDialogItemSelectedBackground,
  loraDialogMatchTextColor,
  loraDialogMatchFontWeight,
  missingLoraLabelColor,
  loraDialogItemGap,
  loraDialogItemPaddingY,
  loraDialogItemPaddingX,
  loraDialogWidth,
  loraDialogHeaderOrder,
  getLoraDialogListStyle,
  tagDialogItemBackground,
  tagDialogItemActiveBackground,
  tagDialogItemHoverBackground,
  selectTriggerButtonHeight,
  getFrequencyLabelStyle,
  getTagDialogListStyle,
  resolveLoraDialogItemBackground,
  resolveTagDialogItemBackground,
  splitLoraLabel,
  getHighlightSegments,
  getLoraPreviewPanelStyle,
  focusInputLater,
  resolveActiveIndex,
  resolveOption,
  resolveNoneOptionIndex,
  resolveSameNameLoraIndex,
  loraDialogSelectedIconPath,
  loraDialogSelectedIconSize,
  loraDialogOpenFolderIconPath,
  loraDialogOpenFolderIconSize,
  resetIconPath,
  trashIconPath,
  resolvePopupPosition,
  resolveBelowCenteredPopupPosition,
  resolveInlineControlLayout,
  resolveFixedLabelWidth,
  strengthRangeInputClass,
  strengthRangeThumbSize,
  strengthRangeTrackHeight,
  buildStrengthRangeProgressBackground,
  buildStrengthRangeCss,
  resolveCenteredY,
  resolveRowLineHeight,
  resolveToggleSize,
  resolveToggleLabelRect,
  shouldCloseDialogOnOverlayClick,
  resolveStrengthDefault,
  shouldCloseStrengthPopupOnRelease,
  shouldCloseStrengthPopupOnPress,
  shouldCloseStrengthPopupOnInnerClick,
  shouldToggleTagSelectionOnKey,
  shouldBlurTagFilterOnKey,
};
