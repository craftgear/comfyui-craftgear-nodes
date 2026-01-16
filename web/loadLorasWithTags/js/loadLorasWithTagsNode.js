import { app } from "../../../../scripts/app.js";
import { api } from "../../../../scripts/api.js";
import { $el } from "../../../../scripts/ui.js";
import { getTagVisibility, getTopNVisibility } from "./tagFilterUtils.js";
import { normalizeSelectionValue } from "./selectionValueUtils.js";
import {
  calculateSliderValue,
  computeButtonRect,
  computeResetButtonRect,
  computeSplitWidths,
  computeSliderRatio,
  moveIndex,
  normalizeStrengthOptions,
  normalizeOptions,
  resetIconPath,
  filterLoraOptionIndices,
  filterLoraOptions,
  loraLabelButtonHeightPadding,
  loraLabelTextPadding,
  loraDialogItemBackground,
  loraDialogItemBorder,
  loraDialogItemHoverBackground,
  loraDialogItemSelectedBackground,
  loraDialogMatchTextColor,
  loraDialogMatchFontWeight,
  loraDialogItemGap,
  loraDialogItemPaddingY,
  loraDialogItemPaddingX,
  resolveLoraDialogItemBackground,
  getHighlightSegments,
  splitLoraLabel,
  getFrequencyLabelStyle,
  selectTriggerButtonHeight,
  focusInputLater,
  resolveFilteredSelection,
  resolveVisibleSelection,
  resolveSelectionByVisibleIndex,
  resolveComboLabel,
  resolveOption,
} from "./loadLorasWithTagsUiUtils.js";

const TARGET_NODE_CLASS = "LoadLorasWithTags";
const MAX_LORA_STACK = 10;
const ROW_HEIGHT = 50;
const ROW_PADDING_Y = 8;
const HEADER_HEIGHT = 24;
const MARGIN = 10;
const INNER_MARGIN = 4;
const CONTENT_PADDING = 4;
const CONTENT_PADDING_Y = 4;
const CONTENT_GAP_Y = 4;
const CONTENT_SIDE_INSET = 6;
const SELECT_BUTTON_PADDING = 2;
const SELECT_TRIGGER_LABEL = "Select Tags";
const TOGGLE_LABEL_TEXT = "Toggle All";
const DIALOG_ID = "craftgear-hoge-trigger-dialog";
const TOP_N_STORAGE_KEY = "craftgear-hoge-trigger-dialog-top-n";
let dialogKeydownHandler = null;

const getNodeClass = (node) => node?.comfyClass || node?.type || "";
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) =>
  node.widgets?.find((widget) => widget.name === name);

const markDirty = (node) => {
  if (typeof node?.setDirtyCanvas === "function") {
    node.setDirtyCanvas(true, true);
    return;
  }
  if (app?.graph?.setDirtyCanvas) {
    app.graph.setDirtyCanvas(true, true);
  }
};

const ensureHiddenBehavior = (widget) => {
  if (!widget || widget.__hogeHiddenWrapped) {
    return;
  }
  widget.__hogeOriginalComputeSize = widget.computeSize;
  widget.computeSize = (width) => {
    if (widget.__hogeHidden) {
      return [0, -4];
    }
    if (
      widget.__hogeOriginalComputeSize &&
      widget.__hogeOriginalComputeSize !== widget.computeSize
    ) {
      return widget.__hogeOriginalComputeSize(width);
    }
    return [width ?? 0, 24];
  };
  widget.__hogeHiddenWrapped = true;
};

const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  if (widget.__hogeCustomSize) {
    widget.__hogeHidden = hidden;
    if (widget.inputEl) {
      widget.inputEl.style.display = hidden ? "none" : "";
    }
    widget.hidden = hidden;
    return;
  }
  ensureHiddenBehavior(widget);
  widget.__hogeHidden = hidden;
  if (widget.inputEl) {
    widget.inputEl.style.display = hidden ? "none" : "";
  }
  widget.hidden = hidden;
  if (widget.__hogeKeepSerialization) {
    widget.serialize = true;
  }
};

const setWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  widget.value = value;
  if (typeof widget.callback === "function") {
    widget.callback(value);
  }
};

const getComboOptions = (widget) => {
  const raw = widget?.options?.values;
  return normalizeOptions(raw);
};

const setComboWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  const options = getComboOptions(widget);
  if (options.length > 0) {
    const resolved = resolveComboLabel(value, options);
    setWidgetValue(widget, resolved);
    return;
  }
  setWidgetValue(widget, value);
};

const fetchTriggers = async (loraName) => {
  const response = await api.fetchApi("/my_custom_node/lora_triggers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    rawFrequencies && typeof rawFrequencies === "object" ? rawFrequencies : {};
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
    document.removeEventListener("keydown", dialogKeydownHandler, true);
    dialogKeydownHandler = null;
  }
};

const showMessage = (message) => {
  closeDialog();
  const overlay = $el("div", {
    id: DIALOG_ID,
    style: {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.5)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  });
  const panel = $el("div", {
    style: {
      background: "#1e1e1e",
      color: "#e0e0e0",
      padding: "16px",
      borderRadius: "8px",
      minWidth: "280px",
      maxWidth: "60vw",
      fontFamily: "sans-serif",
    },
  });
  const body = $el("div", {
    textContent: message,
    style: { marginBottom: "16px" },
  });
  const okButton = $el("button", { textContent: "OK" });
  okButton.onclick = closeDialog;
  panel.append(body, okButton);
  overlay.append(panel);
  document.body.append(overlay);
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

const openTriggerDialog = async (
  loraName,
  selectionWidget,
  targetNode,
  resetTopN = false,
) => {
  const normalizedName = String(loraName ?? "");
  if (!normalizedName || normalizedName === "None") {
    showMessage("Please select a LoRA.");
    return;
  }
  const { triggers, frequencies } = await fetchTriggers(normalizedName);
  if (triggers.length === 0) {
    showMessage("No trigger words found.");
    return;
  }
  const selectionValue = normalizeSelectionValue(selectionWidget?.value);
  const selected = parseSelection(selectionValue, triggers);

  closeDialog();
  const overlay = $el("div", {
    id: DIALOG_ID,
    style: {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.6)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  });
  const panel = $el("div", {
    style: {
      background: "#1e1e1e",
      color: "#e0e0e0",
      padding: "16px",
      borderRadius: "8px",
      width: "60vw",
      height: "70vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
    },
  });
  const topControls = $el("div", {
    style: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "12px",
    },
  });
  const filterInput = $el("input", {
    type: "text",
    placeholder: "Filter tags",
    style: { flex: "1 1 auto", paddingRight: "28px" },
  });
  const clearFilterButton = $el("button", {
    textContent: "\u00d7",
    style: {
      position: "absolute",
      right: "4px",
      top: "50%",
      transform: "translateY(-50%)",
      padding: "0",
      width: "20px",
      height: "20px",
      fontSize: "16px",
      lineHeight: "1",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      opacity: "0.7",
    },
  });
  const filterContainer = $el("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      flex: "1 1 auto",
      marginLeft: "8px",
    },
  });
  filterContainer.append(filterInput, clearFilterButton);
  const savedTopN = localStorage.getItem(TOP_N_STORAGE_KEY);
  const initialTopN = resetTopN
    ? triggers.length
    : savedTopN
      ? Math.min(Math.max(1, Number(savedTopN)), triggers.length)
      : triggers.length;
  const topNSlider = $el("input", {
    type: "range",
    min: "1",
    max: String(triggers.length),
    value: String(initialTopN),
    style: { width: "200px" },
  });
  const topNLabel = $el("span", {
    textContent: `Show top ${topNSlider.value} tags`,
    style: { minWidth: "130px", fontSize: "12px" },
  });
  const topNContainer = $el("div", {
    style: {
      display: "flex",
      gap: "4px",
      alignItems: "center",
      marginLeft: "12px",
    },
  });
  topNContainer.append(topNLabel, topNSlider);
  const list = $el("div", {
    style: {
      overflow: "auto",
      padding: "8px",
      background: "#2a2a2a",
      borderRadius: "6px",
      flex: "1 1 auto",
    },
  });

  const createInfinityIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 12");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "8");
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M5 3c-2 0-3.5 1.5-3.5 3s1.5 3 3.5 3c1.7 0 3.2-1 4.5-2.5C10.8 8 12.3 9 14 9c2 0 3.5-1.5 3.5-3S16 3 14 3c-1.7 0-3.2 1-4.5 2.5C8.2 4 6.7 3 5 3z",
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
  };

  const createFrequencyLabel = (value) => {
    const label = $el("span", {
      style: getFrequencyLabelStyle(),
    });
    if (value === null || value === undefined || value === "") {
      return label;
    }
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return label;
    }
    if (!Number.isFinite(numberValue)) {
      label.append(createInfinityIcon());
      return label;
    }
    label.textContent = Number.isInteger(numberValue)
      ? String(numberValue)
      : String(numberValue);
    return label;
  };

  const renderTriggerLabel = (label, trigger, query) => {
    const segments = getHighlightSegments(trigger, query);
    label.textContent = "";
    segments.forEach((segment) => {
      if (!segment.text) {
        return;
      }
      const span = document.createElement("span");
      span.textContent = segment.text;
      if (segment.isMatch) {
        span.style.color = loraDialogMatchTextColor;
        span.style.fontWeight = loraDialogMatchFontWeight;
      }
      label.append(span);
    });
  };

  const items = triggers.map((trigger) => {
    const checkbox = $el("input", { type: "checkbox" });
    checkbox.checked = selected.has(trigger);
    const countLabel = createFrequencyLabel(frequencies?.[trigger]);
    const triggerLabel = $el("span");
    renderTriggerLabel(triggerLabel, trigger, filterInput.value);
    const label = $el("label", {
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        padding: "4px 0",
      },
    });
    label.append(checkbox, countLabel, triggerLabel);
    list.append(label);
    return { trigger, checkbox, row: label, label: triggerLabel };
  });

  const actions = $el("div", {
    style: {
      display: "flex",
      gap: "8px",
      justifyContent: "space-between",
      marginTop: "12px",
    },
  });
  const leftActions = $el("div", { style: { display: "flex", gap: "8px" } });
  const rightActions = $el("div", { style: { display: "flex", gap: "8px" } });
  const selectAllButton = $el("button", { textContent: "All" });
  const selectNoneButton = $el("button", { textContent: "None" });
  const applyButton = $el("button", { textContent: "Apply" });
  const cancelButton = $el("button", { textContent: "Cancel" });

  const updateVisibleByFilter = (value, topN) => {
    const query = String(value ?? "");
    const tagList = items.map((item) => item.trigger);
    const textVisibility = getTagVisibility(tagList, query);
    const topNValue = Number(topN) || 0;
    const topNVisibility = getTopNVisibility(tagList, frequencies, topNValue);
    items.forEach((item, index) => {
      renderTriggerLabel(item.label, item.trigger, query);
      const isVisible =
        (textVisibility[index] ?? true) && (topNVisibility[index] ?? true);
      item.row.style.display = isVisible ? "flex" : "none";
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
    const query = filterInput?.value ?? "";
    const topNValue = Number(topNSlider?.value) || triggers.length;
    topNLabel.textContent = `Show top ${topNSlider.value} tags`;
    updateVisibleByFilter(query, topNValue);
    updateTopNLabel(topNValue);
  };

  selectAllButton.onclick = () => {
    items.forEach((item) => {
      if (item.row.style.display !== "none") {
        item.checkbox.checked = true;
      }
    });
  };
  selectNoneButton.onclick = () => {
    items.forEach((item) => {
      if (item.row.style.display !== "none") {
        item.checkbox.checked = false;
      }
    });
  };
  cancelButton.onclick = closeDialog;
  applyButton.onclick = () => {
    const selectedTriggers = items
      .filter((item) => item.checkbox.checked)
      .map((item) => item.trigger);
    if (selectionWidget) {
      selectionWidget.value = JSON.stringify(selectedTriggers);
    }
    markDirty(targetNode);
    closeDialog();
  };
  dialogKeydownHandler = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyButton.click();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelButton.click();
    }
  };
  document.addEventListener("keydown", dialogKeydownHandler, true);

  filterInput.oninput = () => {
    updateVisibility();
  };
  clearFilterButton.onclick = () => {
    filterInput.value = "";
    updateVisibility();
    focusInputLater(filterInput);
  };
  topNSlider.oninput = () => {
    localStorage.setItem(TOP_N_STORAGE_KEY, topNSlider.value);
    updateVisibility();
  };
  if (resetTopN) {
    localStorage.setItem(TOP_N_STORAGE_KEY, topNSlider.value);
  }

  topControls.append(
    selectAllButton,
    selectNoneButton,
    filterContainer,
    topNContainer,
  );
  rightActions.append(cancelButton, applyButton);
  actions.append(leftActions, rightActions);

  updateVisibility();

  panel.append(topControls, list, actions);
  overlay.append(panel);
  document.body.append(overlay);
  focusInputLater(filterInput);
};

const fitText = (ctx, text, maxWidth) => {
  const raw = String(text ?? "");
  if (!maxWidth || ctx.measureText(raw).width <= maxWidth) {
    return raw;
  }
  const ellipsis = "...";
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
  const safeRadius = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
    safeRadius,
  );
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();
};

const drawToggle = (ctx, rect, isOn, isMixed = false) => {
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
  ctx.fillStyle = isOn ? "#3ba55d" : "#5a5a5a";
  if (isMixed) {
    ctx.fillStyle = "#6b6b6b";
  }
  drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fill();
  ctx.fillStyle = "#f2f2f2";
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

const formatStrengthValue = (value, options) => {
  const stepValue = Number(options?.step ?? 0.1);
  const decimals =
    stepValue > 0 && stepValue < 1
      ? (String(stepValue).split(".")[1]?.length ?? 1)
      : 0;
  if (!Number.isFinite(value)) {
    return "0";
  }
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
};

const drawStrengthSlider = (ctx, rect, widget, isEnabled) => {
  const options = normalizeStrengthOptions(widget?.options);
  const strengthValue = Number(widget?.value ?? options?.default ?? 0);
  const ratio = computeSliderRatio(strengthValue, options);
  const valueText = formatStrengthValue(strengthValue, options);
  const valueTextWidth = ctx.measureText(valueText).width;
  const valuePadding = 4;
  const valueGap = 6;
  const resetSize = Math.max(12, Math.min(16, rect.height - 2));
  const resetGap = 6;
  const resetRect = computeResetButtonRect(rect, resetSize, 0);
  const valueAreaWidth = Math.max(24, valueTextWidth + valuePadding * 2);
  const maxSliderWidth = rect.width * 0.9;
  const availableWidth =
    rect.width - valueAreaWidth - valueGap - resetSize - resetGap;
  const rawSliderWidth = Math.min(maxSliderWidth, availableWidth);
  const sliderWidth = Math.max(
    0,
    Math.min(rect.width, availableWidth, Math.max(20, rawSliderWidth)),
  );
  const sliderRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, sliderWidth),
    height: rect.height,
  };
  const trackHeight = Math.max(4, Math.min(8, sliderRect.height / 3));
  const trackY = sliderRect.y + sliderRect.height / 2 - trackHeight / 2;
  const trackRadius = trackHeight / 2;
  const knobHeight = Math.max(10, Math.min(14, sliderRect.height - 2));
  const knobWidth = Math.max(knobHeight * 1.6, knobHeight + 8);
  const knobX = sliderRect.x + ratio * sliderRect.width;
  const knobMin = sliderRect.x + knobWidth / 2;
  const knobMax = sliderRect.x + sliderRect.width - knobWidth / 2;
  const knobCenterX = Math.min(Math.max(knobX, knobMin), knobMax);
  const trackWidth = Math.max(0, sliderRect.width);
  const fillWidth = Math.max(0, knobCenterX - sliderRect.x);

  ctx.save();
  ctx.fillStyle = "#1f1f1f";
  drawRoundedRect(
    ctx,
    sliderRect.x,
    trackY,
    trackWidth,
    trackHeight,
    trackRadius,
  );
  ctx.fill();
  ctx.fillStyle = "#7a7a7a";
  drawRoundedRect(
    ctx,
    sliderRect.x,
    trackY,
    fillWidth,
    trackHeight,
    trackRadius,
  );
  ctx.fill();

  ctx.fillStyle = "#d0d0d0";
  const knobRectX = knobCenterX - knobWidth / 2;
  const knobRectY = sliderRect.y + sliderRect.height / 2 - knobHeight / 2;
  drawRoundedRect(
    ctx,
    knobRectX,
    knobRectY,
    knobWidth,
    knobHeight,
    knobHeight / 2,
  );
  ctx.fill();

  ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
  const valueRectX = sliderRect.x + sliderRect.width + valueGap;
  const valueRectMax = resetRect.x - resetGap;
  const valueRectWidth = Math.max(
    0,
    Math.min(valueAreaWidth, valueRectMax - valueRectX),
  );
  const valueCenterX = valueRectX + valueRectWidth / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(valueText, valueCenterX, rect.y + rect.height / 2);
  ctx.globalAlpha *= isEnabled ? 1 : 0.4;
  ctx.fillStyle = "#2a2a2a";
  drawRoundedRect(
    ctx,
    resetRect.x,
    resetRect.y,
    resetRect.width,
    resetRect.height,
    resetRect.height / 2,
  );
  ctx.fill();
  ctx.strokeStyle = "#4a4a4a";
  ctx.stroke();
  const iconSize = Math.max(0, Math.min(resetRect.width, resetRect.height) - 4);
  if (iconSize > 0 && typeof Path2D !== "undefined") {
    const scale = iconSize / 32;
    const iconX = resetRect.x + (resetRect.width - iconSize) / 2;
    const iconY = resetRect.y + (resetRect.height - iconSize) / 2;
    ctx.save();
    ctx.translate(iconX, iconY);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#d0d0d0";
    ctx.fill(new Path2D(resetIconPath));
    ctx.restore();
  }
  ctx.restore();

  return { sliderRect, resetRect };
};

const isPointInRect = (pos, rect) => {
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

const getLoraState = (widget) => {
  const options = getComboOptions(widget);
  const raw = widget?.value;
  const { index } = resolveOption(raw, options);
  const label = resolveComboLabel(raw, options);
  return { index, label, options, raw };
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

const resizeNodeToContent = (node, keepWidth = false) => {
  const size = node?.computeSize?.();
  if (!Array.isArray(size)) {
    return;
  }
  const nextSize = [size[0], size[1]];
  if (keepWidth) {
    const width = node?.size?.[0];
    if (typeof width === "number" && Number.isFinite(width) && width > 0) {
      nextSize[0] = width;
    }
  }
  if (typeof node?.setSize === "function") {
    node.setSize(nextSize);
    return;
  }
  node.size = nextSize;
};

const setupHogeUi = (node) => {
  if (node.__hogeUiReady) {
    return;
  }
  node.__hogeUiReady = true;

  const slots = [];
  let headerWidget = null;

  const createHeaderWidget = (getAllToggleState) => {
    const widget = {
      type: "hoge-header",
      name: "hoge_header",
      value: "",
      serialize: false,
      computeSize: (width) => [width ?? 0, HEADER_HEIGHT],
      draw(ctx, _node, width, y, height) {
        const rowHeight = height ?? HEADER_HEIGHT;
        const midY = y + rowHeight / 2;
        const headerMargin = MARGIN + CONTENT_SIDE_INSET;
        const toggleHeight = Math.max(10, Math.min(14, rowHeight - 8));
        const toggleWidth = Math.round(toggleHeight * 1.8);
        const toggleRect = {
          x: headerMargin,
          y: y + (rowHeight - toggleHeight) / 2,
          width: toggleWidth,
          height: toggleHeight,
        };
        widget.__toggleRect = toggleRect;
        const state = getAllToggleState?.() ?? null;
        drawToggle(ctx, toggleRect, state === true, state === null);
        ctx.save();
        ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
          TOGGLE_LABEL_TEXT,
          toggleRect.x + toggleRect.width + INNER_MARGIN,
          midY,
        );
        ctx.textAlign = "right";
        ctx.restore();
      },
    };
    node.widgets = node.widgets || [];
    node.widgets.push(widget);
    return widget;
  };

  const createRowWidget = (slot) => {
    const widget = {
      type: "hoge-row",
      name: `hoge_row_${slot.index}`,
      value: "",
      serialize: false,
      __hogeCustomSize: true,
      draw(ctx, _node, width, y, _height) {
        const rowHeight = ROW_HEIGHT;
        const rowMargin = MARGIN;
        const contentMargin = rowMargin + CONTENT_SIDE_INSET;
        let posX = contentMargin;
        const contentWidth = width - rowMargin * 2;
        const contentTop = y + ROW_PADDING_Y;
        const availableHeight = rowHeight - ROW_PADDING_Y * 2;
        const lineHeight = Math.max(16, (availableHeight - CONTENT_GAP_Y) / 2);
        const controlTop = contentTop + lineHeight + CONTENT_GAP_Y;

        ctx.save();
        ctx.fillStyle = "#2a2a2a";
        drawRoundedRect(ctx, rowMargin, y, width - rowMargin * 2, rowHeight, 6);
        ctx.fill();

        const toggleHeight = Math.max(12, Math.min(18, rowHeight - 8));
        const toggleWidth = Math.round(toggleHeight * 1.8);
        const toggleRect = {
          x: posX,
          y: contentTop + (availableHeight - toggleHeight) / 2,
          width: toggleWidth,
          height: toggleHeight,
        };
        slot.__hitToggle = toggleRect;
        drawToggle(ctx, toggleRect, !!slot.toggleWidget?.value);
        posX += toggleRect.width + INNER_MARGIN;

        const labelAreaWidth = Math.max(10, rowMargin + contentWidth - posX);
        const { label } = getLoraState(slot.loraWidget);
        const isOn = !!slot.toggleWidget?.value;
        if (!isOn) {
          ctx.globalAlpha *= 0.4;
        }
        ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const labelButtonBaseRect = computeButtonRect(
          posX,
          contentTop,
          labelAreaWidth,
          lineHeight,
          CONTENT_PADDING_Y,
        );
        const labelButtonHeightPadding = Math.max(
          0,
          loraLabelButtonHeightPadding,
        );
        const labelButtonHeight = Math.min(
          labelButtonBaseRect.height + labelButtonHeightPadding,
          lineHeight,
        );
        const labelButtonRect = {
          x: labelButtonBaseRect.x,
          y: contentTop + (lineHeight - labelButtonHeight) / 2,
          width: labelButtonBaseRect.width,
          height: labelButtonHeight,
        };
        slot.__hitLabel = labelButtonRect;
        ctx.fillStyle = "#242424";
        drawRoundedRect(
          ctx,
          labelButtonRect.x,
          labelButtonRect.y,
          labelButtonRect.width,
          labelButtonRect.height,
          6,
        );
        ctx.fill();
        ctx.strokeStyle = "#3a3a3a";
        ctx.stroke();
        ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
        const labelTextRect = computeButtonRect(
          labelButtonRect.x,
          labelButtonRect.y,
          labelButtonRect.width,
          labelButtonRect.height,
          loraLabelTextPadding,
        );
        const labelTextX = labelTextRect.x;
        const labelTextWidth = Math.max(0, labelTextRect.width);
        ctx.fillText(
          fitText(ctx, label || "None", labelTextWidth),
          labelTextX,
          labelTextRect.y + labelTextRect.height / 2,
        );

        const strengthHeight = Math.max(12, lineHeight - CONTENT_PADDING_Y * 2);
        const controlWidth = Math.max(
          100,
          labelAreaWidth - CONTENT_PADDING * 2,
        );
        const controlLeft = posX + CONTENT_PADDING;
        const { first: strengthWidth, second: buttonWidth } =
          computeSplitWidths(controlWidth, 2, 1, INNER_MARGIN);
        const strengthRect = {
          x: controlLeft,
          y:
            controlTop +
            CONTENT_PADDING_Y +
            (lineHeight - CONTENT_PADDING_Y * 2 - strengthHeight) / 2,
          width: Math.max(0, strengthWidth),
          height: strengthHeight,
        };
        const strengthRects = drawStrengthSlider(
          ctx,
          strengthRect,
          slot.strengthWidget,
          isOn,
        );
        slot.__hitStrengthSlider = strengthRects.sliderRect;
        slot.__hitStrengthReset = strengthRects.resetRect;

        const buttonHeight = selectTriggerButtonHeight;
        const buttonRect = computeButtonRect(
          controlLeft + strengthWidth + INNER_MARGIN,
          controlTop + (lineHeight - buttonHeight) / 2,
          Math.max(0, buttonWidth),
          selectTriggerButtonHeight,
          SELECT_BUTTON_PADDING,
        );
        slot.__hitSelectTrigger = buttonRect;
        ctx.globalAlpha *= isOn ? 0.85 : 0.45;
        ctx.fillStyle = "#242424";
        drawRoundedRect(
          ctx,
          buttonRect.x,
          buttonRect.y,
          buttonRect.width,
          buttonRect.height,
          6,
        );
        ctx.fill();
        ctx.strokeStyle = "#3a3a3a";
        ctx.stroke();
        ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          SELECT_TRIGGER_LABEL,
          buttonRect.x + buttonRect.width / 2,
          buttonRect.y + buttonRect.height / 2,
        );

        ctx.restore();
      },
    };
    widget.computeSize = (width) => {
      if (widget.__hogeHidden) {
        return [0, -4];
      }
      return [width ?? 0, ROW_HEIGHT];
    };
    return widget;
  };

  const getSlotWidgets = (index) => {
    const loraWidget = getWidget(node, `lora_name_${index}`);
    const strengthWidget = getWidget(node, `lora_strength_${index}`);
    const toggleWidget = getWidget(node, `lora_on_${index}`);
    const selectionWidget = getWidget(node, `tag_selection_${index}`);
    if (!loraWidget || !strengthWidget || !toggleWidget || !selectionWidget) {
      return null;
    }
    return {
      index,
      loraWidget,
      strengthWidget,
      toggleWidget,
      selectionWidget,
      rowWidget: null,
    };
  };

  const applyLoraValue = (widget, value) => {
    if (value === undefined || value === null) {
      setComboWidgetValue(widget, "None");
      return;
    }
    setComboWidgetValue(widget, value);
  };

  const applySavedValues = (savedValues) => {
    if (!Array.isArray(savedValues)) {
      return;
    }
    const stride =
      savedValues.length % 4 === 0 ? 4 : savedValues.length % 3 === 0 ? 3 : 4;
    slots.forEach((slot, index) => {
      const base = index * stride;
      if (savedValues.length <= base) {
        return;
      }
      applyLoraValue(slot.loraWidget, savedValues[base]);
      const strengthDefault = slot.strengthWidget?.options?.default ?? 1.0;
      const strengthValue =
        savedValues.length > base + 1 ? savedValues[base + 1] : strengthDefault;
      setWidgetValue(
        slot.strengthWidget,
        Number.isFinite(strengthValue) ? strengthValue : strengthDefault,
      );
      const toggleValue =
        savedValues.length > base + 2 ? savedValues[base + 2] : true;
      setWidgetValue(slot.toggleWidget, !!toggleValue);
      const selectionValue =
        savedValues.length > base + 3 ? savedValues[base + 3] : "";
      slot.selectionWidget.value = normalizeSelectionValue(
        stride === 4 ? selectionValue : "",
      );
    });
  };

  const isFilledName = (value) => {
    const trimmed = String(value ?? "").trim();
    return trimmed !== "" && trimmed !== "None";
  };

  const isSlotFilled = (state) => {
    if (typeof state.raw === "number") {
      return state.raw > 0;
    }
    if (typeof state.raw === "string") {
      return isFilledName(state.raw);
    }
    if (state.label) {
      return isFilledName(state.label);
    }
    return false;
  };

  const applyRowVisibility = () => {
    let lastFilledIndex = 0;
    const states = slots.map((slot) => {
      const state = getLoraState(slot.loraWidget);
      if (isSlotFilled(state)) {
        lastFilledIndex = Math.max(lastFilledIndex, slot.index);
      }
      return { slot, state };
    });
    const activeCount = Math.min(
      MAX_LORA_STACK,
      Math.max(1, lastFilledIndex + 1),
    );
    states.forEach((entry) => {
      const shouldShow = entry.slot.index <= activeCount;
      if (entry.slot.rowWidget) {
        setWidgetHidden(entry.slot.rowWidget, !shouldShow);
      }
    });
    resizeNodeToContent(node, true);
    markDirty(node);
  };

  const normalizeLoraWidgetValues = () => {
    slots.forEach((slot) => {
      const options = getComboOptions(slot.loraWidget);
      if (options.length === 0) {
        return;
      }
      const resolved = resolveComboLabel(slot.loraWidget?.value, options);
      if (slot.loraWidget?.value !== resolved) {
        setWidgetValue(slot.loraWidget, resolved);
      }
    });
  };

  const getAllToggleState = () => {
    let allOn = true;
    let allOff = true;
    let hasVisible = false;
    slots.forEach((slot) => {
      if (slot.rowWidget?.hidden) {
        return;
      }
      hasVisible = true;
      const isOn = !!slot.toggleWidget?.value;
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
      if (slot.rowWidget?.hidden) {
        return;
      }
      setWidgetValue(slot.toggleWidget, nextValue);
    });
  };

  const openLoraDialog = (slot, targetNode) => {
    const options = getComboOptions(slot.loraWidget);
    if (!Array.isArray(options) || options.length === 0) {
      showMessage("No LoRAs available.");
      return;
    }
    let selectedOptionIndex = -1;
    let selectedVisibleIndex = -1;
    let filteredIndices = [];
    let visibleOptions = [];
    let hoveredVisibleIndex = -1;
    let renderedButtons = [];

    closeDialog();
    const overlay = $el("div", {
      id: DIALOG_ID,
      style: {
        position: "fixed",
        inset: "0",
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    });
    const panel = $el("div", {
      style: {
        background: "#1e1e1e",
        color: "#e0e0e0",
        padding: "16px",
        borderRadius: "8px",
        width: "50vw",
        height: "70vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
      },
    });
    const title = null;
    const filterInput = $el("input", {
      type: "text",
      placeholder: "Filter LoRAs",
      style: { flex: "1 1 auto", paddingRight: "28px" },
    });
    const clearFilterButton = $el("button", {
      textContent: "\u00d7",
      style: {
        position: "absolute",
        right: "4px",
        top: "50%",
        transform: "translateY(-50%)",
        padding: "0",
        width: "20px",
        height: "20px",
        fontSize: "16px",
        lineHeight: "1",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        opacity: "0.7",
      },
    });
    const filterContainer = $el("div", {
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        marginBottom: "12px",
      },
    });
    filterContainer.append(filterInput, clearFilterButton);
    const list = $el("div", {
      style: {
        overflow: "auto",
        padding: "8px",
        background: "#2a2a2a",
        borderRadius: "6px",
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        gap: `${loraDialogItemGap}px`,
      },
    });
    const actions = $el("div", {
      style: {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "12px",
      },
    });
    const cancelButton = $el("button", { textContent: "Cancel" });
    actions.append(cancelButton);

    const applySelection = (nextLabel) => {
      const prevLabel = resolveComboLabel(slot.loraWidget?.value, options);
      const prevToggle = !!slot.toggleWidget?.value;
      setComboWidgetValue(slot.loraWidget, nextLabel);
      setWidgetValue(slot.toggleWidget, prevToggle);
      if (prevLabel !== nextLabel) {
        setWidgetValue(slot.selectionWidget, "");
        slot.selectionWidget.__hogeResetTopN = true;
      }
      applyRowVisibility();
      markDirty(targetNode);
    };

    const renderLabel = (button, label, query) => {
      const parts = splitLoraLabel(label);
      const segments = getHighlightSegments(parts.base, query);
      button.textContent = "";
      segments.forEach((segment) => {
        if (!segment.text) {
          return;
        }
        const span = document.createElement("span");
        span.textContent = segment.text;
        if (segment.isMatch) {
          span.style.color = loraDialogMatchTextColor;
          span.style.fontWeight = loraDialogMatchFontWeight;
        }
        button.append(span);
      });
      if (parts.extension) {
        button.append(document.createTextNode(parts.extension));
      }
    };

    const applySelectedLabel = () => {
      if (visibleOptions.length === 0) {
        return;
      }
      const nextIndex =
        selectedVisibleIndex >= 0 &&
        selectedVisibleIndex < visibleOptions.length
          ? visibleOptions[selectedVisibleIndex].index
          : visibleOptions[0].index;
      const nextLabel = options[nextIndex];
      if (!nextLabel) {
        return;
      }
      applySelection(nextLabel);
      closeDialog();
    };

    const refreshButtonStates = () => {
      renderedButtons.forEach((entry) => {
        const isSelected = entry.index === selectedVisibleIndex;
        const isHovered = entry.index === hoveredVisibleIndex;
        entry.button.style.background = resolveLoraDialogItemBackground(
          isSelected,
          isHovered,
        );
      });
    };

    const updateSelectionByVisibleIndex = (nextVisibleIndex) => {
      const resolved = resolveSelectionByVisibleIndex(
        visibleOptions,
        nextVisibleIndex,
      );
      if (resolved.selectedOptionIndex < 0) {
        return false;
      }
      selectedVisibleIndex = resolved.selectedVisibleIndex;
      selectedOptionIndex = resolved.selectedOptionIndex;
      return true;
    };

    const renderList = (forceTopSelection = false) => {
      list.textContent = "";
      renderedButtons = [];
      hoveredVisibleIndex = -1;
      filteredIndices = filterLoraOptionIndices(filterInput.value, options);
      visibleOptions = filteredIndices
        .map((optionIndex) => ({
          index: optionIndex,
          label: options[optionIndex],
        }))
        .filter((entry) => entry.label !== undefined && entry.label !== null);
      if (visibleOptions.length === 0) {
        selectedVisibleIndex = -1;
        list.append(
          $el("div", {
            textContent: "No matches.",
            style: { opacity: 0.7, padding: "8px" },
          }),
        );
        return;
      }
      const resolvedSelection = resolveFilteredSelection(
        visibleOptions,
        selectedOptionIndex,
        forceTopSelection,
      );
      selectedVisibleIndex = resolvedSelection.selectedVisibleIndex;
      selectedOptionIndex = resolvedSelection.selectedOptionIndex;
      visibleOptions.forEach((entry, index) => {
        const label = entry.label;
        const button = $el("button", {
          style: {
            textAlign: "left",
            padding: `${loraDialogItemPaddingY}px ${loraDialogItemPaddingX}px`,
            borderRadius: "6px",
            border: loraDialogItemBorder,
            background: loraDialogItemBackground,
            cursor: "pointer",
          },
        });
        button.style.color = "#e0e0e0";
        button.style.fontWeight = "400";
        renderLabel(button, label, filterInput.value);
        renderedButtons.push({ button, index });
        button.onmouseenter = () => {
          hoveredVisibleIndex = index;
          updateSelectionByVisibleIndex(index);
          refreshButtonStates();
        };
        button.onmouseleave = () => {
          if (hoveredVisibleIndex !== index) {
            return;
          }
          hoveredVisibleIndex = -1;
          refreshButtonStates();
        };
        button.onclick = () => {
          applySelection(label);
          closeDialog();
        };
        list.append(button);
      });
      refreshButtonStates();
    };

    cancelButton.onclick = closeDialog;
    filterInput.oninput = () => renderList(true);
    clearFilterButton.onclick = () => {
      filterInput.value = "";
      renderList(true);
      focusInputLater(filterInput);
    };
    const moveSelection = (direction) => {
      if (visibleOptions.length === 0) {
        return;
      }
      const baseIndex = selectedVisibleIndex;
      const nextIndex = moveIndex(baseIndex, direction, visibleOptions.length);
      const nextOptionIndex = visibleOptions[nextIndex]?.index;
      if (nextOptionIndex === undefined) {
        return;
      }
      selectedVisibleIndex = nextIndex;
      selectedOptionIndex = nextOptionIndex;
      renderList();
    };

    const handleDialogKeyDown = (event) => {
      if (event?.__hogeLoraDialogHandled) {
        return;
      }
      event.__hogeLoraDialogHandled = true;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        applySelectedLabel();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelButton.click();
      }
    };
    dialogKeydownHandler = handleDialogKeyDown;
    document.addEventListener("keydown", dialogKeydownHandler, true);
    filterInput.addEventListener("keydown", handleDialogKeyDown);

    renderList();
    panel.append(filterContainer, list, actions);
    overlay.append(panel);
    document.body.append(overlay);
    focusInputLater(filterInput);
  };

  const handleMouseDown = (event, pos, targetNode) => {
    if (
      event?.type &&
      event.type !== "mousedown" &&
      event.type !== "pointerdown"
    ) {
      return false;
    }
    if (event?.__hogeHandled) {
      return true;
    }
    if (!Array.isArray(pos)) {
      return false;
    }
    if (
      headerWidget?.__toggleRect &&
      isPointInRect(pos, headerWidget.__toggleRect)
    ) {
      const state = getAllToggleState();
      setAllToggleState(state === true ? false : true);
      if (event) {
        event.__hogeHandled = true;
      }
      markDirty(targetNode);
      return true;
    }
    for (const slot of slots) {
      if (slot.rowWidget?.hidden) {
        continue;
      }
      const isEnabled = !!slot.toggleWidget?.value;
      if (isPointInRect(pos, slot.__hitToggle)) {
        setWidgetValue(slot.toggleWidget, !slot.toggleWidget?.value);
        if (event) {
          event.__hogeHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitSelectTrigger)) {
        if (!isEnabled) {
          if (event) {
            event.__hogeHandled = true;
          }
          return true;
        }
        const { label } = getLoraState(slot.loraWidget);
        const shouldResetTopN = !!slot.selectionWidget?.__hogeResetTopN;
        slot.selectionWidget.__hogeResetTopN = false;
        openTriggerDialog(
          label,
          slot.selectionWidget,
          targetNode,
          shouldResetTopN,
        );
        if (event) {
          event.__hogeHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitLabel)) {
        if (!isEnabled) {
          if (event) {
            event.__hogeHandled = true;
          }
          return true;
        }
        const isRightClick = event?.button === 2 || event?.which === 3;
        if (isRightClick) {
          if (event) {
            event.__hogeHandled = true;
          }
          return true;
        }
        openLoraDialog(slot, targetNode);
        if (event) {
          event.__hogeHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitStrengthReset)) {
        if (!isEnabled) {
          if (event) {
            event.__hogeHandled = true;
          }
          return true;
        }
        const strengthDefault = slot.strengthWidget?.options?.default ?? 1.0;
        setWidgetValue(slot.strengthWidget, strengthDefault);
        if (event) {
          event.__hogeHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitStrengthSlider)) {
        if (!isEnabled) {
          if (event) {
            event.__hogeHandled = true;
          }
          return true;
        }
        targetNode.__hogeActiveSlider = slot;
        const next = calculateSliderValue(
          pos[0],
          slot.__hitStrengthSlider,
          normalizeStrengthOptions(slot.strengthWidget?.options),
        );
        setWidgetValue(slot.strengthWidget, next);
        if (event) {
          event.__hogeHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
    }
    return false;
  };

  const handleMouseMove = (event, pos, targetNode) => {
    if (
      event?.type &&
      event.type !== "mousemove" &&
      event.type !== "pointermove"
    ) {
      return false;
    }
    if (!Array.isArray(pos)) {
      return false;
    }
    const activeSlot = targetNode.__hogeActiveSlider;
    if (!activeSlot?.__hitStrengthSlider) {
      return false;
    }
    const next = calculateSliderValue(
      pos[0],
      activeSlot.__hitStrengthSlider,
      normalizeStrengthOptions(activeSlot.strengthWidget?.options),
    );
    setWidgetValue(activeSlot.strengthWidget, next);
    if (event) {
      event.__hogeHandled = true;
    }
    markDirty(targetNode);
    return true;
  };

  const handleMouseUp = (event, _pos, targetNode) => {
    if (event?.type && event.type !== "mouseup" && event.type !== "pointerup") {
      return false;
    }
    if (!targetNode.__hogeActiveSlider) {
      return false;
    }
    targetNode.__hogeActiveSlider = null;
    if (event) {
      event.__hogeHandled = true;
    }
    markDirty(targetNode);
    return true;
  };

  for (let index = 1; index <= MAX_LORA_STACK; index += 1) {
    const slot = getSlotWidgets(index);
    if (!slot) {
      continue;
    }
    slot.rowWidget = createRowWidget(slot);
    slot.rowWidget.type = "custom";
    slot.rowWidget.mouse = (event, pos) => handleMouseDown(event, pos, node);
    slot.rowWidget.onMouseDown = (event, pos) =>
      handleMouseDown(event, pos, node);
    slots.push(slot);
    slot.loraWidget.__hogeKeepSerialization = true;
    slot.strengthWidget.__hogeKeepSerialization = true;
    slot.toggleWidget.__hogeKeepSerialization = true;
    slot.selectionWidget.__hogeKeepSerialization = true;
    setWidgetHidden(slot.loraWidget, true);
    setWidgetHidden(slot.strengthWidget, true);
    setWidgetHidden(slot.toggleWidget, true);
    setWidgetHidden(slot.selectionWidget, true);
  }

  if (slots.length === 0) {
    return;
  }

  headerWidget = createHeaderWidget(getAllToggleState);
  headerWidget.type = "custom";
  headerWidget.mouse = (event, pos) => handleMouseDown(event, pos, node);
  headerWidget.onMouseDown = (event, pos) => handleMouseDown(event, pos, node);
  const anchorWidget = slots[0].loraWidget;
  const rowWidgets = [headerWidget, ...slots.map((slot) => slot.rowWidget)];
  insertBeforeWidget(node, anchorWidget, rowWidgets);

  if (!node.__hogeMouseHandlers || !node.onMouseDown?.__hogeHandler) {
    node.__hogeMouseHandlers = true;
    const originalMouseDown = node.onMouseDown;
    const wrappedMouseDown = function (event, pos) {
      if (event?.__hogeHandled) {
        return true;
      }
      if (handleMouseDown(event, pos, this)) {
        return true;
      }
      return originalMouseDown?.apply(this, arguments);
    };
    wrappedMouseDown.__hogeHandler = true;
    node.onMouseDown = wrappedMouseDown;
  }

  if (!node.__hogeMouseMoveWrapped) {
    node.__hogeMouseMoveWrapped = true;
    const originalMouseMove = node.onMouseMove;
    node.onMouseMove = function (event, pos) {
      if (event?.__hogeHandled) {
        return true;
      }
      if (handleMouseMove(event, pos, this)) {
        return true;
      }
      return originalMouseMove?.apply(this, arguments);
    };
  }

  if (!node.__hogeMouseUpWrapped) {
    node.__hogeMouseUpWrapped = true;
    const originalMouseUp = node.onMouseUp;
    node.onMouseUp = function (event, pos) {
      if (event?.__hogeHandled) {
        return true;
      }
      if (handleMouseUp(event, pos, this)) {
        return true;
      }
      return originalMouseUp?.apply(this, arguments);
    };
  }

  if (!node.__hogeSerializeWrapped) {
    node.__hogeSerializeWrapped = true;
    const originalSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      originalSerialize?.apply(this, arguments);
      const values = [];
      slots.forEach((slot) => {
        const strengthDefault = slot.strengthWidget?.options?.default ?? 1.0;
        const loraValue = resolveComboLabel(
          slot.loraWidget?.value,
          getComboOptions(slot.loraWidget),
        );
        values.push(
          loraValue,
          slot.strengthWidget?.value ?? strengthDefault,
          slot.toggleWidget?.value ?? true,
          normalizeSelectionValue(slot.selectionWidget?.value),
        );
      });
      o.widgets_values = values;
    };
  }

  if (!node.__hogeConfigureHooked) {
    node.__hogeConfigureHooked = true;
    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      node.__hogeConfigured = true;
      if (Array.isArray(info?.widgets_values)) {
        applySavedValues(info.widgets_values);
      }
      normalizeLoraWidgetValues();
      const result = originalConfigure?.apply(this, arguments);
      queueMicrotask(() => {
        applyRowVisibility();
      });
      return result;
    };
  }

  normalizeLoraWidgetValues();
  applyRowVisibility();
};

app.registerExtension({
  name: "craftgear.loadLorasWithTags",
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupHogeUi(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupHogeUi(node);
  },
});
