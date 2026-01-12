import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';
import { $el } from '../../../../scripts/ui.js';
import { normalizeSavedValues } from './stackUtils.js';
import { formatLabel } from './labelUtils.js';
import { formatPercentLabel, normalizePercentValue } from './percentUtils.js';

const SINGLE_NODE_NAME = 'LoadLoraWithTriggers';
const STACK_NODE_NAMES = ['LoadLoraWithTriggersStack', 'load_lora_with_triggers_stack'];
const LORA_WIDGET_NAME = 'lora_name';
const SELECTION_WIDGET_NAME = 'trigger_selection';
const LABEL_TARGETS = [LORA_WIDGET_NAME, 'lora_strength', SELECTION_WIDGET_NAME, 'select_trigger'];
const DIALOG_ID = 'my-custom-node-trigger-dialog';
const MAX_LORA_STACK = 10;
const DEFAULT_LORA_STACK = 1;
const TRASH_ICON_URL = new URL('../../../icons/MaterialSymbolsDelete.svg', import.meta.url).toString();
const TRASH_ICON_SIZE = 12;
const TRASH_ICON_PADDING = 6;
const TRASH_ICON_RIGHT_GUTTER = 22;
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
const getWidgetsByPrefix = (node, prefix) =>
  node.widgets?.filter((widget) => widget.name?.startsWith(prefix)) ?? [];

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

const resizeNodeToWidgets = (node) => {
  const size = node?.computeSize?.();
  if (!size || !Array.isArray(size)) {
    return;
  }
  if (typeof node.setSize === 'function') {
    node.setSize(size);
    return;
  }
  node.size = size;
};

const getWidgetHeight = (widget, width) => {
  const size = widget?.computeSize?.(width);
  if (Array.isArray(size) && typeof size[1] === 'number') {
    return size[1];
  }
  return typeof LiteGraph !== 'undefined' && LiteGraph.NODE_WIDGET_HEIGHT
    ? LiteGraph.NODE_WIDGET_HEIGHT
    : 24;
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

const getNodeBaseY = (node) => {
  const inputCount = Array.isArray(node?.inputs) ? node.inputs.length : 0;
  const outputCount = Array.isArray(node?.outputs) ? node.outputs.length : 0;
  const slotHeight = typeof LiteGraph !== 'undefined' && LiteGraph.NODE_SLOT_HEIGHT
    ? LiteGraph.NODE_SLOT_HEIGHT
    : 20;
  return Math.max(inputCount, outputCount) * slotHeight + 6;
};

const getWidgetLayout = (node, width) => {
  const layout = new Map();
  let currentY = getNodeBaseY(node);
  (node?.widgets ?? []).forEach((widget) => {
    if (typeof widget?.y === 'number') {
      currentY = widget.y;
    }
    const height = getWidgetHeight(widget, width);
    layout.set(widget, { y: currentY, height });
    currentY += height;
  });
  return layout;
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
    return [];
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.triggers)) {
    return [];
  }
  return data.triggers.map((trigger) => String(trigger));
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
  const triggers = await fetchTriggers(loraName);
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
      maxHeight: '70vh',
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
  const list = $el('div', {
    style: {
      overflow: 'auto',
      padding: '8px',
      background: '#2a2a2a',
      borderRadius: '6px',
      flex: '1 1 auto',
    },
  });

  const items = triggers.map((trigger) => {
    const checkbox = $el('input', { type: 'checkbox' });
    checkbox.checked = selected.has(trigger);
    const label = $el('label', {
      style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' },
    });
    label.append(checkbox, $el('span', { textContent: trigger }));
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

  const percentContainer = $el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginLeft: 'auto',
      width: '45%',
      maxWidth: '45%',
    },
  });
  const percentLabel = $el('span', {
    textContent: formatPercentLabel(100),
    style: { minWidth: '48px', textAlign: 'right' },
  });
  const percentSlider = $el('input', {
    type: 'range',
    min: '1',
    max: '100',
    value: '100',
    style: { flex: '1 1 auto' },
  });
  const percentCaption = $el('span', { textContent: 'Show top', style: { whiteSpace: 'nowrap' } });

  const updateVisibleByPercent = (value) => {
    const percentValue = normalizePercentValue(value);
    const visibleCount = Math.max(1, Math.floor(triggers.length * (percentValue / 100)));
    items.forEach((item, index) => {
      const isVisible = index < visibleCount;
      item.row.style.display = isVisible ? 'flex' : 'none';
      if (!isVisible) {
        item.checkbox.checked = false;
      }
    });
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

  percentSlider.oninput = (event) => {
    const value = event?.target?.value ?? '100';
    percentLabel.textContent = formatPercentLabel(value);
    updateVisibleByPercent(value);
  };

  percentContainer.append(percentCaption, percentSlider, percentLabel);
  topControls.append(selectAllButton, selectNoneButton, percentContainer);
  rightActions.append(cancelButton, applyButton);
  actions.append(leftActions, rightActions);

  updateVisibleByPercent(100);

  panel.append(title, topControls, list, actions);
  overlay.append(panel);
  document.body.append(overlay);
};

const hideSelectionWidget = (node) => {
  const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
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

const applySavedWidgetValues = (node) => {
  const savedValues = node.__stackSavedValues;
  if (!Array.isArray(savedValues) || !node.widgets?.length) {
    return;
  }
  const serializableWidgets = node.widgets.filter((widget) => widget.serialize !== false);
  serializableWidgets.forEach((widget, index) => {
    if (index < savedValues.length) {
      widget.value = savedValues[index];
    }
  });
  node.__stackSavedValues = null;
};

const setupStackUi = (node) => {
  if (node.__stackReady) {
    return;
  }
  node.__stackReady = true;

  applySavedWidgetValues(node);
  applyReadableLabels(node);

  const state = { activeCount: DEFAULT_LORA_STACK };
	const selectButtons = new Map();
	const separators = new Map();
	const slots = [];
	let topSeparator = null;

  const getSlotWidgets = (index) => {
    const loraWidget = getWidget(node, `${LORA_WIDGET_NAME}_${index}`);
    const strengthWidget = getWidget(node, `lora_strength_${index}`);
    const selectionWidget = getWidget(node, `${SELECTION_WIDGET_NAME}_${index}`);
    if (!loraWidget || !strengthWidget || !selectionWidget) {
      return null;
    }
    return { index, loraWidget, strengthWidget, selectionWidget };
  };

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
    return text !== '' && text !== 'None' && text !== '[None]';
  };

  const clearSlot = (slot) => {
    setComboWidgetValue(slot.loraWidget, 'None');
    const defaultStrength = slot.strengthWidget?.options?.default ?? 1.0;
    setWidgetValue(slot.strengthWidget, defaultStrength);
    if (slot.selectionWidget) {
      slot.selectionWidget.value = '';
    }
    updateVisibility();
    node.setDirtyCanvas(true, true);
  };

  const getSlotTrashRect = (slot, controls, layout, width) => {
    if (slot?.loraWidget?.__isHidden || controls?.selectWidget?.__isHidden) {
      return null;
    }
    const loraLayout = layout.get(slot.loraWidget);
    const selectLayout = layout.get(controls.selectWidget);
    if (!loraLayout || !selectLayout) {
      return null;
    }
    const top = loraLayout.y;
    const bottom = selectLayout.y + selectLayout.height;
    const height = Math.max(0, bottom - top);
    if (height <= 0) {
      return null;
    }
    const centerY = top + height / 2;
    const size = Math.max(10, Math.min(TRASH_ICON_SIZE, height - 6));
    const x = Math.max(0, width - size - TRASH_ICON_PADDING - TRASH_ICON_RIGHT_GUTTER);
    return { x, y: centerY - size / 2, size };
  };

  const ensureTrashHandlers = () => {
    if (node.__stackTrashHandlers) {
      return;
    }
    node.__stackTrashHandlers = true;

    const originalDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function () {
      originalDrawForeground?.apply(this, arguments);
      const ctx = arguments[0];
      if (this?.flags?.collapsed) {
        return;
      }
      const width = this?.size?.[0] ?? 0;
      if (!width) {
        return;
      }
      const layout = getWidgetLayout(this, width);
      slots.forEach((slot) => {
        const controls = ensureControls(slot);
        const rect = getSlotTrashRect(slot, controls, layout, width);
        if (!rect) {
          return;
        }
        slot.__trashIconRect = rect;
        drawTrashIcon(ctx, rect, isSlotFilled(slot));
      });
    };

    const originalMouseDown = node.onMouseDown;
    node.onMouseDown = function (event, pos, canvas) {
      if (Array.isArray(pos)) {
        for (const slot of slots) {
          const rect = slot.__trashIconRect;
          if (!rect) {
            continue;
          }
          const inX = pos[0] >= rect.x && pos[0] <= rect.x + rect.size;
          const inY = pos[1] >= rect.y && pos[1] <= rect.y + rect.size;
          if (inX && inY) {
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
    for (let index = 1; index <= MAX_LORA_STACK; index += 1) {
      const slot = getSlotWidgets(index);
      if (!slot) {
        continue;
      }
      if (isSlotFilled(slot)) {
        highest = index;
      }
    }
    const nextSlot = Math.min(highest + 1, MAX_LORA_STACK);
    state.activeCount = Math.max(DEFAULT_LORA_STACK, nextSlot);
  };

  const updateVisibility = () => {
    applyReadableLabels(node);
    updateActiveCount();
    slots.forEach((slot) => {
      hookLoraWidget(slot.loraWidget, slot.selectionWidget, updateVisibility);
      const visible = slot.index <= state.activeCount;
      setWidgetHidden(slot.loraWidget, !visible);
      setWidgetHidden(slot.strengthWidget, !visible);
      setWidgetHidden(slot.selectionWidget, true);
      const controls = ensureControls(slot);
      setWidgetHidden(controls.selectWidget, !visible);
      const showSeparator = visible && slot.index < state.activeCount;
      setWidgetHidden(controls.separatorWidget, !showSeparator);
    });
    resizeNodeToWidgets(node);
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

	for (let i = slots.length - 1; i >= 0; i -= 1) {
		const slot = slots[i];
		const controls = ensureControls(slot);
		insertAfterWidget(slot.strengthWidget, [controls.selectWidget, controls.separatorWidget]);
	}

	if (!topSeparator && slots.length > 0) {
		topSeparator = createSeparatorWidget(node);
		insertBeforeWidget(node, slots[0].loraWidget, [topSeparator]);
	}

  ensureTrashHandlers();
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
