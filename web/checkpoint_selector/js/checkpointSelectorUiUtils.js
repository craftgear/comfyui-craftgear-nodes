import { normalizeCheckpointFontSize } from './checkpointSelectorSettings.js';

const ACTIVE_ROW_BACKGROUND = '#2f4363';
const HOVER_ROW_BACKGROUND = '#2b2b2b';
const DEFAULT_ROW_BACKGROUND = '#1f1f1f';
const CHECKPOINT_DIALOG_ITEM_BACKGROUND = 'transparent';
const CHECKPOINT_DIALOG_ITEM_HOVER_BACKGROUND = '#2a2a2a';
const CHECKPOINT_DIALOG_ITEM_SELECTED_BACKGROUND = '#424242';
const CHECKPOINT_DIALOG_MATCH_TEXT_COLOR = '#f2d28b';
const CHECKPOINT_DIALOG_MATCH_FONT_WEIGHT = '600';
const CHECKPOINT_MIN_FONT_SIZE = 8;
export const CHECKPOINT_ACTIVE_RADIO_COLOR = '#ffffff';
const checkpointDialogSelectedIconPath =
  'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 12l2 2l4 -4';
const checkpointDialogSelectedIconSize = 19.2;
const checkpointDialogOpenFolderIconPath =
  'M13.5 6a.5.5 0 0 0 .5-.5A1.5 1.5 0 0 0 12.5 4h-5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 5 2H1.5A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h11.1a1.49 1.49 0 0 0 1.42-1.03l1.77-5.32a.5.5 0 0 0-.474-.658h-10.8a.75.75 0 0 0-.712.513l-1.83 5.49h-.5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h3.5l.9 1.2c.378.504.97.8 1.6.8h5c.276 0 .5.224.5.5s.224.5.5.5z';
const checkpointDialogOpenFolderIconSize = 19.2;
const checkpointDialogWidth = '65vw';
const checkpointDialogHeight = '70vh';
const checkpointDialogMaxWidth = '90vw';
const checkpointDialogPreviewWidth = 360;
const checkpointDialogPreviewPadding = 0;

const ensureHiddenBehavior = (widget) => {
  if (!widget || widget.__checkpointSelectorHiddenWrapped) {
    return;
  }
  widget.__checkpointSelectorOriginalComputeSize = widget.computeSize;
  widget.computeSize = (width) => {
    if (widget.__checkpointSelectorHidden) {
      return [width ?? 0, 0];
    }
    if (
      widget.__checkpointSelectorOriginalComputeSize &&
      widget.__checkpointSelectorOriginalComputeSize !== widget.computeSize
    ) {
      return widget.__checkpointSelectorOriginalComputeSize(width);
    }
    return [width ?? 0, 20];
  };
  widget.__checkpointSelectorHiddenWrapped = true;
};

export const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  ensureHiddenBehavior(widget);
  widget.__checkpointSelectorHidden = hidden;
  if (widget.inputEl) {
    widget.inputEl.style.display = hidden ? 'none' : '';
  }
  widget.hidden = hidden;
  if (widget.__checkpointSelectorKeepSerialization) {
    widget.serialize = true;
  }
};

export const enforceSingleActiveSlot = (slots, targetIndex) =>
  slots.map((slot, index) => ({ ...slot, active: index === targetIndex }));

export const resolveActiveSlotIndex = (slots) => {
  const found = slots.findIndex((slot) => slot?.active);
  if (found >= 0) {
    return found;
  }
  return 0;
};

export const resolveRowBackground = ({ active, hover }) => {
  if (active) {
    return ACTIVE_ROW_BACKGROUND;
  }
  if (hover) {
    return HOVER_ROW_BACKGROUND;
  }
  return DEFAULT_ROW_BACKGROUND;
};

export const resolveCheckpointRowLabelFont = (_active, baseSize = 12) => {
  const safeSize = Math.max(CHECKPOINT_MIN_FONT_SIZE, Number(baseSize) || 12);
  return `normal ${safeSize}px "Inter", system-ui, sans-serif`;
};

export const resolveCheckpointDialogItemBackground = (isSelected, isHovered) => {
  if (isSelected) {
    return CHECKPOINT_DIALOG_ITEM_SELECTED_BACKGROUND;
  }
  if (isHovered) {
    return CHECKPOINT_DIALOG_ITEM_HOVER_BACKGROUND;
  }
  return CHECKPOINT_DIALOG_ITEM_BACKGROUND;
};

export const filterCheckpointOptions = (options, query) => {
  const list = Array.isArray(options) ? options : [];
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) {
    return [...list];
  }
  return list.filter((item) => String(item).toLowerCase().includes(normalized));
};

export const normalizeCheckpointDialogFilterValue = (value) =>
  String(value ?? '').trim();

export const getCheckpointHighlightSegments = (text, query) => {
  const source = String(text ?? '');
  const rawQuery = normalizeCheckpointDialogFilterValue(query);
  if (!rawQuery) {
    return [{ text: source, isMatch: false }];
  }
  const lowerSource = source.toLowerCase();
  const lowerQuery = rawQuery.toLowerCase();
  const segments = [];
  let cursor = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({
        text: source.slice(cursor, matchIndex),
        isMatch: false,
      });
    }
    const matchEnd = matchIndex + lowerQuery.length;
    segments.push({
      text: source.slice(matchIndex, matchEnd),
      isMatch: true,
    });
    cursor = matchEnd;
    matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), isMatch: false });
  }
  return segments.length > 0 ? segments : [{ text: source, isMatch: false }];
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

export const resolveZoomBackgroundPosition = (
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

export const resolveCheckpointLabel = (raw) => {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) {
    return 'None';
  }
  return text;
};

export const resolveCheckpointFontSizes = (value) => {
  const normalized = normalizeCheckpointFontSize(value);
  const safeBase = Math.max(CHECKPOINT_MIN_FONT_SIZE, Math.round(normalized));
  const heading = Math.max(CHECKPOINT_MIN_FONT_SIZE, Math.round(safeBase * 0.875));
  const small = Math.max(CHECKPOINT_MIN_FONT_SIZE, Math.round(safeBase * 0.75));
  return { base: safeBase, heading, small };
};

export const isPointInRect = (pos, rect) => {
  if (!rect || !Array.isArray(pos)) {
    return false;
  }
  const [x, y] = pos;
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
};

export const markDirty = (node) => {
  if (typeof node?.setDirtyCanvas === 'function') {
    node.setDirtyCanvas(true, true);
    return;
  }
  if (node?.graph?.setDirtyCanvas) {
    node.graph.setDirtyCanvas(true, true);
  }
};

const isFilledValue = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  const text = String(value).trim();
  if (!text) {
    return false;
  }
  return true;
};

export const updateVisibleSlots = (state) => {
  const { slots, node } = state;
  if (!Array.isArray(slots) || slots.length === 0) {
    return;
  }
  let lastFilled = -1;
  slots.forEach((slot, index) => {
    if (isFilledValue(slot.ckptWidget?.value)) {
      lastFilled = index;
    }
  });
  const visibleUntil = Math.min(slots.length - 1, (lastFilled < 0 ? 0 : lastFilled + 1));
  let changed = false;
  slots.forEach((slot, index) => {
    // 元ウィジェットは常に非表示のままにし、行だけを出し入れする
    setWidgetHidden(slot.ckptWidget, true);
    setWidgetHidden(slot.activeWidget, true);
    const shouldHideRow = index > visibleUntil;
    if (!!slot.rowWidget?.hidden !== shouldHideRow) {
      slot.rowWidget.hidden = shouldHideRow;
      changed = true;
    }
  });
  if (changed) {
    markDirty(node);
  }
};

export {
  CHECKPOINT_DIALOG_MATCH_TEXT_COLOR,
  CHECKPOINT_DIALOG_MATCH_FONT_WEIGHT,
  checkpointDialogSelectedIconPath,
  checkpointDialogSelectedIconSize,
  checkpointDialogOpenFolderIconPath,
  checkpointDialogOpenFolderIconSize,
  checkpointDialogWidth,
  checkpointDialogHeight,
  checkpointDialogMaxWidth,
  checkpointDialogPreviewWidth,
  checkpointDialogPreviewPadding,
};
