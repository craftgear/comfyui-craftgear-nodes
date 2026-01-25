import { api } from '../../../../scripts/api.js';
import { app } from '../../../../scripts/app.js';
import { $el } from '../../../../scripts/ui.js';
import {
  CHECKPOINT_PREVIEW_ZOOM_SCALE_SETTING_ID,
  CHECKPOINT_FONT_SIZE_SETTING_ID,
  normalizeCheckpointPreviewZoomScale,
} from './checkpointSelectorSettings.js';
import {
  CHECKPOINT_DIALOG_MATCH_FONT_WEIGHT,
  CHECKPOINT_DIALOG_MATCH_TEXT_COLOR,
  checkpointDialogHeight,
  checkpointDialogMaxWidth,
  checkpointDialogOpenFolderIconPath,
  checkpointDialogOpenFolderIconSize,
  checkpointDialogPreviewPadding,
  checkpointDialogPreviewWidth,
  checkpointDialogSelectedIconPath,
  checkpointDialogSelectedIconSize,
  checkpointDialogWidth,
  enforceSingleActiveSlot,
  getCheckpointHighlightSegments,
  isPointInRect,
  markDirty,
  normalizeCheckpointDialogFilterValue,
  resolveActiveSlotIndex,
  resolveCheckpointDialogItemBackground,
  resolveCheckpointRowLabelFont,
  resolveRowBackground,
  resolveCheckpointLabel,
  resolveZoomBackgroundPosition,
  resolveCheckpointFontSizes,
  resolveSelectedCheckpointLabels,
  CHECKPOINT_ACTIVE_RADIO_COLOR,
  setWidgetHidden,
  updateVisibleSlots,
} from './checkpointSelectorUiUtils.js';
import {
  buildCheckpointSavedValues,
  resolveSavedCheckpointValue,
  resolveSavedStride,
} from './checkpointSelectorSavedValuesUtils.js';

const TARGET_NODE_CLASS = 'CheckpointSelector';
const ROW_HEIGHT = 22;
const ROW_PADDING_X = 12;
const RADIO_SIZE = 11;
const ROW_GAP = 1;
const SIDE_MARGIN = 8;
const DIALOG_ID = 'craftgear-checkpoint-selector-dialog';
const MIN_NODE_HEIGHT = 60;
const LABEL_RADIUS = 6;
const LABEL_TEXT_PADDING_X = 6;
const LABEL_TEXT_PADDING_Y = 2;
let dialogKeydownHandler = null;

export const releaseCanvasInteraction = () => {
  const canvas = app?.canvas || globalThis?.app?.canvas;
  if (!canvas) {
    return;
  }
  canvas.node_capturing_input = null;
  canvas.node_dragged = null;
  canvas.dragging_canvas = false;
};

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) =>
  node.widgets?.find((widget) => widget.name === name);

const getCheckpointOptions = (widget) => {
  const raw = widget?.options?.values;
  if (Array.isArray(raw)) {
    return raw;
  }
  return [];
};

const getCheckpointFontSizes = () => {
  const value = app?.extensionManager?.setting?.get?.(
    CHECKPOINT_FONT_SIZE_SETTING_ID,
  );
  return resolveCheckpointFontSizes(value);
};

const setWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  widget.value = value;
  if (typeof widget.callback === 'function') {
    widget.callback(value);
  }
};

const ensureEmptyOption = (widget) => {
  const values = widget?.options?.values;
  if (!Array.isArray(values)) {
    return;
  }
  if (values.includes('')) {
    return;
  }
  widget.options = { ...widget.options, values: [''].concat(values) };
};

const clearCheckpointSelection = (slot, state) => {
  if (!slot?.ckptWidget || !slot?.activeWidget) {
    return;
  }
  ensureEmptyOption(slot.ckptWidget);
  setWidgetValue(slot.ckptWidget, '');
  slot.ckptWidget.value = '';
  if ('last_value' in slot.ckptWidget) {
    slot.ckptWidget.last_value = '';
  }
  setWidgetValue(slot.activeWidget, false);
  updateVisibleSlots(state);
  resizeNodeToRows(state);
  markDirty(state.node);
};

const applySavedValues = (state, savedValues) => {
  const stride = resolveSavedStride(savedValues, state.slots.length);
  if (stride === 0) {
    return;
  }
  state.slots.forEach((slot, index) => {
    const base = index * stride;
    if (base >= savedValues.length) {
      return;
    }
    const options = getCheckpointOptions(slot.ckptWidget);
    ensureEmptyOption(slot.ckptWidget);
    const resolved = resolveSavedCheckpointValue(savedValues[base], options);
    setWidgetValue(slot.ckptWidget, resolved);
    slot.ckptWidget.value = resolved;
    if ('last_value' in slot.ckptWidget) {
      slot.ckptWidget.last_value = resolved;
    }
    if (stride > 1) {
      const activeValue = !!savedValues[base + 1];
      setWidgetValue(slot.activeWidget, activeValue);
      slot.activeWidget.value = activeValue;
    }
  });
  updateVisibleSlots(state);
  resizeNodeToRows(state);
};

const buildSlots = (node) => {
  const slots = [];
  for (let index = 1; index <= 20; index += 1) {
    const ckptWidget = getWidget(node, `ckpt_name_${index}`);
    const activeWidget = getWidget(node, `slot_active_${index}`);
    if (!ckptWidget || !activeWidget) {
      continue;
    }
    ckptWidget.__checkpointSelectorKeepSerialization = true;
    activeWidget.__checkpointSelectorKeepSerialization = true;
    slots.push({
      index,
      ckptWidget,
      activeWidget,
      rowWidget: null,
      hover: false,
    });
  }
  return slots;
};

const insertBeforeWidget = (node, targetWidget, widgets) => {
  const list = node.widgets || [];
  widgets.forEach((widget) => {
    const index = list.indexOf(widget);
    if (index >= 0) {
      list.splice(index, 1);
    }
  });
  const targetIndex = list.indexOf(targetWidget);
  if (targetIndex < 0) {
    list.unshift(...widgets);
    return;
  }
  list.splice(targetIndex, 0, ...widgets);
};

const resizeNodeToRows = (state) => {
  const visibleRows = state.slots.filter((slot) => !slot.rowWidget?.hidden);
  const rowsHeight = visibleRows.length * (ROW_HEIGHT + ROW_GAP);
  const padding = 12;
  const height = Math.max(MIN_NODE_HEIGHT, rowsHeight + padding);
  const width = Math.max(180, state.node.size?.[0] ?? 180);
  state.node.size = [width, height];
};

const fitText = (ctx, text, maxWidth) => {
  const raw = String(text ?? '');
  if (!maxWidth || ctx.measureText(raw).width <= maxWidth) {
    return raw;
  }
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  let trimmed = raw;
  while (trimmed.length > 0) {
    trimmed = trimmed.slice(0, -1);
    if (ctx.measureText(trimmed).width + ellipsisWidth <= maxWidth) {
      return `${trimmed}${ellipsis}`;
    }
  }
  return ellipsis;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

const drawRadio = (ctx, x, y, active) => {
  ctx.save();
  ctx.strokeStyle = '#c7d1ec';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + RADIO_SIZE / 2, y + RADIO_SIZE / 2, RADIO_SIZE / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (active) {
    ctx.fillStyle = CHECKPOINT_ACTIVE_RADIO_COLOR;
    ctx.beginPath();
    ctx.arc(x + RADIO_SIZE / 2, y + RADIO_SIZE / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const createRowWidget = (slot, state) => {
  const widget = {
    type: 'custom',
    __checkpointSelectorKind: 'row',
    name: `checkpoint_selector_row_${slot.index}`,
    serialize: false,
    __checkpointSelectorCustomSize: true,
    draw(ctx, _node, width, y) {
      slot.__lastWidth = width ? Math.max(0, width - SIDE_MARGIN * 2) : 0;
      const active = !!slot.activeWidget?.value;
      const background = resolveRowBackground({
        active,
        hover: slot.hover,
      });
      const { base: fontSize } = getCheckpointFontSizes();
      ctx.save();
      ctx.fillStyle = background;
      // 背景塗りつぶしをなくし、親のキャンバス背景をそのまま見せる
      // ctx.fillRect(SIDE_MARGIN, y, slot.__lastWidth, ROW_HEIGHT);
      const radioX = SIDE_MARGIN + ROW_PADDING_X;
      const radioY = y + (ROW_HEIGHT - RADIO_SIZE) / 2;
      drawRadio(ctx, radioX, radioY, active);
      const labelX = radioX + RADIO_SIZE + 8;
      const widgetWidth = Math.max(60, slot.__lastWidth - (labelX - SIDE_MARGIN) - 6);
      const labelRect = {
        x: labelX,
        y: y + LABEL_TEXT_PADDING_Y,
        width: widgetWidth,
        height: ROW_HEIGHT - LABEL_TEXT_PADDING_Y * 2,
      };
      // LoRAラベルと同じダーク角丸ボックス＋枠線＋省略表示
      drawRoundedRect(
        ctx,
        labelRect.x,
        labelRect.y,
        labelRect.width,
        labelRect.height,
        LABEL_RADIUS,
      );
      ctx.fillStyle = '#242424';
      ctx.fill();
      ctx.strokeStyle = '#3a3a3a';
      ctx.stroke();
      ctx.fillStyle = active ? '#eaf0ff' : '#d0d0d0';
      ctx.font = resolveCheckpointRowLabelFont(active, fontSize);
      ctx.textBaseline = 'middle';
      const label = resolveCheckpointLabel(slot.ckptWidget?.value);
      const textX = labelRect.x + LABEL_TEXT_PADDING_X;
      const maxTextWidth = Math.max(0, labelRect.width - LABEL_TEXT_PADDING_X * 2);
      ctx.fillText(
        fitText(ctx, label, maxTextWidth),
        textX,
        labelRect.y + labelRect.height / 2,
      );
      ctx.restore();
      slot.__hitRadio = { x: radioX, y, width: RADIO_SIZE, height: ROW_HEIGHT };
      slot.__hitRow = { x: SIDE_MARGIN, y, width: slot.__lastWidth, height: ROW_HEIGHT };
      slot.__hitDialog = {
        x: labelX - 4,
        y,
        width: slot.__lastWidth - labelX,
        height: ROW_HEIGHT,
      };
    },
    computeSize(width) {
      if (widget.hidden) {
        return [0, 0];
      }
      return [width ?? 0, ROW_HEIGHT + ROW_GAP];
    },
    mouse(event, pos) {
      return handleRowMouse(event, pos, slot, state);
    },
    onMouseDown(event, pos) {
      return handleRowMouse(event, pos, slot, state);
    },
  };
  return widget;
};

const setActiveSlot = (state, targetIndex) => {
  const next = enforceSingleActiveSlot(
    state.slots.map((slot) => ({ active: !!slot.activeWidget?.value })),
    targetIndex,
  );
  next.forEach((slotState, index) => {
    const slot = state.slots[index];
    const value = !!slotState.active;
    setWidgetValue(slot.activeWidget, value);
    slot.activeWidget.value = value;
  });
  markDirty(state.node);
};

const getCheckpointPreviewZoomScale = () => {
  const value = app?.extensionManager?.setting?.get?.(
    CHECKPOINT_PREVIEW_ZOOM_SCALE_SETTING_ID,
  );
  return normalizeCheckpointPreviewZoomScale(value);
};

const fetchCheckpointPreviewUrl = async (checkpointName) => {
  if (!checkpointName || checkpointName === 'None') {
    return null;
  }
  const response = await api.fetchApi('/my_custom_node/checkpoint_preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkpoint_name: checkpointName }),
  });
  if (!response.ok) {
    return null;
  }
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.startsWith('image/')) {
    return null;
  }
  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    return null;
  }
  return URL.createObjectURL(blob);
};

const openCheckpointFolder = async (checkpointName) => {
  const response = await api.fetchApi('/my_custom_node/open_checkpoint_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkpoint_name: checkpointName }),
  });
  return response.ok;
};

const closeDialog = () => {
  const existing = document.getElementById(DIALOG_ID);
  if (existing) {
    const cleanup = existing.__checkpointSelectorCleanup;
    if (typeof cleanup === 'function') {
      cleanup();
    }
    existing.remove();
    releaseCanvasInteraction();
  }
  if (dialogKeydownHandler) {
    document.removeEventListener('keydown', dialogKeydownHandler, true);
    dialogKeydownHandler = null;
  }
};

const openDialog = (slot, state) => {
  closeDialog();
  releaseCanvasInteraction();
  const options = getCheckpointOptions(slot.ckptWidget);
  const currentValue = slot.ckptWidget?.value ?? '';
  const currentOptionIndex = options.findIndex((option) => option === currentValue);
  const selectedLabels = resolveSelectedCheckpointLabels(state.slots);
  let selectedOptionIndex = currentOptionIndex;
  let selectedVisibleIndex = -1;
  let hoveredVisibleIndex = -1;
  let visibleOptions = [];
  let renderedButtons = [];
  let previewObjectUrl = null;
  let previewRequestToken = 0;
  let previewImageNaturalSize = { width: 0, height: 0 };
  let previewZoomActive = false;
  let previewZoomRaf = null;
  let previewZoomPoint = null;
  let lastPreviewLabel = '';
  let isFilterComposing = false;
  const previewZoomScale = getCheckpointPreviewZoomScale();
  const isPreviewZoomEnabled = previewZoomScale > 1;
  const fontSizes = getCheckpointFontSizes();

  const overlay = $el('div', {
    id: DIALOG_ID,
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.6)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  overlay.addEventListener('mousedown', (event) => {
    if (event.target !== overlay) {
      return;
    }
    closeDialog();
  });
  const dialogShell = $el('div', {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '0',
      height: checkpointDialogHeight,
      maxWidth: checkpointDialogMaxWidth,
    },
  });
  const previewPanel = $el('div', {
    style: {
      width: `${checkpointDialogPreviewWidth}px`,
      padding: `${checkpointDialogPreviewPadding}px`,
      background: 'transparent',
      border: '1px solid #2a2a2a',
      borderRadius: '8px 0 0 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      position: 'relative',
      overflow: 'hidden',
    },
  });
  const previewImage = $el('img', {
    style: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      display: 'none',
      position: 'relative',
      zIndex: '0',
    },
  });
  const previewZoomLayer = $el('div', {
    style: {
      position: 'absolute',
      inset: '0',
      display: 'none',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      pointerEvents: 'none',
      zIndex: '1',
    },
  });
  const previewPlaceholder = $el('div', {
    textContent: 'No preview',
    style: {
      fontSize: `${fontSizes.small}px`,
      opacity: 0.6,
      textAlign: 'center',
    },
  });
  previewPanel.append(previewImage, previewZoomLayer, previewPlaceholder);
  const panel = $el('div', {
    style: {
      background: '#1e1e1e',
      borderRadius: '0 8px 8px 0',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      color: '#e6e6e6',
      fontFamily: 'sans-serif',
      width: checkpointDialogWidth,
      height: '100%',
      fontSize: `${fontSizes.base}px`,
    },
  });
  const header = $el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
  });
  const search = $el('input', {
    type: 'text',
    placeholder: 'Search checkpoints',
    style: {
      width: '100%',
      padding: '8px 10px',
      borderRadius: '6px',
      border: '1px solid #3a3a3a',
      background: '#121212',
      color: '#f0f0f0',
      boxSizing: 'border-box',
      fontSize: `${fontSizes.base}px`,
    },
  });
  search.addEventListener('compositionstart', () => {
    isFilterComposing = true;
  });
  search.addEventListener('compositionend', () => {
    isFilterComposing = false;
  });
  const closeButton = $el('button', {
    innerText: 'Close',
    style: {
      border: '1px solid #444',
      borderRadius: '6px',
      background: '#2b2b2b',
      color: '#f5f5f5',
      padding: '6px 10px',
      cursor: 'pointer',
      flex: '0 0 auto',
      fontSize: `${fontSizes.base}px`,
    },
  });
  closeButton.onclick = () => closeDialog();
  header.append(search, closeButton);
  const list = $el('div', {
    style: {
      overflow: 'auto',
      flex: '1 1 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '6px',
      background: '#1f1f1f',
      border: '1px solid #2a2a2a',
      borderRadius: '6px',
      fontSize: `${fontSizes.base}px`,
    },
  });
  panel.append(header, list);
  dialogShell.append(previewPanel, panel);
  overlay.append(dialogShell);
  document.body.append(overlay);
  overlay.__checkpointSelectorCleanup = () => {
    previewRequestToken += 1;
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    if (previewZoomRaf !== null) {
      cancelAnimationFrame(previewZoomRaf);
      previewZoomRaf = null;
    }
    previewZoomPoint = null;
  };

  const focusInputLater = () => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => search.focus());
      return;
    }
    setTimeout(() => search.focus(), 0);
  };

  const resolvePreviewImageLayout = () => {
    const rect = previewPanel?.getBoundingClientRect?.();
    const containerWidth = Math.max(0, Number(rect?.width) || 0);
    const containerHeight = Math.max(0, Number(rect?.height) || 0);
    if (containerWidth === 0 || containerHeight === 0) {
      return null;
    }
    const naturalWidth = Math.max(0, Number(previewImageNaturalSize.width) || 0);
    const naturalHeight = Math.max(0, Number(previewImageNaturalSize.height) || 0);
    if (naturalWidth === 0 || naturalHeight === 0) {
      return {
        container: { width: containerWidth, height: containerHeight },
        content: {
          width: containerWidth,
          height: containerHeight,
          offsetX: 0,
          offsetY: 0,
        },
      };
    }
    const scale = Math.min(
      containerWidth / naturalWidth,
      containerHeight / naturalHeight,
    );
    const contentWidth = naturalWidth * scale;
    const contentHeight = naturalHeight * scale;
    return {
      container: { width: containerWidth, height: containerHeight },
      content: {
        width: contentWidth,
        height: contentHeight,
        offsetX: (containerWidth - contentWidth) / 2,
        offsetY: (containerHeight - contentHeight) / 2,
      },
    };
  };

  const applyPreviewZoomPosition = () => {
    if (!previewZoomActive || !previewZoomPoint) {
      return;
    }
    const layout = resolvePreviewImageLayout();
    if (!layout) {
      return;
    }
    const { container, content } = layout;
    const position = resolveZoomBackgroundPosition(
      previewZoomPoint,
      container,
      content,
      previewZoomScale,
    );
    previewZoomLayer.style.backgroundSize = `${content.width * previewZoomScale}px ${content.height * previewZoomScale}px`;
    previewZoomLayer.style.backgroundPosition = `${position.x}px ${position.y}px`;
  };

  const schedulePreviewZoomUpdate = () => {
    if (previewZoomRaf !== null) {
      return;
    }
    previewZoomRaf = requestAnimationFrame(() => {
      previewZoomRaf = null;
      applyPreviewZoomPosition();
    });
  };

  const setPreviewZoomActive = (nextActive) => {
    const shouldActivate = Boolean(nextActive);
    if (previewZoomActive === shouldActivate) {
      return;
    }
    previewZoomActive = shouldActivate;
    if (!previewZoomActive) {
      previewZoomLayer.style.display = 'none';
      previewZoomLayer.style.backgroundPosition = '0 0';
      previewImage.style.opacity = '1';
      return;
    }
    previewZoomLayer.style.display = 'block';
    previewImage.style.opacity = '0';
    schedulePreviewZoomUpdate();
  };

  const recordPreviewZoomPoint = (event) => {
    const rect = previewPanel?.getBoundingClientRect?.();
    if (!rect) {
      return;
    }
    previewZoomPoint = {
      x: Number(event?.clientX) - rect.left,
      y: Number(event?.clientY) - rect.top,
    };
  };

  const setPreviewUrl = (url) => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    previewObjectUrl = url;
    previewImageNaturalSize = { width: 0, height: 0 };
    setPreviewZoomActive(false);
    if (previewObjectUrl) {
      previewImage.src = previewObjectUrl;
      previewImage.style.display = 'block';
      previewImage.style.opacity = '1';
      previewZoomLayer.style.backgroundImage = `url("${previewObjectUrl}")`;
      previewPlaceholder.style.display = 'none';
      return;
    }
    previewZoomLayer.style.backgroundImage = '';
    previewImage.removeAttribute('src');
    previewImage.style.display = 'none';
    previewPlaceholder.style.display = 'block';
  };

  const handlePreviewMouseEnter = (event) => {
    if (!previewObjectUrl) {
      return;
    }
    if (!isPreviewZoomEnabled) {
      return;
    }
    recordPreviewZoomPoint(event);
    if (previewImageNaturalSize.width > 0 && previewImageNaturalSize.height > 0) {
      setPreviewZoomActive(true);
    }
  };

  const handlePreviewMouseMove = (event) => {
    if (!previewObjectUrl) {
      return;
    }
    if (!isPreviewZoomEnabled) {
      return;
    }
    recordPreviewZoomPoint(event);
    if (!previewZoomActive) {
      if (previewImageNaturalSize.width === 0 || previewImageNaturalSize.height === 0) {
        return;
      }
      setPreviewZoomActive(true);
    }
    schedulePreviewZoomUpdate();
  };

  const handlePreviewMouseLeave = () => {
    previewZoomPoint = null;
    setPreviewZoomActive(false);
  };

  previewPanel.addEventListener('mouseenter', handlePreviewMouseEnter);
  previewPanel.addEventListener('mousemove', handlePreviewMouseMove);
  previewPanel.addEventListener('mouseleave', handlePreviewMouseLeave);
  previewImage.addEventListener('load', () => {
    if (!previewObjectUrl || previewImage.src !== previewObjectUrl) {
      return;
    }
    previewImageNaturalSize = {
      width: previewImage.naturalWidth,
      height: previewImage.naturalHeight,
    };
    if (isPreviewZoomEnabled && previewPanel?.matches?.(':hover') && previewZoomPoint) {
      setPreviewZoomActive(true);
    }
  });

  const updatePreviewForLabel = async (label) => {
    const normalized = typeof label === 'string' ? label.trim() : '';
    if (!normalized || normalized === 'None') {
      lastPreviewLabel = '';
      setPreviewUrl(null);
      return;
    }
    if (normalized === lastPreviewLabel) {
      return;
    }
    lastPreviewLabel = normalized;
    const requestId = (previewRequestToken += 1);
    const previewUrl = await fetchCheckpointPreviewUrl(normalized);
    if (requestId !== previewRequestToken) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      return;
    }
    setPreviewUrl(previewUrl);
  };

  const updatePreviewByVisibleIndex = (index) => {
    if (!Number.isFinite(index)) {
      return;
    }
    const entry = visibleOptions[index];
    if (!entry?.label) {
      setPreviewUrl(null);
      return;
    }
    void updatePreviewForLabel(entry.label);
  };

  const createSelectedIcon = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(checkpointDialogSelectedIconSize));
    svg.setAttribute('height', String(checkpointDialogSelectedIconSize));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', checkpointDialogSelectedIconPath);
    svg.append(path);
    return svg;
  };

  const createOpenFolderIcon = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(checkpointDialogOpenFolderIconSize));
    svg.setAttribute('height', String(checkpointDialogOpenFolderIconSize));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', checkpointDialogOpenFolderIconPath);
    svg.append(path);
    return svg;
  };

  const renderLabel = (labelContainer, displayLabel, query) => {
    const segments = getCheckpointHighlightSegments(displayLabel, query);
    labelContainer.textContent = '';
    segments.forEach((segment) => {
      if (!segment.text) {
        return;
      }
      const span = document.createElement('span');
      span.textContent = segment.text;
      if (segment.isMatch) {
        span.style.color = CHECKPOINT_DIALOG_MATCH_TEXT_COLOR;
        span.style.fontWeight = CHECKPOINT_DIALOG_MATCH_FONT_WEIGHT;
      }
      labelContainer.append(span);
    });
  };

  const applySelection = (nextLabel) => {
    if (String(nextLabel ?? '').trim() === '') {
      clearCheckpointSelection(slot, state);
      closeDialog();
      return;
    }
    setWidgetValue(slot.ckptWidget, nextLabel);
    setActiveSlot(state, slot.index - 1);
    markDirty(state.node);
    closeDialog();
  };

  const applySelectedLabel = () => {
    if (selectedVisibleIndex < 0 || selectedVisibleIndex >= visibleOptions.length) {
      return;
    }
    const nextLabel = visibleOptions[selectedVisibleIndex]?.label;
    if (nextLabel === undefined) {
      return;
    }
    applySelection(nextLabel);
  };

  const refreshButtonStates = () => {
    renderedButtons.forEach((entry, index) => {
      const isSelected = index === selectedVisibleIndex;
      const isHovered = index === hoveredVisibleIndex;
      const isActive = isSelected || isHovered;
      entry.button.style.background = resolveCheckpointDialogItemBackground(
        isSelected,
        isHovered,
      );
      entry.iconWrap.style.opacity = entry.isSelectedLabel ? '1' : '0';
      entry.openIconWrap.style.opacity =
        entry.isOpenable && isActive ? '1' : '0';
      entry.openIconWrap.style.pointerEvents =
        entry.isOpenable && isActive ? 'auto' : 'none';
    });
  };

  const scrollSelectedIntoView = () => {
    const entry = renderedButtons[selectedVisibleIndex];
    entry?.button?.scrollIntoView?.({ block: 'nearest' });
  };

  const moveSelection = (direction) => {
    if (visibleOptions.length === 0) {
      return;
    }
    const baseIndex = selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0;
    const step = direction < 0 ? -1 : 1;
    let nextIndex = baseIndex + step;
    if (nextIndex < 0) {
      nextIndex = visibleOptions.length - 1;
    }
    if (nextIndex >= visibleOptions.length) {
      nextIndex = 0;
    }
    selectedVisibleIndex = nextIndex;
    selectedOptionIndex = visibleOptions[nextIndex].index;
    hoveredVisibleIndex = -1;
    refreshButtonStates();
    scrollSelectedIntoView();
    updatePreviewByVisibleIndex(selectedVisibleIndex);
  };

  const renderList = () => {
    list.textContent = '';
    renderedButtons = [];
    hoveredVisibleIndex = -1;
    const normalizedQuery = normalizeCheckpointDialogFilterValue(search.value);
    visibleOptions = options
      .map((label, index) => ({
        index,
        label,
        displayLabel: resolveCheckpointLabel(label),
      }))
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }
        return entry.displayLabel
          .toLowerCase()
          .includes(normalizedQuery.toLowerCase());
      });
    if (visibleOptions.length === 0) {
      selectedVisibleIndex = -1;
      list.append(
        $el('div', {
          textContent: 'No matches.',
          style: { opacity: 0.7, padding: '8px', fontSize: `${fontSizes.base}px` },
        }),
      );
      setPreviewUrl(null);
      return;
    }
    selectedVisibleIndex = visibleOptions.findIndex(
      (entry) => entry.index === selectedOptionIndex,
    );
    if (selectedVisibleIndex < 0) {
      selectedVisibleIndex = 0;
      selectedOptionIndex = visibleOptions[0].index;
    }
    visibleOptions.forEach((entry, index) => {
      const isOpenable =
        typeof entry.label === 'string' && entry.displayLabel !== 'None';
      const button = $el('button', {
        style: {
          textAlign: 'left',
          padding: '6px 8px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: `${fontSizes.base}px`,
        },
      });
      button.style.color = '#e0e0e0';
      const iconWrap = $el('span', {
        style: {
          width: `${checkpointDialogSelectedIconSize}px`,
          height: `${checkpointDialogSelectedIconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          opacity: '0',
        },
      });
      iconWrap.append(createSelectedIcon());
      const labelContainer = $el('span', {
        style: {
          flex: '1 1 auto',
          minWidth: '0',
        },
      });
      renderLabel(labelContainer, entry.displayLabel, normalizedQuery);
      const openIconWrap = $el('span', {
        title: 'Open folder',
        style: {
          width: `${checkpointDialogOpenFolderIconSize}px`,
          height: `${checkpointDialogOpenFolderIconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          marginLeft: 'auto',
          opacity: '0',
          cursor: 'pointer',
          pointerEvents: 'none',
          visibility: isOpenable ? 'visible' : 'hidden',
        },
      });
      openIconWrap.append(createOpenFolderIcon());
      openIconWrap.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isOpenable) {
          return;
        }
        applySelection(entry.label);
        void openCheckpointFolder(entry.label);
      };
      button.append(iconWrap, labelContainer, openIconWrap);
      renderedButtons.push({
        button,
        optionIndex: entry.index,
        iconWrap,
        openIconWrap,
        isOpenable,
        isSelectedLabel: selectedLabels.has(entry.displayLabel),
      });
      button.onmouseenter = () => {
        hoveredVisibleIndex = index;
        refreshButtonStates();
        updatePreviewByVisibleIndex(index);
      };
      button.onmouseleave = () => {
        if (hoveredVisibleIndex !== index) {
          return;
        }
        hoveredVisibleIndex = -1;
        refreshButtonStates();
      };
      button.onclick = () => {
        applySelection(entry.label);
      };
      list.append(button);
    });
    refreshButtonStates();
    scrollSelectedIntoView();
    updatePreviewByVisibleIndex(selectedVisibleIndex);
  };

  const handleDialogKeyDown = (event) => {
    if (event?.__checkpointSelectorDialogHandled) {
      return;
    }
    event.__checkpointSelectorDialogHandled = true;
    const isImeKey =
      event?.key === 'Process' || event?.keyCode === 229 || event?.isComposing;
    if (isImeKey || isFilterComposing) {
      if (event.key === 'Escape') {
        closeDialog();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      applySelectedLabel();
      return;
    }
    if (event.key === 'Escape') {
      closeDialog();
    }
  };

  search.oninput = () => renderList();
  dialogKeydownHandler = handleDialogKeyDown;
  document.addEventListener('keydown', dialogKeydownHandler, true);
  search.addEventListener('keydown', handleDialogKeyDown);
  renderList();
  focusInputLater();
};

const handleRowMouse = (event, pos, slot, state) => {
  if (!Array.isArray(pos)) {
    return false;
  }
  const radioRect = slot.__hitRadio || {
    x: ROW_PADDING_X,
    y: 0,
    width: RADIO_SIZE,
    height: ROW_HEIGHT,
  };
  const dialogRect =
    slot.__hitDialog ||
    ({
      x: ROW_PADDING_X + RADIO_SIZE + 6,
      y: 0,
      width: slot.__lastWidth ?? 200,
      height: ROW_HEIGHT,
    });
  if (isPointInRect(pos, radioRect)) {
    setActiveSlot(state, slot.index - 1);
    if (event) {
      event.__checkpointSelectorHandled = true;
    }
    return true;
  }
  if (isPointInRect(pos, dialogRect)) {
    openDialog(slot, state);
    if (event) {
      event.__checkpointSelectorHandled = true;
    }
    return true;
  }
  return false;
};

const setupNode = (node) => {
  if (!isTargetNode(node) || node.__checkpointSelectorReady) {
    return;
  }
  const slots = buildSlots(node);
  if (slots.length === 0) {
    return;
  }

  const state = {
    node,
    slots,
  };
  slots.forEach((slot) => {
    ensureEmptyOption(slot.ckptWidget);
  });

  const savedValues = node.__checkpointSelectorSavedValues;
  const hasSavedValues = Array.isArray(savedValues);
  if (hasSavedValues) {
    applySavedValues(state, savedValues);
    node.__checkpointSelectorSavedValues = null;
  }
  const activeIndex = resolveActiveSlotIndex(
    slots.map((slot) => ({ active: !!slot.activeWidget?.value })),
  );
  slots.forEach((slot, index) => {
    setWidgetHidden(slot.ckptWidget, true);
    setWidgetHidden(slot.activeWidget, true);
    if (!hasSavedValues) {
      setWidgetValue(slot.activeWidget, index === activeIndex);
    }
    slot.rowWidget = createRowWidget(slot, state);
    const originalCallback = slot.ckptWidget.callback;
    slot.ckptWidget.callback = (value) => {
      if (typeof originalCallback === 'function') {
        originalCallback(value);
      }
      updateVisibleSlots(state);
      resizeNodeToRows(state);
    };
  });

  insertBeforeWidget(
    node,
    slots[0].ckptWidget,
    slots.map((slot) => slot.rowWidget),
  );
  updateVisibleSlots(state);
  resizeNodeToRows(state);

  if (!node.__checkpointSelectorSerializeWrapped) {
    node.__checkpointSelectorSerializeWrapped = true;
    const originalSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      originalSerialize?.apply(this, arguments);
      o.widgets_values = buildCheckpointSavedValues(slots);
    };
  }

  if (!node.__checkpointSelectorConfigureWrapped) {
    node.__checkpointSelectorConfigureWrapped = true;
    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      if (Array.isArray(info?.widgets_values)) {
        node.__checkpointSelectorSavedValues = info.widgets_values;
        if (node.__checkpointSelectorReady) {
          applySavedValues(state, info.widgets_values);
          node.__checkpointSelectorSavedValues = null;
        }
      }
      return originalConfigure?.apply(this, arguments);
    };
  }

  node.__checkpointSelectorReady = true;
  markDirty(node);
};

app.registerExtension({
  name: 'craftgear.checkpointSelector',
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupNode(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupNode(node);
  },
});
