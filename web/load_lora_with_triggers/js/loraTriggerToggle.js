import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';
import { $el } from '../../../../scripts/ui.js';
import { normalizeSavedValues } from './stackUtils.js';
import { formatLabel } from './labelUtils.js';
import { getResizedNodeSize } from './nodeSizeUtils.js';
import { getTagVisibility, getTopNVisibility } from './tagFilterUtils.js';
import { compactSlotValues, isFilledName } from './stackOrderUtils.js';
import { normalizeSelectionValue } from './selectionValueUtils.js';
import { ensureSelectionSerializable } from './selectionSerializeUtils.js';

const SINGLE_NODE_NAME = 'LoadLoraWithTriggers';
const STACK_NODE_NAMES = ['LoadLoraWithTriggersStack', 'load_lora_with_triggers_stack'];
const LORA_WIDGET_NAME = 'lora_name';
const SELECTION_WIDGET_NAME = 'trigger_selection';
const TOGGLE_WIDGET_NAME = 'lora_on';
const LABEL_TARGETS = [LORA_WIDGET_NAME, 'lora_strength', SELECTION_WIDGET_NAME, 'select_trigger'];
const DIALOG_ID = 'my-custom-node-trigger-dialog';
const TOP_N_STORAGE_KEY = 'craftgear-trigger-dialog-top-n';
const MAX_LORA_STACK = 10;
const DEFAULT_LORA_STACK = 1;
const TRASH_ICON_URL = new URL('../../../icons/MaterialSymbolsDelete.svg', import.meta.url).toString();
const TRASH_ICON_SIZE = 12;
const TOGGLE_LEFT_PADDING = 12;
const TOGGLE_LABEL_TEXT = 'Toggle All';
let dialogKeydownHandler = null;

const trashIconImage = new Image();
trashIconImage.src = TRASH_ICON_URL;
trashIconImage.addEventListener('load', () => {
  if (app?.graph) {
    app.graph.setDirtyCanvas(true, true);
  }
});

const getNodeName = (node) => String(node?.comfyClass || node?.type || '');
const isSingleNode = (node) => getNodeName(node).includes(SINGLE_NODE_NAME);
const isStackNode = (node) => {
  const nodeName = getNodeName(node);
  return STACK_NODE_NAMES.some((name) => nodeName.includes(name));
};
const isTargetNode = (node) => isSingleNode(node) || isStackNode(node);
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);
const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  if (!widget.__computeSizeWrapped) {
    widget.__originalComputeSize = widget.computeSize;
    widget.computeSize = (width) => {
      if (widget.__isHidden) {
        return [0, -4];
      }
      if (widget.__originalComputeSize && widget.__originalComputeSize !== widget.computeSize) {
        return widget.__originalComputeSize(width);
      }
      return [width ?? 0, 24];
    };
    widget.__computeSizeWrapped = true;
  } else if (widget.__originalComputeSize === widget.computeSize) {
    widget.__originalComputeSize = null;
  }
  widget.__isHidden = hidden;
  if (widget.inputEl) {
    widget.inputEl.style.display = hidden ? 'none' : '';
  }
  widget.hidden = hidden;
};

const applyReadableLabels = (node) => {
  (node?.widgets ?? []).forEach((widget) => {
    const name = widget?.name ?? '';
    if (!name || !LABEL_TARGETS.some((prefix) => String(name).startsWith(prefix))) {
      return;
    }
    if (widget.__labelNormalized) {
      return;
    }
    widget.label = formatLabel(name);
    widget.__labelNormalized = true;
  });
};

const resizeNodeToWidgets = (node, options = {}) => {
  const size = getResizedNodeSize(node, options);
  if (!size) {
    return;
  }
  if (typeof node.setSize === 'function') {
    node.setSize(size);
    return;
  }
  node.size = size;
};

const normalizeToggleValue = (value) => {
  if (value === false || value === 0) {
    return false;
  }
  return true;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();
};

const drawToggleSwitch = (ctx, rect, isOn, isMixed = false) => {
  const radius = rect.height / 2;
  const knobSize = Math.max(2, rect.height - 4);
  let knobX = rect.x + 2;
  if (isOn) {
    knobX = rect.x + rect.width - knobSize - 2;
  }
  if (isMixed) {
    knobX = rect.x + (rect.width - knobSize) / 2;
  }
  ctx.save();
  ctx.fillStyle = isOn ? '#3ba55d' : '#5a5a5a';
  if (isMixed) {
    ctx.fillStyle = '#6b6b6b';
  }
  drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(
    knobX + knobSize / 2,
    rect.y + rect.height / 2,
    knobSize / 2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
};

const isPointInRect = (pos, rect) => {
  if (!rect || !Array.isArray(pos)) {
    return false;
  }
  const [x, y] = pos;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
};

const drawTrashIcon = (ctx, rect, isActive) => {
  if (!trashIconImage.complete || trashIconImage.naturalWidth === 0) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = isActive ? 0.85 : 0.35;
  ctx.drawImage(trashIconImage, rect.x, rect.y, rect.size, rect.size);
  ctx.restore();
};

const clampNumber = (value, min, max) => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
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

const drawTriangle = (ctx, rect, direction) => {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const size = Math.min(rect.width, rect.height) * 0.35;
  ctx.beginPath();
  if (direction === 'left') {
    ctx.moveTo(centerX + size, centerY - size);
    ctx.lineTo(centerX - size, centerY);
    ctx.lineTo(centerX + size, centerY + size);
  } else {
    ctx.moveTo(centerX - size, centerY - size);
    ctx.lineTo(centerX + size, centerY);
    ctx.lineTo(centerX - size, centerY + size);
  }
  ctx.closePath();
  ctx.fill();
};

const drawStrengthControl = (ctx, rect, valueText) => {
  const arrowWidth = rect.height;
  const valueWidth = Math.max(24, rect.width - arrowWidth * 2);
  const decRect = { x: rect.x, y: rect.y, width: arrowWidth, height: rect.height };
  const valRect = {
    x: rect.x + arrowWidth,
    y: rect.y,
    width: valueWidth,
    height: rect.height,
  };
  const incRect = {
    x: rect.x + arrowWidth + valueWidth,
    y: rect.y,
    width: arrowWidth,
    height: rect.height,
  };
  ctx.save();
  ctx.globalAlpha *= 0.9;
  ctx.fillStyle = '#2b2b2b';
  drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, rect.height / 2);
  ctx.fill();
  ctx.fillStyle = '#f0f0f0';
  drawTriangle(ctx, decRect, 'left');
  drawTriangle(ctx, incRect, 'right');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valueText, valRect.x + valRect.width / 2, valRect.y + valRect.height / 2);
  ctx.restore();
  return { decRect, valRect, incRect };
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

const setComboWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  const options = widget?.options?.values;
  if (Array.isArray(options)) {
    const index = options.indexOf(value);
    if (index >= 0) {
      setWidgetValue(widget, index);
      return;
    }
  }
  setWidgetValue(widget, value);
};

const parseSelection = (selectionText, triggers) => {
  if (!selectionText) {
    return new Set(triggers);
  }
  try {
    const parsed = JSON.parse(selectionText);
    if (!Array.isArray(parsed)) {
      return new Set(triggers);
    }
    return new Set(parsed.map((item) => String(item)));
  } catch (_error) {
    return new Set(triggers);
  }
};

const fetchTriggers = async (loraName) => {
  const response = await api.fetchApi('/my_custom_node/lora_triggers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lora_name: loraName }),
  });
  if (!response.ok) {
    return { triggers: [], frequencies: {} };
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.triggers)) {
    return { triggers: [], frequencies: {} };
  }
  const rawFrequencies = data.frequencies;
  const frequencies =
    rawFrequencies && typeof rawFrequencies === 'object' ? rawFrequencies : {};
  return {
    triggers: data.triggers.map((trigger) => String(trigger)),
    frequencies,
  };
};

const closeDialog = () => {
  const existing = document.getElementById(DIALOG_ID);
  if (existing) {
    existing.remove();
  }
  if (dialogKeydownHandler) {
    document.removeEventListener('keydown', dialogKeydownHandler, true);
    dialogKeydownHandler = null;
  }
};

const showMessage = (message) => {
  closeDialog();
  const overlay = $el('div', {
    id: DIALOG_ID,
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  const panel = $el('div', {
    style: {
      background: '#1e1e1e',
      color: '#e0e0e0',
      padding: '16px',
      borderRadius: '8px',
      minWidth: '280px',
      maxWidth: '60vw',
      fontFamily: 'sans-serif',
    },
  });
  const body = $el('div', { textContent: message, style: { marginBottom: '16px' } });
  const okButton = $el('button', { textContent: 'OK' });
  okButton.onclick = closeDialog;
  panel.append(body, okButton);
  overlay.append(panel);
  document.body.append(overlay);
};

const openTriggerDialog = async (loraName, selectionWidget) => {
  if (!loraName || loraName === 'None') {
    showMessage('Please select a LoRA.');
    return;
  }
  const { triggers, frequencies } = await fetchTriggers(loraName);
  if (triggers.length === 0) {
    showMessage('No trigger words found.');
    return;
  }
  const selected = parseSelection(selectionWidget?.value ?? '', triggers);

  closeDialog();
  const overlay = $el('div', {
    id: DIALOG_ID,
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  const panel = $el('div', {
    style: {
      background: '#1e1e1e',
      color: '#e0e0e0',
      padding: '16px',
      borderRadius: '8px',
      width: '60vw',
      height: '70vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
    },
  });
  const title = $el('div', {
    textContent: 'Trigger words',
    style: { fontSize: '16px', marginBottom: '12px' },
  });
  const topControls = $el('div', {
    style: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '12px',
    },
  });
  const filterInput = $el('input', {
    type: 'text',
    placeholder: 'Filter tags',
    style: { flex: '1 1 auto', paddingRight: '28px' },
  });
  const clearFilterButton = $el('button', {
    textContent: '\u00d7',
    style: {
      position: 'absolute',
      right: '4px',
      top: '50%',
      transform: 'translateY(-50%)',
      padding: '0',
      width: '20px',
      height: '20px',
      fontSize: '16px',
      lineHeight: '1',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      opacity: '0.7',
    },
  });
  const filterContainer = $el('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flex: '1 1 auto',
      marginLeft: '8px',
    },
  });
  filterContainer.append(filterInput, clearFilterButton);
  // 上位N件表示スライダー（保存された値を復元）
  const savedTopN = localStorage.getItem(TOP_N_STORAGE_KEY);
  const initialTopN = savedTopN ? Math.min(Math.max(1, Number(savedTopN)), triggers.length) : triggers.length;
  const topNSlider = $el('input', {
    type: 'range',
    min: '1',
    max: String(triggers.length),
    value: String(initialTopN),
    style: { width: '200px' },
  });
  const topNLabel = $el('span', {
    textContent: `Show top ${initialTopN} tags`,
    style: { minWidth: '130px', fontSize: '12px' },
  });
  const topNContainer = $el('div', {
    style: {
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      marginLeft: '12px',
    },
  });
  topNContainer.append(topNLabel, topNSlider);
  const list = $el('div', {
    style: {
      overflow: 'auto',
      padding: '8px',
      background: '#2a2a2a',
      borderRadius: '6px',
      flex: '1 1 auto',
    },
  });

  const formatFrequency = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return String(value);
    }
    return Number.isInteger(numberValue) ? String(numberValue) : String(numberValue);
  };

  const items = triggers.map((trigger) => {
    const checkbox = $el('input', { type: 'checkbox' });
    checkbox.checked = selected.has(trigger);
    const countText = formatFrequency(frequencies?.[trigger]);
    const countLabel = $el('span', {
      textContent: countText,
      style: { minWidth: '40px', textAlign: 'right', opacity: 0.7 },
    });
    const label = $el('label', {
      style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' },
    });
    label.append(checkbox, countLabel, $el('span', { textContent: trigger }));
    list.append(label);
    return { trigger, checkbox, row: label };
  });

  const actions = $el('div', {
    style: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'space-between',
      marginTop: '12px',
    },
  });
  const leftActions = $el('div', { style: { display: 'flex', gap: '8px' } });
  const rightActions = $el('div', { style: { display: 'flex', gap: '8px' } });
  const selectAllButton = $el('button', { textContent: 'All' });
  const selectNoneButton = $el('button', { textContent: 'None' });
  const applyButton = $el('button', { textContent: 'Apply' });
  const cancelButton = $el('button', { textContent: 'Cancel' });

  const updateVisibleByFilter = (value, topN) => {
    const query = String(value ?? '');
    const tagList = items.map((item) => item.trigger);
    const textVisibility = getTagVisibility(tagList, query);
    const topNValue = Number(topN) || 0;
    const topNVisibility = getTopNVisibility(tagList, frequencies, topNValue);
    items.forEach((item, index) => {
      // 両方のフィルタを満たす場合のみ表示
      const isVisible = (textVisibility[index] ?? true) && (topNVisibility[index] ?? true);
      item.row.style.display = isVisible ? 'flex' : 'none';
      // スライダーで非表示になったタグの選択を解除
      if (!(topNVisibility[index] ?? true)) {
        item.checkbox.checked = false;
      }
    });
  };

  const updateTopNLabel = (value) => {
    const topNValue = Number(value) || 1;
    topNLabel.textContent = `Show top ${topNValue} tags`;
  };

  const updateVisibility = () => {
    const query = filterInput?.value ?? '';
    const topNValue = Number(topNSlider?.value) || triggers.length;
    updateVisibleByFilter(query, topNValue);
    updateTopNLabel(topNValue);
  };

  selectAllButton.onclick = () => {
    items.forEach((item) => {
      if (item.row.style.display !== 'none') {
        item.checkbox.checked = true;
      }
    });
  };
  selectNoneButton.onclick = () => {
    items.forEach((item) => {
      if (item.row.style.display !== 'none') {
        item.checkbox.checked = false;
      }
    });
  };
  cancelButton.onclick = closeDialog;
  applyButton.onclick = () => {
    const selectedTriggers = items.filter((item) => item.checkbox.checked).map((item) => item.trigger);
    if (selectionWidget) {
      selectionWidget.value = JSON.stringify(selectedTriggers);
    }
    app.graph.setDirtyCanvas(true, true);
    closeDialog();
  };
  dialogKeydownHandler = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyButton.click();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelButton.click();
    }
  };
  document.addEventListener('keydown', dialogKeydownHandler, true);

  filterInput.oninput = () => {
    updateVisibility();
  };
  clearFilterButton.onclick = () => {
    filterInput.value = '';
    updateVisibility();
    filterInput.focus();
  };
  topNSlider.oninput = () => {
    localStorage.setItem(TOP_N_STORAGE_KEY, topNSlider.value);
    updateVisibility();
  };

  topControls.append(selectAllButton, selectNoneButton, filterContainer, topNContainer);
  rightActions.append(cancelButton, applyButton);
  actions.append(leftActions, rightActions);

  updateVisibility();

  panel.append(title, topControls, list, actions);
  overlay.append(panel);
  document.body.append(overlay);
  filterInput.focus();
};

const hideSelectionWidget = (node) => {
  const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
  ensureSelectionSerializable(selectionWidget);
  if (selectionWidget) {
    selectionWidget.value = normalizeSelectionValue(selectionWidget.value);
  }
  setWidgetHidden(selectionWidget, true);
};

const hookLoraWidget = (loraWidget, selectionWidget, onChange) => {
  if (!loraWidget || loraWidget.__triggerHooked) {
    return;
  }
  const originalCallback = loraWidget.callback;
  loraWidget.callback = function () {
    const result = originalCallback?.apply(this, arguments) ?? loraWidget.value;
    if (selectionWidget) {
      selectionWidget.value = '';
    }
    if (onChange) {
      onChange();
    }
    return result;
  };
  loraWidget.__triggerHooked = true;
};

const createSeparatorWidget = (node) => {
	const widget = {
		type: 'separator',
		name: '',
		value: '',
    serialize: false,
    computeSize: () => [0, 10],
    draw(ctx, _node, width, y) {
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(12, y + 5);
      ctx.lineTo(width - 12, y + 5);
      ctx.stroke();
    },
  };
  node.widgets = node.widgets || [];
	node.widgets.push(widget);
	return widget;
};

const createHeaderWidget = (node, getAllToggleState) => {
	const widget = {
		type: 'stack-header',
		name: 'lora_stack_header',
		value: '',
    serialize: false,
    computeSize: () => [0, 24],
    draw(ctx, _node, width, y, height) {
      const lineY = y + (height ?? 24) - 2;
      ctx.save();
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(12, lineY);
      ctx.lineTo(width - 12, lineY);
      ctx.stroke();
      const rowHeight = height ?? 24;
      const toggleHeight = Math.max(10, Math.min(14, rowHeight - 8));
      const toggleWidth = Math.round(toggleHeight * 1.8);
      const toggleRect = {
        x: TOGGLE_LEFT_PADDING,
        y: y + (rowHeight - toggleHeight) / 2,
        width: toggleWidth,
        height: toggleHeight,
      };
      widget.__toggleRect = toggleRect;
      const state = getAllToggleState?.() ?? null;
      drawToggleSwitch(ctx, toggleRect, state === true, state === null);
      ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? '#d0d0d0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        TOGGLE_LABEL_TEXT,
        toggleRect.x + toggleRect.width + 8,
        y + rowHeight / 2,
      );
      ctx.restore();
    },
  };
  node.widgets = node.widgets || [];
	node.widgets.push(widget);
	return widget;
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

const removeWidgets = (node, widgets) => {
  const list = node.widgets || [];
  const indices = widgets
    .map((widget) => list.indexOf(widget))
    .filter((index) => index >= 0)
    .sort((a, b) => b - a);
  indices.forEach((index) => {
    if (typeof node.removeWidget === 'function') {
      node.removeWidget(index);
    } else {
      list.splice(index, 1);
    }
  });
  widgets.forEach((widget) => {
    if (widget?.inputEl?.remove) {
      widget.inputEl.remove();
    }
    if (widget && 'inputEl' in widget) {
      widget.inputEl = null;
    }
  });
};

const applySavedWidgetValues = (node, slots) => {
  const savedValues = node.__stackSavedValues;
  if (!Array.isArray(savedValues) || !Array.isArray(slots)) {
    return;
  }
  slots.forEach((slot, index) => {
    const base = index * 4;
    if (savedValues.length > base) {
      slot.loraWidget.value = savedValues[base];
    }
    if (savedValues.length > base + 1) {
      slot.strengthWidget.value = savedValues[base + 1];
    }
    if (savedValues.length > base + 2) {
      slot.toggleWidget.value = normalizeToggleValue(savedValues[base + 2]);
    }
    if (savedValues.length > base + 3) {
      slot.selectionWidget.value = normalizeSelectionValue(savedValues[base + 3]);
    }
  });
  node.__stackSavedValues = null;
};

const setupStackUi = (node) => {
  if (node.__stackReady) {
    return;
  }
  node.__stackReady = true;

  applyReadableLabels(node);

  const state = { activeCount: DEFAULT_LORA_STACK };
	const selectButtons = new Map();
	const separators = new Map();
	const slots = [];
	let headerWidget = null;

  const getSlotWidgets = (index) => {
    const loraWidget = getWidget(node, `${LORA_WIDGET_NAME}_${index}`);
    const strengthWidget = getWidget(node, `lora_strength_${index}`);
    const toggleWidget = getWidget(node, `${TOGGLE_WIDGET_NAME}_${index}`);
    const selectionWidget = getWidget(node, `${SELECTION_WIDGET_NAME}_${index}`);
    if (!loraWidget || !strengthWidget || !selectionWidget) {
      return null;
    }
    ensureSelectionSerializable(selectionWidget);
    return { index, loraWidget, strengthWidget, toggleWidget, selectionWidget };
  };

  const createRowWidget = (slot) => ({
    type: 'custom',
    name: `lora_row_${slot.index}`,
    value: '',
    serialize: false,
    computeSize: (width) => [width ?? 0, 28],
    draw(ctx, _node, width, y, height) {
      const rowHeight = height ?? 28;
      const margin = 10;
      const innerMargin = margin * 0.33;
      const midY = y + rowHeight / 2;
      const isOn = normalizeToggleValue(slot.toggleWidget?.value);
      ctx.save();
      ctx.fillStyle = '#2a2a2a';
      drawRoundedRect(ctx, margin, y, width - margin * 2, rowHeight, 6);
      ctx.fill();

      const toggleHeight = Math.max(10, Math.min(14, rowHeight - 8));
      const toggleWidth = Math.round(toggleHeight * 1.8);
      const toggleRect = {
        x: TOGGLE_LEFT_PADDING,
        y: y + (rowHeight - toggleHeight) / 2,
        width: toggleWidth,
        height: toggleHeight,
      };
      slot.__toggleRect = toggleRect;
      drawToggleSwitch(ctx, toggleRect, isOn);

      const trashSize = Math.max(10, Math.min(TRASH_ICON_SIZE, rowHeight - 6));
      const trashRect = {
        x: width - margin - trashSize,
        y: y + (rowHeight - trashSize) / 2,
        size: trashSize,
      };
      slot.__trashIconRect = trashRect;
      drawTrashIcon(ctx, trashRect, isSlotFilled(slot));

      const strengthValue = Number(slot.strengthWidget?.value ?? 1);
      const stepValue = Number(slot.strengthWidget?.options?.step ?? 0.1);
      const decimals =
        stepValue > 0 && stepValue < 1 ? String(stepValue).split('.')[1]?.length ?? 1 : 0;
      const strengthText = Number.isFinite(strengthValue)
        ? strengthValue.toFixed(decimals)
        : '0';
      const strengthWidth = Math.max(80, rowHeight * 3.4);
      const strengthHeight = Math.max(12, rowHeight - 8);
      const strengthRect = {
        x: trashRect.x - innerMargin - strengthWidth,
        y: y + (rowHeight - strengthHeight) / 2,
        width: strengthWidth,
        height: strengthHeight,
      };

      const labelX = toggleRect.x + toggleRect.width + innerMargin;
      const labelWidth = Math.max(10, strengthRect.x - innerMargin - labelX);
      const loraLabel = getLoraValue(slot).text || 'None';

      if (!isOn) {
        ctx.globalAlpha *= 0.4;
      }
      ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? '#d0d0d0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitText(ctx, loraLabel, labelWidth), labelX, midY);
      slot.__loraRect = { x: labelX, y, width: labelWidth, height: rowHeight };

      const strengthRects = drawStrengthControl(ctx, strengthRect, strengthText);
      slot.__strengthDecRect = strengthRects.decRect;
      slot.__strengthValRect = strengthRects.valRect;
      slot.__strengthIncRect = strengthRects.incRect;
      ctx.restore();
    },
  });

  const getLoraValue = (slot) => {
    const raw = slot.loraWidget?.value;
    let value = raw;
    if (typeof value === 'number') {
      const options = slot.loraWidget?.options?.values;
      if (Array.isArray(options) && options.length > 0) {
        value = options[value];
      } else {
        value = '';
      }
    }
    if (value && typeof value === 'object') {
      if ('value' in value) {
        value = value.value;
      } else if ('name' in value) {
        value = value.name;
      }
    }
    if (value === undefined || value === null) {
      value = slot.loraWidget?.inputEl?.value;
    }
    if (value === undefined || value === null) {
      return { raw, text: '' };
    }
    return { raw, text: String(value).trim() };
  };

  const isSlotFilled = (slot) => {
    const { raw, text } = getLoraValue(slot);
    if (typeof raw === 'number') {
      return raw > 0;
    }
    return isFilledName(text);
  };

  const getSlotValueData = (slot) => ({
    loraName: getLoraValue(slot).text,
    strength: slot.strengthWidget?.value ?? null,
    selection: slot.selectionWidget?.value ?? '',
    on: normalizeToggleValue(slot.toggleWidget?.value),
  });

  const applySlotValueData = (slot, data) => {
    if (!slot || !data) {
      return;
    }
    const name = isFilledName(data.loraName) ? data.loraName : 'None';
    setComboWidgetValue(slot.loraWidget, name);
    const defaultStrength = slot.strengthWidget?.options?.default ?? 1.0;
    const nextStrength = Number.isFinite(data.strength) ? data.strength : defaultStrength;
    setWidgetValue(slot.strengthWidget, nextStrength);
    if (slot.toggleWidget) {
      setWidgetValue(slot.toggleWidget, normalizeToggleValue(data.on));
    }
    if (slot.selectionWidget) {
      slot.selectionWidget.value = normalizeSelectionValue(data.selection);
    }
  };

  const clearSlot = (slot) => {
    setComboWidgetValue(slot.loraWidget, 'None');
    const defaultStrength = slot.strengthWidget?.options?.default ?? 1.0;
    setWidgetValue(slot.strengthWidget, defaultStrength);
    if (slot.toggleWidget) {
      setWidgetValue(slot.toggleWidget, true);
    }
    if (slot.selectionWidget) {
      slot.selectionWidget.value = '';
    }
    updateVisibility();
    node.setDirtyCanvas(true, true);
  };

  const compactSlotsFromIndex = (startIndex) => {
    if (node.__stackIsCompacting) {
      return;
    }
    const values = slots.map(getSlotValueData);
    const compacted = compactSlotValues(values, startIndex);
    node.__stackIsCompacting = true;
    compacted.forEach((data, index) => {
      const slot = slots[index];
      applySlotValueData(slot, data);
    });
    node.__stackIsCompacting = false;
    updateVisibility();
    node.setDirtyCanvas(true, true);
  };

  const isSlotVisible = (slot) => !slot?.rowWidget?.hidden;

  const getAllToggleState = () => {
    let allOn = true;
    let allOff = true;
    let hasVisible = false;
    slots.forEach((slot) => {
      if (!isSlotVisible(slot)) {
        return;
      }
      hasVisible = true;
      const isOn = normalizeToggleValue(slot.toggleWidget?.value);
      allOn = allOn && isOn;
      allOff = allOff && !isOn;
    });
    if (!hasVisible) {
      return null;
    }
    if (allOn) {
      return true;
    }
    if (allOff) {
      return false;
    }
    return null;
  };

  const setAllToggleState = (nextValue) => {
    slots.forEach((slot) => {
      if (!isSlotVisible(slot)) {
        return;
      }
      if (slot.toggleWidget) {
        setWidgetValue(slot.toggleWidget, nextValue);
      }
    });
  };

  const ensureRowHandlers = () => {
    if (node.__stackRowHandlers) {
      return;
    }
    node.__stackRowHandlers = true;

    const openLoraMenu = (slot, event, canvasRef) => {
      const options = slot.loraWidget?.options?.values;
      if (!options) {
        return;
      }
      const values = Array.isArray(options) ? options : Object.values(options);
      if (!Array.isArray(values) || values.length === 0) {
        return;
      }
      const menuOptions = {
        event,
        scale: Math.max(1, canvasRef?.ds?.scale ?? 1),
        className: 'dark',
        callback: (value) => {
          setComboWidgetValue(slot.loraWidget, value);
          if (slot.selectionWidget) {
            slot.selectionWidget.value = '';
          }
          updateVisibility();
          node.setDirtyCanvas(true, true);
        },
      };
      new LiteGraph.ContextMenu(values, menuOptions);
    };

    const originalMouseDown = node.onMouseDown;
    node.onMouseDown = function (event, pos, canvas) {
      if (Array.isArray(pos)) {
        if (headerWidget?.__toggleRect && isPointInRect(pos, headerWidget.__toggleRect)) {
          const allState = getAllToggleState();
          setAllToggleState(allState === true ? false : true);
          this.setDirtyCanvas?.(true, true);
          return true;
        }
        for (const slot of slots) {
          if (!isSlotVisible(slot)) {
            continue;
          }
          if (isPointInRect(pos, slot.__toggleRect)) {
            if (slot.toggleWidget) {
              setWidgetValue(slot.toggleWidget, !normalizeToggleValue(slot.toggleWidget.value));
              this.setDirtyCanvas?.(true, true);
              return true;
            }
          }
          if (isPointInRect(pos, slot.__loraRect)) {
            const canvasRef = canvas ?? app?.canvas;
            openLoraMenu(slot, event, canvasRef);
            return true;
          }
          if (isPointInRect(pos, slot.__strengthDecRect)) {
            const step = Number(slot.strengthWidget?.options?.step ?? 0.1);
            const min = Number(slot.strengthWidget?.options?.min ?? -2);
            const max = Number(slot.strengthWidget?.options?.max ?? 2);
            const current = Number(slot.strengthWidget?.value ?? 0);
            const next = clampNumber(Number((current - step).toFixed(3)), min, max);
            setWidgetValue(slot.strengthWidget, next);
            this.setDirtyCanvas?.(true, true);
            return true;
          }
          if (isPointInRect(pos, slot.__strengthIncRect)) {
            const step = Number(slot.strengthWidget?.options?.step ?? 0.1);
            const min = Number(slot.strengthWidget?.options?.min ?? -2);
            const max = Number(slot.strengthWidget?.options?.max ?? 2);
            const current = Number(slot.strengthWidget?.value ?? 0);
            const next = clampNumber(Number((current + step).toFixed(3)), min, max);
            setWidgetValue(slot.strengthWidget, next);
            this.setDirtyCanvas?.(true, true);
            return true;
          }
          if (isPointInRect(pos, slot.__trashIconRect)) {
            clearSlot(slot);
            return true;
          }
        }
      }
      return originalMouseDown?.apply(this, arguments);
    };
  };

	const insertAfterWidget = (targetWidget, widgets) => {
		const list = node.widgets || [];
		widgets.forEach((widget) => {
			const index = list.indexOf(widget);
      if (index >= 0) {
        list.splice(index, 1);
      }
    });
    const targetIndex = list.indexOf(targetWidget);
    if (targetIndex < 0) {
      list.push(...widgets);
      return;
    }
		list.splice(targetIndex + 1, 0, ...widgets);
	};


  const ensureControls = (slot) => {
    let selectWidget = selectButtons.get(slot.index);
    let separatorWidget = separators.get(slot.index);
    if (!selectWidget) {
      selectWidget = node.addWidget('button', 'Select Trigger Words', 'Edit', () =>
        openTriggerDialog(slot.loraWidget?.value, slot.selectionWidget),
      );
			selectWidget.name = `select_trigger_${slot.index}`;
      selectWidget.serialize = false;
      selectButtons.set(slot.index, selectWidget);
    }
    if (!separatorWidget) {
      separatorWidget = createSeparatorWidget(node);
      separators.set(slot.index, separatorWidget);
    }
    return { selectWidget, separatorWidget };
  };

  const updateActiveCount = () => {
    let highest = 0;
    slots.forEach((slot) => {
      if (isSlotFilled(slot)) {
        highest = Math.max(highest, slot.index);
      }
    });
    const nextSlot = Math.min(highest + 1, MAX_LORA_STACK);
    state.activeCount = Math.max(DEFAULT_LORA_STACK, nextSlot);
  };

  const updateVisibility = () => {
    applyReadableLabels(node);
    updateActiveCount();
    slots.forEach((slot) => {
      hookLoraWidget(slot.loraWidget, slot.selectionWidget, () => {
        if (node.__stackIsCompacting) {
          return;
        }
        const { text } = getLoraValue(slot);
        if (!isFilledName(text)) {
          compactSlotsFromIndex(slot.index - 1);
          return;
        }
        updateVisibility();
      });
      const visible = slot.index <= state.activeCount;
      if (slot.rowWidget) {
        setWidgetHidden(slot.rowWidget, !visible);
      }
      if (slot.selectionWidget) {
        slot.selectionWidget.value = normalizeSelectionValue(slot.selectionWidget.value);
      }
      setWidgetHidden(slot.selectionWidget, true);
      const controls = ensureControls(slot);
      setWidgetHidden(controls.selectWidget, !visible);
      const showSeparator = visible && slot.index < state.activeCount;
      setWidgetHidden(controls.separatorWidget, !showSeparator);
    });
    resizeNodeToWidgets(node, { keepWidth: true });
    node.setDirtyCanvas(true, true);
  };

  const getSignature = () => {
    const maxIndex = Math.min(state.activeCount + 1, MAX_LORA_STACK);
    const values = [];
    for (let index = 1; index <= maxIndex; index += 1) {
      const slot = slots.find((item) => item.index === index);
      if (!slot) {
        continue;
      }
      values.push(getLoraValue(slot).text);
    }
    return values.join('|');
  };

  if (!node.__stackWatcher) {
    let signature = getSignature();
    node.__stackWatcher = setInterval(() => {
      const nextSignature = getSignature();
      if (nextSignature !== signature) {
        signature = nextSignature;
        updateVisibility();
      }
    }, 200);
    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function () {
      if (node.__stackWatcher) {
        clearInterval(node.__stackWatcher);
        node.__stackWatcher = null;
      }
      return originalOnRemoved?.apply(this, arguments);
    };
  }

  for (let index = 1; index <= MAX_LORA_STACK; index += 1) {
    const slot = getSlotWidgets(index);
    if (!slot) {
      continue;
    }
    setWidgetHidden(slot.selectionWidget, true);
    slots.push(slot);
  }

  // ウィジェットの順序を調整（toggle → lora_name → strength → select_trigger → separator）
  slots.forEach((slot) => {
    setWidgetHidden(slot.selectionWidget, true);
  });

  applySavedWidgetValues(node, slots);

	for (let i = slots.length - 1; i >= 0; i -= 1) {
		const slot = slots[i];
		const controls = ensureControls(slot);
		const anchorWidget = slot.rowWidget ?? slot.strengthWidget;
		insertAfterWidget(anchorWidget, [controls.selectWidget, controls.separatorWidget]);
	}

  if (!headerWidget && slots.length > 0) {
    headerWidget = createHeaderWidget(node, getAllToggleState);
    const anchorWidget = slots[0].rowWidget ?? slots[0].loraWidget;
    insertBeforeWidget(node, anchorWidget, [headerWidget]);
  }

  if (!node.__stackSerializeWrapped) {
    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      originalOnSerialize?.apply(this, arguments);
      const values = [];
      slots.forEach((slot) => {
        const defaultStrength = slot.strengthWidget?.options?.default ?? 1.0;
        const strengthValue =
          slot.strengthWidget?.value ?? defaultStrength;
        values.push(
          slot.loraWidget?.value ?? 'None',
          strengthValue,
          normalizeToggleValue(slot.toggleWidget?.value),
          slot.selectionWidget?.value ?? '',
        );
      });
      o.widgets_values = values;
    };
    node.__stackSerializeWrapped = true;
  }

  ensureRowHandlers();
	updateVisibility();
};

const scheduleStackUi = (node) => {
  if (node.__stackSetupPlanned) {
    return;
  }
  node.__stackSetupPlanned = true;

  const finalize = () => {
    if (!node.__stackReady) {
      setupStackUi(node);
    }
  };

  const originalConfigure = node.onConfigure;
  node.onConfigure = function (info) {
    node.__stackConfigured = true;
    if (Array.isArray(info?.widgets_values)) {
      node.__stackSavedValues = normalizeSavedValues(info.widgets_values, MAX_LORA_STACK);
    }
    const result = originalConfigure?.apply(this, arguments);
    queueMicrotask(finalize);
    return result;
  };

  setTimeout(() => {
    if (!node.__stackConfigured) {
      finalize();
    }
  }, 0);
};

app.registerExtension({
  name: 'my_custom_node.loraTriggerToggle',
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    applyReadableLabels(node);
		if (isStackNode(node)) {
			scheduleStackUi(node);
			return;
		}
		hideSelectionWidget(node);
		const loraWidget = getWidget(node, LORA_WIDGET_NAME);
		const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
		hookLoraWidget(loraWidget, selectionWidget, null);
		if (loraWidget && !node.__singleTopSeparator) {
			const separatorWidget = createSeparatorWidget(node);
			insertBeforeWidget(node, loraWidget, [separatorWidget]);
			node.__singleTopSeparator = true;
		}
		if (!node.__triggerButtonAdded) {
			const selectWidget = node.addWidget('button', 'Select Trigger Words', 'Edit', () =>
				openTriggerDialog(loraWidget?.value, selectionWidget),
			);
			selectWidget.serialize = false;
			node.__triggerButtonAdded = true;
		}
	},
});
