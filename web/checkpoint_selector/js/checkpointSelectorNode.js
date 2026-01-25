import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';
import { $el } from '../../../../scripts/ui.js';
import {
  computeButtonRect,
  createDebouncedRunner,
  filterOptionIndicesFromBase,
  getHighlightSegments,
  isPointInRect,
  normalizeDialogFilterValue,
  normalizeSelectedSlotIndex,
  resolveComboDisplayLabel,
  resolveNoneOptionIndex,
  resolveOption,
  resolveVisibleSlotCount,
  setComboWidgetValue,
  setWidgetHidden,
  splitCheckpointLabel,
} from './checkpointSelectorUiUtils.js';

const TARGET_NODE_CLASS = 'CheckpointSelector';
const MAX_CHECKPOINT_STACK = 20;
const SELECTED_SLOT_PROPERTY = 'checkpointSelectorSelectedSlot';

const ROW_HEIGHT = 26;
const ROW_PADDING_Y = 2;
const RADIO_SIZE = 12;
const RADIO_GAP = 8;
const SELECTED_ICON_SIZE = 14;

const ROW_TEXT_COLOR = '#d0d0d0';
const ROW_TEXT_SELECTED_COLOR = '#f0f0f0';
const ROW_SELECTED_BG = '#2b2b2b';
const ROW_BORDER_COLOR = '#3a3a3a';
const SELECTED_ICON_COLOR = '#f2d28b';

const DIALOG_ID = 'craftgear-checkpoint-selector-dialog';
const DIALOG_FILTER_DEBOUNCE_MS = 120;
const PREVIEW_PANEL_WIDTH = 240;

const dialogSelectedIconPath =
  'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 12l2 2l4 -4';
const dialogOpenFolderIconPath =
  'M13.5 6a.5.5 0 0 0 .5-.5A1.5 1.5 0 0 0 12.5 4h-5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 5 2H1.5A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h11.1a1.49 1.49 0 0 0 1.42-1.03l1.77-5.32a.5.5 0 0 0-.474-.658h-10.8a.75.75 0 0 0-.712.513l-1.83 5.49h-.5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h3.5l.9 1.2c.378.504.97.8 1.6.8h5c.276 0 .5.224.5.5s.224.5.5.5z';

let dialogKeydownHandler = null;

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) =>
  node.widgets?.find((widget) => widget.name === name);

const getComboOptions = (widget) => normalizeOptions(widget?.options?.values);

const markDirty = (node) => {
  if (typeof node?.setDirtyCanvas === 'function') {
    node.setDirtyCanvas(true, true);
    return;
  }
  if (app?.graph?.setDirtyCanvas) {
    app.graph.setDirtyCanvas(true, true);
  }
};

const setSelectedSlotIndex = (node, index) => {
  if (!node) {
    return;
  }
  if (!node.properties || typeof node.properties !== 'object') {
    node.properties = {};
  }
  node.properties[SELECTED_SLOT_PROPERTY] = index;
};

const getSelectedSlotIndex = (node) => {
  const value = node?.properties?.[SELECTED_SLOT_PROPERTY];
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSlotLabel = (slot) => {
  const options = getComboOptions(slot.nameWidget);
  return resolveComboDisplayLabel(slot.nameWidget?.value, options);
};

const resolveSlotValues = (slots) => slots.map((slot) => resolveSlotLabel(slot));

const setRowHidden = (rowWidget, hidden) => {
  if (!rowWidget) {
    return;
  }
  rowWidget.__checkpointSelectorHidden = hidden;
};

const applyRowVisibility = (node, slots) => {
  const slotValues = resolveSlotValues(slots);
  const maxCount = Math.min(MAX_CHECKPOINT_STACK, slots.length);
  const visibleCount = resolveVisibleSlotCount(slotValues, maxCount);
  const selectedIndex = normalizeSelectedSlotIndex(
    getSelectedSlotIndex(node),
    visibleCount,
    slotValues,
  );
  setSelectedSlotIndex(node, selectedIndex);
  slots.forEach((slot) => {
    const shouldShow = slot.index <= visibleCount;
    slot.isSelected = slot.index === selectedIndex;
    setRowHidden(slot.rowWidget, !shouldShow);
  });
  markDirty(node);
};

const wrapWidgetCallback = (widget, handler) => {
  if (!widget || widget.__checkpointSelectorCallbackWrapped) {
    return;
  }
  const original = widget.callback;
  widget.callback = (value) => {
    if (typeof original === 'function') {
      original(value);
    }
    handler();
  };
  widget.__checkpointSelectorCallbackWrapped = true;
};

const fetchCheckpointPreviewUrl = async (ckptName) => {
  if (!ckptName || ckptName === 'None') {
    return null;
  }
  const response = await api.fetchApi('/craftgear/checkpoint_preview', {
    method: 'POST',
    body: JSON.stringify({ ckpt_name: ckptName }),
  });
  if (!response.ok) {
    return null;
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

const openCheckpointFolder = async (ckptName) => {
  if (!ckptName || ckptName === 'None') {
    return;
  }
  await api.fetchApi('/craftgear/open_checkpoint_folder', {
    method: 'POST',
    body: JSON.stringify({ ckpt_name: ckptName }),
  });
};

const closeDialog = () => {
  const overlay = document.getElementById(DIALOG_ID);
  if (overlay) {
    if (typeof overlay.__checkpointSelectorCleanup === 'function') {
      overlay.__checkpointSelectorCleanup();
    }
    overlay.remove();
  }
  if (dialogKeydownHandler) {
    document.removeEventListener('keydown', dialogKeydownHandler, true);
    dialogKeydownHandler = null;
  }
};

const renderLabel = (labelContainer, label, query) => {
  const parts = splitCheckpointLabel(label);
  const segments = getHighlightSegments(parts.base, query);
  labelContainer.textContent = '';
  segments.forEach((segment) => {
    if (!segment.text) {
      return;
    }
    const span = document.createElement('span');
    span.textContent = segment.text;
    if (segment.isMatch) {
      span.style.color = '#f2d28b';
      span.style.fontWeight = '600';
    }
    labelContainer.append(span);
  });
  if (parts.extension) {
    labelContainer.append(document.createTextNode(parts.extension));
  }
};

const openCheckpointDialog = (slot, targetNode) => {
  const options = getComboOptions(slot.nameWidget);
  if (!Array.isArray(options) || options.length === 0) {
    return;
  }
  let selectedOptionIndex = -1;
  let selectedVisibleIndex = -1;
  let filteredIndices = [];
  let visibleOptions = [];
  let hoveredVisibleIndex = -1;
  let renderedButtons = [];
  let lastFilterQuery = '';
  let lastFilteredIndices = null;
  let activeFilterQuery = '';
  let previewObjectUrl = null;
  let previewRequestToken = 0;

  const currentLabel = resolveComboDisplayLabel(
    slot.nameWidget?.value,
    options,
  );
  const currentOptionIndex = resolveOption(currentLabel, options).index;

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
      height: '70vh',
      maxWidth: '90vw',
    },
  });

  const previewPanel = $el('div', {
    style: {
      width: `${PREVIEW_PANEL_WIDTH}px`,
      background: '#111',
      borderRadius: '8px 0 0 8px',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  const previewImage = $el('img', {
    style: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      display: 'none',
    },
  });
  previewPanel.append(previewImage);

  const panel = $el('div', {
    style: {
      background: '#1e1e1e',
      color: '#e0e0e0',
      padding: '16px',
      borderRadius: '0 8px 8px 0',
      width: '55vw',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
    },
  });

  const filterInput = $el('input', {
    type: 'text',
    placeholder: 'Filter checkpoints',
    style: { flex: '1 1 auto', paddingRight: '28px' },
  });
  const clearFilterButton = $el('button', {
    textContent: '×',
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
    },
  });
  filterContainer.append(filterInput, clearFilterButton);

  const cancelButton = $el('button', { textContent: 'Cancel' });

  const headerRow = $el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px',
    },
  });
  headerRow.append(filterContainer, cancelButton);

  const list = $el('div', {
    style: {
      flex: '1 1 auto',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
  });

  const setPreviewUrl = (url) => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    previewObjectUrl = url;
    if (!previewObjectUrl) {
      previewImage.removeAttribute('src');
      previewImage.style.display = 'none';
      return;
    }
    previewImage.src = previewObjectUrl;
    previewImage.style.display = 'block';
  };

  const updatePreviewForLabel = async (label) => {
    const normalized = typeof label === 'string' ? label : '';
    if (!normalized || normalized === 'None') {
      setPreviewUrl(null);
      return;
    }
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

  const updatePreviewByVisibleIndex = (visibleIndex) => {
    if (!Number.isFinite(visibleIndex)) {
      return;
    }
    const entry = visibleOptions[visibleIndex];
    if (!entry?.label) {
      return;
    }
    void updatePreviewForLabel(entry.label);
  };

  const applySelection = (nextLabel) => {
    setComboWidgetValue(slot.nameWidget, nextLabel);
    applyRowVisibility(targetNode, targetNode.__checkpointSelectorSlots);
    markDirty(targetNode);
  };

  const createSelectedIcon = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dialogSelectedIconPath);
    svg.append(path);
    return svg;
  };

  const createOpenFolderIcon = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.display = 'block';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dialogOpenFolderIconPath);
    svg.append(path);
    return svg;
  };

  const refreshButtonStates = () => {
    renderedButtons.forEach((entry, visibleIndex) => {
      const isSelected = visibleIndex === selectedVisibleIndex;
      const isHovered = visibleIndex === hoveredVisibleIndex;
      entry.button.style.background = isSelected || isHovered ? '#2a2a2a' : 'transparent';
      if (entry.iconWrap) {
        entry.iconWrap.style.opacity =
          entry.optionIndex === currentOptionIndex ? '1' : '0';
      }
      if (entry.openIconWrap) {
        const show = entry.isOpenable && (isSelected || isHovered);
        entry.openIconWrap.style.opacity = show ? '1' : '0';
        entry.openIconWrap.style.pointerEvents = show ? 'auto' : 'none';
      }
    });
  };

  const renderList = (forceTopSelection = false) => {
    list.textContent = '';
    renderedButtons = [];
    hoveredVisibleIndex = -1;
    const normalizedQuery = normalizeDialogFilterValue(filterInput.value);
    activeFilterQuery = normalizedQuery;
    if (
      normalizedQuery === lastFilterQuery &&
      Array.isArray(lastFilteredIndices)
    ) {
      filteredIndices = lastFilteredIndices;
    } else {
      const baseIndices =
        lastFilterQuery &&
        normalizedQuery.startsWith(lastFilterQuery) &&
        Array.isArray(lastFilteredIndices)
          ? lastFilteredIndices
          : null;
      filteredIndices = filterOptionIndicesFromBase(
        normalizedQuery,
        options,
        baseIndices,
      );
    }
    lastFilterQuery = normalizedQuery;
    lastFilteredIndices = filteredIndices;
    visibleOptions = filteredIndices
      .map((optionIndex) => ({
        index: optionIndex,
        label: options[optionIndex],
      }))
      .filter((entry) => entry.label !== undefined && entry.label !== null);

    if (visibleOptions.length === 0) {
      selectedVisibleIndex = -1;
      list.append(
        $el('div', {
          textContent: 'No matches.',
          style: { opacity: 0.7, padding: '8px' },
        }),
      );
      return;
    }

    if (forceTopSelection) {
      selectedVisibleIndex = 0;
      selectedOptionIndex = visibleOptions[0].index;
    } else {
      const matchIndex = visibleOptions.findIndex(
        (entry) => entry.index === selectedOptionIndex,
      );
      selectedVisibleIndex = matchIndex >= 0 ? matchIndex : 0;
      selectedOptionIndex = visibleOptions[selectedVisibleIndex]?.index ?? 0;
    }

    const noneOptionIndex = resolveNoneOptionIndex(options);
    visibleOptions.forEach((entry, index) => {
      const label = entry.label;
      const optionIndex = entry.index;
      const isOpenable =
        typeof label === 'string' && label !== 'None' && optionIndex !== noneOptionIndex;
      const button = $el('button', {
        style: {
          textAlign: 'left',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid transparent',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        },
      });
      button.style.color = '#e0e0e0';
      button.style.fontWeight = '400';

      const iconWrap = $el('span', {
        style: {
          width: '18px',
          height: '18px',
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
      renderLabel(labelContainer, label, activeFilterQuery);

      const openIconWrap = $el('span', {
        style: {
          width: '16px',
          height: '16px',
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
        applySelection(label);
        closeDialog();
        void openCheckpointFolder(label);
      };

      button.append(iconWrap, labelContainer, openIconWrap);
      renderedButtons.push({
        button,
        optionIndex,
        iconWrap,
        openIconWrap,
        isOpenable,
      });
      button.onmouseenter = () => {
        hoveredVisibleIndex = index;
        selectedVisibleIndex = index;
        selectedOptionIndex = optionIndex;
        refreshButtonStates();
        updatePreviewByVisibleIndex(index);
      };
      button.onmouseleave = () => {
        if (hoveredVisibleIndex === index) {
          hoveredVisibleIndex = -1;
          refreshButtonStates();
        }
      };
      button.onclick = () => {
        applySelection(label);
        closeDialog();
      };
      list.append(button);
    });

    refreshButtonStates();
    const previewIndex = visibleOptions.findIndex(
      (entry) => entry.index === currentOptionIndex,
    );
    updatePreviewByVisibleIndex(previewIndex >= 0 ? previewIndex : selectedVisibleIndex);
  };

  const clearFilterValue = () => {
    debouncedFilter.cancel();
    filterInput.value = '';
    renderList(true);
    filterInput.focus();
  };

  const moveSelection = (direction) => {
    if (visibleOptions.length === 0) {
      return;
    }
    const nextIndex =
      (selectedVisibleIndex + direction + visibleOptions.length) %
      visibleOptions.length;
    selectedVisibleIndex = nextIndex;
    selectedOptionIndex = visibleOptions[nextIndex]?.index ?? selectedOptionIndex;
    refreshButtonStates();
    const entry = renderedButtons[selectedVisibleIndex];
    entry?.button?.scrollIntoView?.({ block: 'nearest' });
    updatePreviewByVisibleIndex(selectedVisibleIndex);
  };

  const handleDialogKeyDown = (event) => {
    if (event?.__checkpointSelectorDialogHandled) {
      return;
    }
    event.__checkpointSelectorDialogHandled = true;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      debouncedFilter.flush();
      moveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      debouncedFilter.flush();
      moveSelection(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      debouncedFilter.flush();
      const entry = visibleOptions[selectedVisibleIndex];
      if (entry?.label) {
        applySelection(entry.label);
      }
      closeDialog();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
    }
  };

  const debouncedFilter = createDebouncedRunner(() => {
    renderList(true);
  }, DIALOG_FILTER_DEBOUNCE_MS);

  cancelButton.onclick = closeDialog;
  clearFilterButton.onclick = clearFilterValue;
  filterInput.oninput = () => debouncedFilter.run();
  filterInput.addEventListener('keydown', handleDialogKeyDown);
  list.addEventListener('mousemove', () => {
    if (hoveredVisibleIndex >= 0) {
      refreshButtonStates();
    }
  });

  dialogKeydownHandler = handleDialogKeyDown;
  document.addEventListener('keydown', dialogKeydownHandler, true);

  renderList();
  panel.append(headerRow, list);
  dialogShell.append(previewPanel, panel);
  overlay.append(dialogShell);
  document.body.append(overlay);

  overlay.__checkpointSelectorCleanup = () => {
    debouncedFilter.cancel();
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  };
  requestAnimationFrame(() => {
    filterInput.focus();
  });
};

const drawSelectedIcon = (ctx, x, y, size) => {
  ctx.save();
  ctx.strokeStyle = SELECTED_ICON_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.28, y + size * 0.56);
  ctx.lineTo(x + size * 0.45, y + size * 0.72);
  ctx.lineTo(x + size * 0.75, y + size * 0.36);
  ctx.stroke();
  ctx.restore();
};

const drawRowContent = (slot, ctx, width, y) => {
  const height = ROW_HEIGHT;
  const rowRect = { x: 0, y, width, height };
  slot.__rowRect = rowRect;

  const label = resolveSlotLabel(slot);
  const isSelected = !!slot.isSelected;

  if (isSelected) {
    ctx.fillStyle = ROW_SELECTED_BG;
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
    ctx.strokeStyle = ROW_BORDER_COLOR;
    ctx.strokeRect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
  }

  const radioX = rowRect.x + 8;
  const radioY = rowRect.y + (height - RADIO_SIZE) / 2;
  const radioRect = computeButtonRect(radioX, radioY, RADIO_SIZE, RADIO_SIZE, 0);
  slot.__hitRadio = radioRect;
  ctx.strokeStyle = ROW_TEXT_COLOR;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(
    radioRect.x + radioRect.width / 2,
    radioRect.y + radioRect.height / 2,
    radioRect.width / 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  if (isSelected) {
    ctx.fillStyle = ROW_TEXT_SELECTED_COLOR;
    ctx.beginPath();
    ctx.arc(
      radioRect.x + radioRect.width / 2,
      radioRect.y + radioRect.height / 2,
      radioRect.width / 2 - 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const labelX = radioRect.x + radioRect.width + RADIO_GAP;
  const labelWidth = Math.max(0, width - labelX - SELECTED_ICON_SIZE - 12);
  const labelRect = {
    x: labelX,
    y: rowRect.y,
    width: labelWidth,
    height,
  };
  slot.__hitLabel = labelRect;

  ctx.save();
  ctx.beginPath();
  ctx.rect(labelRect.x, labelRect.y, labelRect.width, labelRect.height);
  ctx.clip();
  ctx.fillStyle = isSelected ? ROW_TEXT_SELECTED_COLOR : ROW_TEXT_COLOR;
  ctx.font = `${isSelected ? 'bold ' : ''}12px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(
    label || 'None',
    labelRect.x,
    labelRect.y + labelRect.height / 2,
  );
  ctx.restore();

  if (isSelected) {
    drawSelectedIcon(
      ctx,
      rowRect.x + width - SELECTED_ICON_SIZE - 8,
      rowRect.y + (height - SELECTED_ICON_SIZE) / 2,
      SELECTED_ICON_SIZE,
    );
  }
};

const createRowWidget = (slot) => {
  const widget = {
    type: 'checkpoint-selector-row',
    name: `checkpoint_selector_row_${slot.index}`,
    value: '',
    serialize: false,
    __checkpointSelectorHidden: false,
    draw(ctx, _node, width, y, _height) {
      if (widget.__checkpointSelectorHidden) {
        return;
      }
      drawRowContent(slot, ctx, width, y + ROW_PADDING_Y);
    },
  };
  widget.computeSize = (width) => {
    if (widget.__checkpointSelectorHidden) {
      return [0, -4];
    }
    return [width, ROW_HEIGHT + ROW_PADDING_Y * 2];
  };
  return widget;
};

const handleMouseDown = (event, pos, targetNode, slots) => {
  if (!Array.isArray(pos)) {
    return false;
  }
  for (const slot of slots) {
    if (slot.rowWidget?.__checkpointSelectorHidden) {
      continue;
    }
    if (isPointInRect(pos, slot.__hitRadio)) {
      setSelectedSlotIndex(targetNode, slot.index);
      applyRowVisibility(targetNode, slots);
      if (event) {
        event.__checkpointSelectorHandled = true;
      }
      return true;
    }
    if (isPointInRect(pos, slot.__hitLabel)) {
      openCheckpointDialog(slot, targetNode);
      if (event) {
        event.__checkpointSelectorHandled = true;
      }
      return true;
    }
  }
  return false;
};

const setupCheckpointSelectorUi = (node) => {
  if (node.__checkpointSelectorUiReady) {
    return;
  }
  node.__checkpointSelectorUiReady = true;

  const slots = [];
  for (let index = 1; index <= MAX_CHECKPOINT_STACK; index += 1) {
    const nameWidget = getWidget(node, `ckpt_name_${index}`);
    if (!nameWidget) {
      continue;
    }
    const slot = {
      index,
      nameWidget,
      rowWidget: null,
      isSelected: false,
      __hitRadio: null,
      __hitLabel: null,
    };
    slot.rowWidget = createRowWidget(slot);
    slot.rowWidget.type = 'custom';
    slot.rowWidget.mouse = (event, pos) =>
      handleMouseDown(event, pos, node, slots);
    slot.rowWidget.onMouseDown = (event, pos) =>
      handleMouseDown(event, pos, node, slots);
    slots.push(slot);
    setWidgetHidden(nameWidget, true);
    wrapWidgetCallback(nameWidget, () => applyRowVisibility(node, slots));
  }

  if (slots.length === 0) {
    return;
  }

  const anchorWidget = slots[0].nameWidget;
  const insertIndex = node.widgets?.indexOf(anchorWidget) ?? -1;
  if (insertIndex >= 0) {
    node.widgets.splice(insertIndex, 0, ...slots.map((slot) => slot.rowWidget));
  }

  if (!node.__checkpointSelectorMouseHandlers) {
    node.__checkpointSelectorMouseHandlers = true;
    const originalMouseDown = node.onMouseDown;
    node.onMouseDown = function (event, pos) {
      if (event?.__checkpointSelectorHandled) {
        return true;
      }
      if (handleMouseDown(event, pos, this, slots)) {
        return true;
      }
      return originalMouseDown?.apply(this, arguments);
    };
  }

  if (!node.__checkpointSelectorConfigureHooked) {
    node.__checkpointSelectorConfigureHooked = true;
    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      const result = originalConfigure?.apply(this, arguments);
      if (info?.properties && typeof info.properties === 'object') {
        if (!this.properties || typeof this.properties !== 'object') {
          this.properties = {};
        }
        Object.assign(this.properties, info.properties);
      }
      queueMicrotask(() => {
        applyRowVisibility(this, slots);
      });
      return result;
    };
  }

  node.__checkpointSelectorSlots = slots;
  applyRowVisibility(node, slots);
};

app.registerExtension({
  name: 'craftgear.checkpointSelector',
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupCheckpointSelectorUi(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupCheckpointSelectorUi(node);
  },
});
