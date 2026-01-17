import { app } from "../../../../scripts/app.js";
import { api } from "../../../../scripts/api.js";
import { $el } from "../../../../scripts/ui.js";
import { getTagVisibility, getTopNVisibility } from "./tagFilterUtils.js";
import { normalizeSelectionValue } from "./selectionValueUtils.js";
import {
  computeButtonRect,
  computeSliderRatio,
  moveIndex,
  normalizeStrengthOptions,
  normalizeOptions,
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
  missingLoraLabelColor,
  loraDialogItemGap,
  loraDialogItemPaddingY,
  loraDialogItemPaddingX,
  loraDialogWidth,
  tagDialogItemBackground,
  resolveLoraDialogItemBackground,
  resolveTagDialogItemBackground,
  getHighlightSegments,
  splitLoraLabel,
  getFrequencyLabelStyle,
  selectTriggerButtonHeight,
  focusInputLater,
  resolveFilteredSelection,
  resolveVisibleSelection,
  resolveSelectionByVisibleIndex,
  resolveHoverSelection,
  resolveActiveIndex,
  resolveComboLabel,
  resolveComboDisplayLabel,
  shouldPreserveUnknownOption,
  resolveOption,
  resolveBelowCenteredPopupPosition,
  resolveInlineControlLayout,
  resolveFixedLabelWidth,
  resolveCenteredY,
  resolveRowLineHeight,
  resolveToggleSize,
  resolveToggleLabelRect,
  shouldCloseDialogOnOverlayClick,
  resolveStrengthDefault,
  resetIconPath,
  shouldCloseStrengthPopupOnRelease,
  shouldCloseStrengthPopupOnPress,
  shouldCloseStrengthPopupOnInnerClick,
  shouldToggleTagSelectionOnKey,
  shouldBlurTagFilterOnKey,
  buildStrengthRangeCss,
  buildStrengthRangeProgressBackground,
  strengthRangeInputClass,
  strengthRangeThumbSize,
  strengthRangeTrackHeight,
} from "./loadLorasWithTagsUiUtils.js";

const TARGET_NODE_CLASS = "LoadLorasWithTags";
const MAX_LORA_STACK = 10;
const ROW_HEIGHT = 24;
const ROW_PADDING_Y = 0;
const HEADER_HEIGHT = 24;
const HEADER_TOP_PADDING = 4;
const MARGIN = 10;
const INNER_MARGIN = 4;
const CONTENT_PADDING_Y = 4;
const CONTENT_SIDE_INSET = 6;
const SELECT_BUTTON_PADDING = 2;
const SELECT_TRIGGER_LABEL = "Select Tags";
const TOGGLE_LABEL_TEXT = "Toggle All";
const DIALOG_ID = "craftgear-load-loras-with-tags-trigger-dialog";
const STRENGTH_POPUP_ID = "craftgear-load-loras-with-tags-strength-popup";
const STRENGTH_POPUP_STYLE_ID = "craftgear-load-loras-with-tags-strength-popup-style";
const TOP_N_STORAGE_KEY = "craftgear-load-loras-with-tags-trigger-dialog-top-n";
let dialogKeydownHandler = null;
let strengthPopupState = null;

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
  if (!widget || widget.__loadLorasHiddenWrapped) {
    return;
  }
  widget.__loadLorasOriginalComputeSize = widget.computeSize;
  widget.computeSize = (width) => {
    if (widget.__loadLorasHidden) {
      return [0, -4];
    }
    if (
      widget.__loadLorasOriginalComputeSize &&
      widget.__loadLorasOriginalComputeSize !== widget.computeSize
    ) {
      return widget.__loadLorasOriginalComputeSize(width);
    }
    return [width ?? 0, 24];
  };
  widget.__loadLorasHiddenWrapped = true;
};

const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  if (widget.__loadLorasCustomSize) {
    widget.__loadLorasHidden = hidden;
    if (widget.inputEl) {
      widget.inputEl.style.display = hidden ? "none" : "";
    }
    widget.hidden = hidden;
    return;
  }
  ensureHiddenBehavior(widget);
  widget.__loadLorasHidden = hidden;
  if (widget.inputEl) {
    widget.inputEl.style.display = hidden ? "none" : "";
  }
  widget.hidden = hidden;
  if (widget.__loadLorasKeepSerialization) {
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

const closeStrengthPopup = () => {
  const existing = document.getElementById(STRENGTH_POPUP_ID);
  if (existing) {
    existing.remove();
  }
  if (strengthPopupState?.cleanup) {
    strengthPopupState.cleanup();
  }
  if (strengthPopupState?.targetNode) {
    strengthPopupState.targetNode.__loadLorasStrengthPopupSlot = null;
  }
  strengthPopupState = null;
};

const closeDialog = () => {
  closeStrengthPopup();
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
  overlay.addEventListener("mousedown", (event) => {
    if (!shouldCloseDialogOnOverlayClick(overlay, event.target)) {
      return;
    }
    closeDialog();
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

const resolveStrengthPopupAnchor = (slot, targetNode, event) => {
  const fallbackX = event?.clientX ?? 0;
  const fallbackY = event?.clientY ?? 0;
  const rect = slot?.__hitStrengthValue;
  const nodePos = Array.isArray(targetNode?.pos) ? targetNode.pos : null;
  const canvas = app?.canvas;
  const canvasElement = canvas?.canvas;
  if (!rect || !nodePos || !canvasElement) {
    return { x: fallbackX, y: fallbackY, width: 0, height: 0 };
  }
  const bounds = canvasElement.getBoundingClientRect?.();
  const scaleRaw = Number(canvas?.ds ?? canvas?.scale ?? 1);
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;
  const offsetX = Number(canvas?.offset?.[0] ?? 0);
  const offsetY = Number(canvas?.offset?.[1] ?? 0);
  const originX = Number(bounds?.left ?? 0);
  const originY = Number(bounds?.top ?? 0);
  const graphX = Number(nodePos[0] ?? 0) + Number(rect.x ?? 0);
  const graphY = Number(nodePos[1] ?? 0) + Number(rect.y ?? 0);
  const width = Math.max(0, Number(rect.width ?? 0));
  const height = Math.max(0, Number(rect.height ?? 0));
  return {
    x: originX + (graphX + offsetX) * scale,
    y: originY + (graphY + offsetY) * scale,
    width: width * scale,
    height: height * scale,
  };
};

const updateStrengthPopupValue = (slot) => {
  if (!strengthPopupState || strengthPopupState.slot !== slot) {
    return;
  }
  const options = normalizeStrengthOptions(slot.strengthWidget?.options);
  const strengthDefault = resolveStrengthDefault(options, 1.0);
  const strengthValue = Number(slot.strengthWidget?.value ?? strengthDefault);
  strengthPopupState.range.value = String(strengthValue);
  updateStrengthRangeBackground(strengthPopupState.range, strengthValue, options);
};

const updateStrengthRangeBackground = (range, value, options) => {
  if (!range) {
    return;
  }
  const ratio = computeSliderRatio(value, options);
  range.style.background = buildStrengthRangeProgressBackground(ratio);
};

const ensureStrengthPopupStyles = () => {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(STRENGTH_POPUP_STYLE_ID)) {
    return;
  }
  const css = buildStrengthRangeCss(
    strengthRangeInputClass,
    strengthRangeThumbSize,
    strengthRangeTrackHeight,
  );
  if (!css) {
    return;
  }
  const style = document.createElement("style");
  style.id = STRENGTH_POPUP_STYLE_ID;
  style.textContent = css;
  document.head.append(style);
};

const openStrengthPopup = (slot, event, targetNode) => {
  if (!slot?.strengthWidget || !targetNode) {
    return;
  }
  if (targetNode.__loadLorasStrengthPopupSlot === slot) {
    closeStrengthPopup();
    return;
  }
  closeStrengthPopup();
  ensureStrengthPopupStyles();
  const options = normalizeStrengthOptions(slot.strengthWidget?.options);
  const strengthDefault = resolveStrengthDefault(options, 1.0);
  const strengthValue = Number(slot.strengthWidget?.value ?? strengthDefault);
  const min = Number(options?.min ?? 0);
  const max = Number(options?.max ?? 1);
  const step = Number(options?.step ?? 0.1);
  const popup = $el("div", {
    id: STRENGTH_POPUP_ID,
    style: {
      position: "fixed",
      zIndex: 10001,
      background: "#1e1e1e",
      border: "1px solid #3a3a3a",
      borderRadius: "6px",
      padding: "8px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontFamily: "sans-serif",
    },
  });
  const controlRow = $el("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
    },
  });
  const resetButton = $el("button", {
    "aria-label": "Reset",
    title: "Reset",
    style: {
      width: "22px",
      height: "22px",
      padding: "0",
      borderRadius: "4px",
      border: "1px solid #3a3a3a",
      background: "#2a2a2a",
      color: "#e0e0e0",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  });
  const resetIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  resetIcon.setAttribute("viewBox", "0 0 32 32");
  resetIcon.setAttribute("width", "14");
  resetIcon.setAttribute("height", "14");
  const resetPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  resetPath.setAttribute("d", resetIconPath);
  resetPath.setAttribute("fill", "currentColor");
  resetIcon.append(resetPath);
  resetButton.append(resetIcon);
  resetButton.onclick = () => {
    const next = resolveStrengthDefault(options, 1.0);
    setWidgetValue(slot.strengthWidget, next);
    updateStrengthPopupValue(slot);
    markDirty(targetNode);
    closeStrengthPopup();
  };
  const range = $el("input", {
    type: "range",
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 1,
    step: Number.isFinite(step) && step > 0 ? step : 0.1,
    value: Number.isFinite(strengthValue) ? strengthValue : 0,
    style: { width: "220px", flex: "1 1 auto" },
  });
  range.className = strengthRangeInputClass;
  controlRow.append(range, resetButton);
  updateStrengthRangeBackground(range, strengthValue, options);
  range.oninput = () => {
    const next = Number(range.value);
    setWidgetValue(slot.strengthWidget, next);
    markDirty(targetNode);
    updateStrengthRangeBackground(range, next, options);
  };
  const handleRelease = (nextEvent) => {
    if (!shouldCloseStrengthPopupOnRelease(nextEvent)) {
      return;
    }
    closeStrengthPopup();
  };
  range.addEventListener("mouseup", handleRelease);
  range.addEventListener("pointerup", handleRelease);
  range.addEventListener("touchend", handleRelease);
  popup.append(controlRow);
  document.body.append(popup);
  const popupRect = popup.getBoundingClientRect();
  const anchor = resolveStrengthPopupAnchor(slot, targetNode, event);
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const position = resolveBelowCenteredPopupPosition(
    anchor,
    { width: popupRect.width, height: popupRect.height },
    viewport,
  );
  popup.style.left = `${position.left}px`;
  popup.style.top = `${position.top}px`;
  const handleOutside = (nextEvent) => {
    if (!shouldCloseStrengthPopupOnPress(nextEvent)) {
      return;
    }
    if (
      !shouldCloseStrengthPopupOnInnerClick(
        nextEvent.target,
        range,
        resetButton,
      )
    ) {
      return;
    }
    closeStrengthPopup();
  };
  const handleKeydown = (nextEvent) => {
    if (nextEvent.key === "Escape") {
      closeStrengthPopup();
    }
  };
  document.addEventListener("mousedown", handleOutside, true);
  document.addEventListener("pointerdown", handleOutside, true);
  document.addEventListener("touchstart", handleOutside, true);
  document.addEventListener("keydown", handleKeydown, true);
  strengthPopupState = {
    slot,
    range,
    targetNode,
    cleanup: () => {
      range.removeEventListener("mouseup", handleRelease);
      range.removeEventListener("pointerup", handleRelease);
      range.removeEventListener("touchend", handleRelease);
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("pointerdown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
      document.removeEventListener("keydown", handleKeydown, true);
    },
  };
  targetNode.__loadLorasStrengthPopupSlot = slot;
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
  overlay.addEventListener("mousedown", (event) => {
    if (!shouldCloseDialogOnOverlayClick(overlay, event.target)) {
      return;
    }
    closeDialog();
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

  let activeIndex = -1;

  const items = triggers.map((trigger, index) => {
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
        background: tagDialogItemBackground,
        borderRadius: "4px",
      },
    });
    label.append(checkbox, countLabel, triggerLabel);
    list.append(label);
    const entry = { trigger, checkbox, row: label, label: triggerLabel };
    label.addEventListener("mouseenter", () => {
      entry.__tagDialogHovered = true;
      activeIndex = index;
      updateRowStates();
    });
    label.addEventListener("mouseleave", () => {
      entry.__tagDialogHovered = false;
      updateRowStates();
    });
    return entry;
  });

  const updateRowStates = () => {
    items.forEach((item, index) => {
      const isActive = index === activeIndex;
      const isHovered = !!item.__tagDialogHovered;
      item.row.style.background = resolveTagDialogItemBackground(
        isActive,
        isHovered,
      );
    });
  };

  const getVisibleIndices = () =>
    items.reduce((acc, item, index) => {
      if (item.row.style.display !== "none") {
        acc.push(index);
      }
      return acc;
    }, []);

  const ensureActiveIndex = () => {
    const visibleIndices = getVisibleIndices();
    activeIndex = resolveActiveIndex(visibleIndices, activeIndex);
  };

  const scrollActiveIntoView = () => {
    if (activeIndex < 0) {
      return;
    }
    items[activeIndex]?.row?.scrollIntoView?.({ block: "nearest" });
  };

  const moveActive = (direction) => {
    const visibleIndices = getVisibleIndices();
    if (visibleIndices.length === 0) {
      return;
    }
    activeIndex = resolveActiveIndex(visibleIndices, activeIndex);
    const currentVisibleIndex = Math.max(
      0,
      visibleIndices.indexOf(activeIndex),
    );
    const nextVisibleIndex = moveIndex(
      currentVisibleIndex,
      direction,
      visibleIndices.length,
    );
    activeIndex = visibleIndices[nextVisibleIndex];
    updateRowStates();
    scrollActiveIntoView();
  };

  const toggleActiveSelection = () => {
    const visibleIndices = getVisibleIndices();
    if (visibleIndices.length === 0) {
      return;
    }
    activeIndex = resolveActiveIndex(visibleIndices, activeIndex);
    if (activeIndex < 0) {
      return;
    }
    const item = items[activeIndex];
    if (!item || item.row.style.display === "none") {
      return;
    }
    item.checkbox.checked = !item.checkbox.checked;
    updateRowStates();
    scrollActiveIntoView();
  };

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
      if (!isVisible) {
        item.__tagDialogHovered = false;
      }
    });
    ensureActiveIndex();
    updateRowStates();
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
    if (event?.target?.type === "range") {
      return;
    }
    const isTextInput =
      event?.target?.tagName === "INPUT" && event?.target?.type === "text";
    if (shouldBlurTagFilterOnKey(event, isTextInput)) {
      event.preventDefault();
      filterInput?.blur?.();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (shouldToggleTagSelectionOnKey(event, isTextInput)) {
      event.preventDefault();
      toggleActiveSelection();
      return;
    }
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

const drawStrengthSummary = (ctx, rect, widget, isEnabled) => {
  const options = normalizeStrengthOptions(widget?.options);
  const strengthDefault = resolveStrengthDefault(options, 1.0);
  const strengthValue = Number(widget?.value ?? strengthDefault);
  const valueText = formatStrengthValue(strengthValue, options);
  const valuePadding = 4;
  const valueAreaWidth = resolveFixedLabelWidth(
    ctx.measureText("0").width,
    4,
    valuePadding,
  );
  const valueRectWidth = Math.max(0, Math.min(valueAreaWidth, rect.width));
  const valueRectX = rect.x + (rect.width - valueRectWidth) / 2;
  const valueRect = {
    x: valueRectX,
    y: rect.y,
    width: valueRectWidth,
    height: rect.height,
  };
  const valueTextX = valueRect.x + valueRect.width - valuePadding;
  const maxTextWidth = Math.max(0, valueRect.width - valuePadding * 2);
  const valueLabel = fitText(ctx, valueText, maxTextWidth);

  ctx.save();
  ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(valueLabel, valueTextX, rect.y + rect.height / 2);
  ctx.restore();

  return { valueRect };
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
  const label = resolveComboDisplayLabel(raw, options);
  const isMissing = shouldPreserveUnknownOption(raw, options);
  return { index, label, options, raw, isMissing };
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

const setupLoadLorasUi = (node) => {
  if (node.__loadLorasUiReady) {
    return;
  }
  node.__loadLorasUiReady = true;

  const slots = [];
  let headerWidget = null;

  const createHeaderWidget = (getAllToggleState) => {
    const widget = {
      type: "load-loras-with-tags-header",
      name: "load_loras_with_tags_header",
      value: "",
      serialize: false,
      computeSize: (width) => [width ?? 0, HEADER_HEIGHT],
      draw(ctx, _node, width, y, height) {
        const rowHeight = height ?? HEADER_HEIGHT;
        const headerMargin = MARGIN + CONTENT_SIDE_INSET;
        const headerToggleSize = resolveToggleSize(rowHeight);
        const headerAvailableHeight = Math.max(
          0,
          rowHeight - HEADER_TOP_PADDING,
        );
        const toggleRect = {
          x: headerMargin,
          y:
            y +
            HEADER_TOP_PADDING +
            (headerAvailableHeight - headerToggleSize.height) / 2,
          width: headerToggleSize.width,
          height: headerToggleSize.height,
        };
        widget.__toggleRect = toggleRect;
        const state = getAllToggleState?.() ?? null;
        drawToggle(ctx, toggleRect, state === true, state === null);
        const midY = toggleRect.y + toggleRect.height / 2;
        const labelWidth = ctx.measureText(TOGGLE_LABEL_TEXT).width;
        widget.__toggleLabelRect = resolveToggleLabelRect(
          toggleRect,
          labelWidth,
          INNER_MARGIN,
        );
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
      type: "load-loras-with-tags-row",
      name: `load_loras_with_tags_row_${slot.index}`,
      value: "",
      serialize: false,
      __loadLorasCustomSize: true,
      draw(ctx, _node, width, y, _height) {
        const rowHeight = ROW_HEIGHT;
        const rowMargin = MARGIN;
        const contentMargin = rowMargin + CONTENT_SIDE_INSET;
        let posX = contentMargin;
        const contentWidth = width - rowMargin * 2;
        const contentTop = y + ROW_PADDING_Y;
        const availableHeight = rowHeight - ROW_PADDING_Y * 2;
        const lineHeight = resolveRowLineHeight(rowHeight, ROW_PADDING_Y, 16, -6);

        ctx.save();
        ctx.fillStyle = "#2a2a2a";
        drawRoundedRect(ctx, rowMargin, y, width - rowMargin * 2, rowHeight, 6);
        ctx.fill();

        const rowToggleSize = resolveToggleSize(rowHeight);
        const toggleRect = {
          x: posX,
          y: contentTop + (availableHeight - rowToggleSize.height) / 2,
          width: rowToggleSize.width,
          height: rowToggleSize.height,
        };
        slot.__hitToggle = toggleRect;
        drawToggle(ctx, toggleRect, !!slot.toggleWidget?.value);
        posX += toggleRect.width + INNER_MARGIN;

        const labelAreaWidth = Math.max(10, rowMargin + contentWidth - posX);
        const { label, isMissing } = getLoraState(slot.loraWidget);
        const isOn = !!slot.toggleWidget?.value;
        if (!isOn) {
          ctx.globalAlpha *= 0.4;
        }
        ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const strengthOptions = normalizeStrengthOptions(
          slot.strengthWidget?.options,
        );
        const strengthDefault = resolveStrengthDefault(strengthOptions, 1.0);
        const strengthValue = Number(
          slot.strengthWidget?.value ?? strengthDefault,
        );
        const strengthText = formatStrengthValue(
          strengthValue,
          strengthOptions,
        );
        const strengthValueWidth = resolveFixedLabelWidth(
          ctx.measureText("0").width,
          4,
          4,
        );
        const triggerTextWidth = ctx.measureText(SELECT_TRIGGER_LABEL).width;
        const triggerButtonWidth = Math.max(
          80,
          triggerTextWidth + SELECT_BUTTON_PADDING * 2 + 16,
        );
        const inlineLayout = resolveInlineControlLayout(
          labelAreaWidth,
          strengthValueWidth,
          triggerButtonWidth,
          INNER_MARGIN,
        );
        const labelButtonBaseRect = computeButtonRect(
          posX,
          contentTop,
          inlineLayout.labelWidth,
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
          y: resolveCenteredY(contentTop, availableHeight, labelButtonHeight),
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
        ctx.fillStyle = isMissing
          ? missingLoraLabelColor
          : LiteGraph?.WIDGET_TEXT_COLOR ?? "#d0d0d0";
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
          labelButtonRect.y + labelButtonRect.height / 2,
        );

        const strengthHeight = Math.max(12, lineHeight - CONTENT_PADDING_Y * 2);
        const strengthLeft =
          labelButtonRect.x + labelButtonRect.width + INNER_MARGIN;
        const strengthRect = {
          x: strengthLeft,
          y: resolveCenteredY(contentTop, availableHeight, strengthHeight),
          width: Math.max(0, inlineLayout.valueWidth),
          height: strengthHeight,
        };
        const strengthRects = drawStrengthSummary(
          ctx,
          strengthRect,
          slot.strengthWidget,
          isOn,
        );
        slot.__hitStrengthValue = strengthRects.valueRect;

        const buttonHeight = selectTriggerButtonHeight;
        const buttonRect = computeButtonRect(
          strengthRect.x + strengthRect.width + INNER_MARGIN,
          resolveCenteredY(contentTop, availableHeight, buttonHeight),
          Math.max(0, inlineLayout.buttonWidth),
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
      if (widget.__loadLorasHidden) {
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
    const options = getComboOptions(widget);
    if (shouldPreserveUnknownOption(value, options)) {
      setWidgetValue(widget, value);
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
      const strengthDefault = resolveStrengthDefault(
        slot.strengthWidget?.options,
        1.0,
      );
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
      const rawValue = slot.loraWidget?.value;
      if (shouldPreserveUnknownOption(rawValue, options)) {
        return;
      }
      const resolved = resolveComboLabel(rawValue, options);
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
    let suppressHoverSelection = false;

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
    overlay.addEventListener("mousedown", (event) => {
      if (!shouldCloseDialogOnOverlayClick(overlay, event.target)) {
        return;
      }
      closeDialog();
    });
    const panel = $el("div", {
      style: {
        background: "#1e1e1e",
        color: "#e0e0e0",
        padding: "16px",
        borderRadius: "8px",
        width: loraDialogWidth,
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
        slot.selectionWidget.__loadLorasResetTopN = true;
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

    const applyHoverSelection = (nextVisibleIndex) => {
      hoveredVisibleIndex = nextVisibleIndex;
      const resolved = resolveHoverSelection(
        visibleOptions,
        nextVisibleIndex,
        selectedOptionIndex,
        suppressHoverSelection,
      );
      if (resolved.shouldUpdateSelection) {
        selectedVisibleIndex = resolved.selectedVisibleIndex;
        selectedOptionIndex = resolved.selectedOptionIndex;
      }
    };

    const resumeHoverSelection = () => {
      if (!suppressHoverSelection) {
        return;
      }
      suppressHoverSelection = false;
      if (hoveredVisibleIndex < 0) {
        return;
      }
      const resolved = resolveHoverSelection(
        visibleOptions,
        hoveredVisibleIndex,
        selectedOptionIndex,
        false,
      );
      if (resolved.shouldUpdateSelection) {
        selectedVisibleIndex = resolved.selectedVisibleIndex;
        selectedOptionIndex = resolved.selectedOptionIndex;
      }
      refreshButtonStates();
    };

    const renderList = (forceTopSelection = false) => {
      suppressHoverSelection = forceTopSelection;
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
          applyHoverSelection(index);
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
    list.addEventListener("mousemove", resumeHoverSelection);
    const scrollSelectedIntoView = () => {
      const entry = renderedButtons[selectedVisibleIndex];
      if (!entry) {
        return;
      }
      entry.button?.scrollIntoView?.({ block: "nearest" });
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
      refreshButtonStates();
      scrollSelectedIntoView();
    };

    const handleDialogKeyDown = (event) => {
      if (event?.__loadLorasDialogHandled) {
        return;
      }
      event.__loadLorasDialogHandled = true;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        moveSelection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        moveSelection(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        applySelectedLabel();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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
    if (event?.__loadLorasHandled) {
      return true;
    }
    if (!Array.isArray(pos)) {
      return false;
    }
    if (
      headerWidget?.__toggleRect &&
      (isPointInRect(pos, headerWidget.__toggleRect) ||
        isPointInRect(pos, headerWidget.__toggleLabelRect))
    ) {
      const state = getAllToggleState();
      setAllToggleState(state === true ? false : true);
      if (event) {
        event.__loadLorasHandled = true;
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
          event.__loadLorasHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitSelectTrigger)) {
        if (!isEnabled) {
          if (event) {
            event.__loadLorasHandled = true;
          }
          return true;
        }
        const { label } = getLoraState(slot.loraWidget);
        const shouldResetTopN = !!slot.selectionWidget?.__loadLorasResetTopN;
        slot.selectionWidget.__loadLorasResetTopN = false;
        openTriggerDialog(
          label,
          slot.selectionWidget,
          targetNode,
          shouldResetTopN,
        );
        if (event) {
          event.__loadLorasHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitLabel)) {
        if (!isEnabled) {
          if (event) {
            event.__loadLorasHandled = true;
          }
          return true;
        }
        const isRightClick = event?.button === 2 || event?.which === 3;
        if (isRightClick) {
          if (event) {
            event.__loadLorasHandled = true;
          }
          return true;
        }
        openLoraDialog(slot, targetNode);
        if (event) {
          event.__loadLorasHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
      if (isPointInRect(pos, slot.__hitStrengthValue)) {
        if (!isEnabled) {
          if (event) {
            event.__loadLorasHandled = true;
          }
          return true;
        }
        openStrengthPopup(slot, event, targetNode);
        if (event) {
          event.__loadLorasHandled = true;
        }
        markDirty(targetNode);
        return true;
      }
    }
    return false;
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
    slot.loraWidget.__loadLorasKeepSerialization = true;
    slot.strengthWidget.__loadLorasKeepSerialization = true;
    slot.toggleWidget.__loadLorasKeepSerialization = true;
    slot.selectionWidget.__loadLorasKeepSerialization = true;
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

  if (!node.__loadLorasMouseHandlers || !node.onMouseDown?.__loadLorasHandler) {
    node.__loadLorasMouseHandlers = true;
    const originalMouseDown = node.onMouseDown;
    const wrappedMouseDown = function (event, pos) {
      if (event?.__loadLorasHandled) {
        return true;
      }
      if (handleMouseDown(event, pos, this)) {
        return true;
      }
      return originalMouseDown?.apply(this, arguments);
    };
    wrappedMouseDown.__loadLorasHandler = true;
    node.onMouseDown = wrappedMouseDown;
  }

  if (!node.__loadLorasSerializeWrapped) {
    node.__loadLorasSerializeWrapped = true;
    const originalSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      originalSerialize?.apply(this, arguments);
      const values = [];
      slots.forEach((slot) => {
        const strengthDefault = resolveStrengthDefault(
          slot.strengthWidget?.options,
          1.0,
        );
        const rawValue = slot.loraWidget?.value;
        const options = getComboOptions(slot.loraWidget);
        const loraValue = resolveComboDisplayLabel(rawValue, options);
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

  if (!node.__loadLorasConfigureHooked) {
    node.__loadLorasConfigureHooked = true;
    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      node.__loadLorasConfigured = true;
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
    setupLoadLorasUi(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupLoadLorasUi(node);
  },
});
