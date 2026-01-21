import { app } from "../../../../scripts/app.js";
import { api } from "../../../../scripts/api.js";
import { $el } from "../../../../scripts/ui.js";
import {
  getMinFrequencyVisibility,
  getTagVisibility,
  getTopNVisibility,
} from "./tagFilterUtils.js";
import {
  normalizeSelectionValue,
  resolveTagSelection,
  shouldAutoSelectInfinityTagsOnly,
} from './selectionValueUtils.js';
import {
  AUTO_SELECT_MISSING_LORA_SETTING_ID,
  AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID,
  LORA_PREVIEW_ZOOM_SCALE_SETTING_ID,
  MIN_FREQUENCY_SETTING_ID,
  normalizeAutoSelectMissingLora,
  normalizeAutoSelectInfinityWordsOnly,
  normalizeLoraPreviewZoomScale,
  normalizeMinFrequency,
} from './loadLorasWithTagsSettings.js';
import { getSavedSlotValues } from "./loadLorasWithTagsSavedValuesUtils.js";
import {
  computeButtonRect,
  computeSliderRatio,
  createDebouncedRunner,
  moveIndex,
  normalizeStrengthOptions,
  normalizeOptions,
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
  getLoraDialogListStyle,
  getLoraPreviewPanelStyle,
  loraDialogWidth,
  loraDialogHeaderOrder,
  loraDialogSelectedIconPath,
  loraDialogSelectedIconSize,
  loraDialogOpenFolderIconPath,
  loraDialogOpenFolderIconSize,
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
  resolvePreviewVisibleIndex,
  resolveZoomBackgroundPosition,
  resolveActiveIndex,
  resolveComboLabel,
  resolveComboDisplayLabel,
  resolveComboOptionIndex,
  resolveMissingLoraFilterValue,
  resolveLoraSlotFilterValue,
  shouldSelectLoraDialogFilterOnOpen,
  normalizeDialogFilterValue,
  isRectFullyVisible,
  shouldIgnoreLoraDialogKeydownForIme,
  reorderListByMove,
  resolveDragSlotOffset,
  compactListByPredicate,
  shouldPreserveUnknownOption,
  resolveOption,
  resolveNoneOptionIndex,
  resolveSameNameLoraIndex,
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
  trashIconPath,
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
const DRAG_HANDLE_SIZE = 12;
const DRAG_HANDLE_GAP = 6;
const DRAG_ACTIVE_BACKGROUND = "#353535";
const DRAG_START_THRESHOLD = 4;
const SELECT_BUTTON_PADDING = 2;
const SELECT_TRIGGER_LABEL = "tags";
const TOGGLE_LABEL_TEXT = "Toggle All";
const DIALOG_ID = "craftgear-load-loras-with-tags-trigger-dialog";
const STRENGTH_POPUP_ID = "craftgear-load-loras-with-tags-strength-popup";
const STRENGTH_POPUP_STYLE_ID = "craftgear-load-loras-with-tags-strength-popup-style";
const TOP_N_STORAGE_KEY = "craftgear-load-loras-with-tags-trigger-dialog-top-n";
const LORA_DIALOG_FILTER_DEBOUNCE_MS = 120;
const LORA_PREVIEW_PANEL_WIDTH = 240;
const LORA_PREVIEW_PANEL_PADDING = 0;
let dialogKeydownHandler = null;
let strengthPopupState = null;

const getNodeClass = (node) => node?.comfyClass || node?.type || "";
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) =>
  node.widgets?.find((widget) => widget.name === name);

const getMinFrequencyThreshold = () => {
  const value = app?.extensionManager?.setting?.get?.(MIN_FREQUENCY_SETTING_ID);
  return normalizeMinFrequency(value);
};

const getAutoSelectMissingLoraEnabled = () => {
  const value = app?.extensionManager?.setting?.get?.(
    AUTO_SELECT_MISSING_LORA_SETTING_ID,
  );
  return normalizeAutoSelectMissingLora(value);
};

const getAutoSelectInfinityWordsOnlyEnabled = () => {
  const value = app?.extensionManager?.setting?.get?.(
    AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID,
  );
  return normalizeAutoSelectInfinityWordsOnly(value);
};

const getLoraPreviewZoomScale = () => {
  const value = app?.extensionManager?.setting?.get?.(
    LORA_PREVIEW_ZOOM_SCALE_SETTING_ID,
  );
  return normalizeLoraPreviewZoomScale(value);
};

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

const fetchLoraPreviewUrl = async (loraName) => {
  if (!loraName || loraName === 'None') {
    return null;
  }
  const response = await api.fetchApi('/my_custom_node/lora_preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lora_name: loraName }),
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

const openLoraFolder = async (loraName) => {
  const response = await api.fetchApi('/my_custom_node/open_lora_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lora_name: loraName }),
  });
  return response.ok;
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
    const cleanup = existing.__loadLorasCleanup;
    if (typeof cleanup === "function") {
      cleanup();
    }
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
  const autoSelectInfinityTagsOnlyEnabled =
    getAutoSelectInfinityWordsOnlyEnabled();
  const shouldAutoSelectInfinityWordsOnly = shouldAutoSelectInfinityTagsOnly(
    autoSelectInfinityTagsOnlyEnabled,
    resetTopN,
  );
  const selected = resolveTagSelection({
    selectionText: selectionValue,
    triggers,
    frequencies,
    autoSelectInfinityWordsOnly: shouldAutoSelectInfinityWordsOnly,
    emptySelectionAsNone: autoSelectInfinityTagsOnlyEnabled,
  });
  if (
    shouldAutoSelectInfinityWordsOnly ||
    (autoSelectInfinityTagsOnlyEnabled && !selectionValue)
  ) {
    const nextSelectionValue = JSON.stringify([...selected]);
    if (selectionWidget?.value !== nextSelectionValue) {
      setWidgetValue(selectionWidget, nextSelectionValue);
    }
  }

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
    const minFrequency = getMinFrequencyThreshold();
    const minFrequencyVisibility = getMinFrequencyVisibility(
      tagList,
      frequencies,
      minFrequency,
    );
    items.forEach((item, index) => {
      renderTriggerLabel(item.label, item.trigger, query);
      const isVisible =
        (textVisibility[index] ?? true) &&
        (topNVisibility[index] ?? true) &&
        (minFrequencyVisibility[index] ?? true);
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

  const drawRowContent = (slot, ctx, width, y, isOverlay = false) => {
    const rowHeight = ROW_HEIGHT;
    const rowMargin = MARGIN;
    const contentMargin = rowMargin + CONTENT_SIDE_INSET;
    let posX = contentMargin;
    const contentWidth = width - rowMargin * 2;
    const contentTop = y + ROW_PADDING_Y;
    const availableHeight = rowHeight - ROW_PADDING_Y * 2;
    const lineHeight = resolveRowLineHeight(rowHeight, ROW_PADDING_Y, 16, -6);
    const rowRect = {
      x: rowMargin,
      y,
      width: width - rowMargin * 2,
      height: rowHeight,
    };
    if (!isOverlay) {
      slot.__rowRect = rowRect;
    }

    ctx.save();
    const isDraggingRow =
      dragState.active && dragState.sourceIndex === slot.index - 1;
    ctx.fillStyle = isDraggingRow ? DRAG_ACTIVE_BACKGROUND : "#2a2a2a";
    drawRoundedRect(ctx, rowMargin, y, width - rowMargin * 2, rowHeight, 6);
    ctx.fill();

    const rowToggleSize = resolveToggleSize(rowHeight);
    const handleY = contentTop + (availableHeight - DRAG_HANDLE_SIZE) / 2;
    const handleRect = {
      x: posX,
      y: handleY,
      width: DRAG_HANDLE_SIZE,
      height: DRAG_HANDLE_SIZE,
    };
    if (!isOverlay) {
      slot.__hitDragHandle = handleRect;
    }
    ctx.save();
    ctx.fillStyle = "#5a5a5a";
    ctx.strokeStyle = "#5a5a5a";
    const dotRadius = 1.2;
    const dotGap = 3.5;
    for (let col = 0; col < 2; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const dotX = handleRect.x + 3 + col * dotGap;
        const dotY = handleRect.y + 2 + row * dotGap;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    posX += DRAG_HANDLE_SIZE + DRAG_HANDLE_GAP;
    const toggleRect = {
      x: posX,
      y: contentTop + (availableHeight - rowToggleSize.height) / 2,
      width: rowToggleSize.width,
      height: rowToggleSize.height,
    };
    if (!isOverlay) {
      slot.__hitToggle = toggleRect;
    }
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
    const strengthText = formatStrengthValue(strengthValue, strengthOptions);
    const strengthValueWidth = resolveFixedLabelWidth(
      ctx.measureText("0").width,
      4,
      4,
    );
    const triggerTextWidth = ctx.measureText(SELECT_TRIGGER_LABEL).width;
    const triggerButtonWidth = Math.max(
      40,
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
    const labelButtonHeightPadding = Math.max(0, loraLabelButtonHeightPadding);
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
    if (!isOverlay) {
      slot.__hitLabel = labelButtonRect;
    }
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
    if (!isOverlay) {
      slot.__hitStrengthValue = strengthRects.valueRect;
    }

    const buttonHeight = selectTriggerButtonHeight;
    const buttonRect = computeButtonRect(
      strengthRect.x + strengthRect.width + INNER_MARGIN,
      resolveCenteredY(contentTop, availableHeight, buttonHeight),
      Math.max(0, inlineLayout.buttonWidth),
      selectTriggerButtonHeight,
      SELECT_BUTTON_PADDING,
    );
    if (!isOverlay) {
      slot.__hitSelectTrigger = buttonRect;
    }
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
  };

  const createRowWidget = (slot) => {
    const widget = {
      type: "load-loras-with-tags-row",
      name: `load_loras_with_tags_row_${slot.index}`,
      value: "",
      serialize: false,
      __loadLorasCustomSize: true,
      draw(ctx, _node, width, y, _height) {
        const slotIndex = slot.index - 1;
        const isDraggingRow =
          dragState.active && dragState.sourceIndex === slotIndex;
        if (isDraggingRow) {
          return;
        }
        const offset = dragState.active
          ? resolveDragSlotOffset(
              dragState.sourceIndex,
              dragState.targetIndex,
              slotIndex,
              ROW_HEIGHT,
            )
          : 0;
        drawRowContent(slot, ctx, width, y + offset, false);
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
    let stride = getSavedSlotValues(savedValues, 0)?.stride ?? 0;
    if (stride === 5) {
      const hasInvalidLoraValue = slots.some((_, index) => {
        const entry = getSavedSlotValues(savedValues, index, 5);
        if (!entry) {
          return false;
        }
        return typeof entry.loraValue !== "string";
      });
      const hasInvalidFilterValue = slots.some((_, index) => {
        const entry = getSavedSlotValues(savedValues, index, 5);
        if (!entry) {
          return false;
        }
        if (entry.filterValue === null || entry.filterValue === undefined) {
          return false;
        }
        return typeof entry.filterValue !== "string";
      });
      if (hasInvalidLoraValue || hasInvalidFilterValue) {
        stride = 4;
      }
    }
    slots.forEach((slot, index) => {
      const entry = getSavedSlotValues(savedValues, index, stride);
      if (!entry) {
        return;
      }
      applyLoraValue(slot.loraWidget, entry.loraValue);
      const strengthDefault = resolveStrengthDefault(
        slot.strengthWidget?.options,
        1.0,
      );
      const strengthValue =
        entry.strengthValue !== undefined ? entry.strengthValue : strengthDefault;
      setWidgetValue(
        slot.strengthWidget,
        Number.isFinite(strengthValue) ? strengthValue : strengthDefault,
      );
      const toggleValue = entry.toggleValue ?? true;
      setWidgetValue(slot.toggleWidget, !!toggleValue);
      const selectionValue = entry.stride >= 4 ? entry.selectionValue : "";
      slot.selectionWidget.value = normalizeSelectionValue(
        selectionValue,
      );
      if (
        entry.stride >= 5 &&
        entry.filterValue !== null &&
        entry.filterValue !== undefined
      ) {
        slot.__loadLorasLoraFilter = normalizeDialogFilterValue(
          entry.filterValue,
        );
      }
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
    compactSlots();
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
    const autoSelectMissing = getAutoSelectMissingLoraEnabled();
    slots.forEach((slot) => {
      const options = getComboOptions(slot.loraWidget);
      if (options.length === 0) {
        return;
      }
      const rawValue = slot.loraWidget?.value;
      if (shouldPreserveUnknownOption(rawValue, options)) {
        if (!autoSelectMissing) {
          return;
        }
        const matchedIndex = resolveSameNameLoraIndex(rawValue, options);
        if (matchedIndex < 0) {
          return;
        }
        const matchedLabel = options[matchedIndex];
        if (!matchedLabel) {
          return;
        }
        setComboWidgetValue(slot.loraWidget, matchedLabel);
        return;
      }
      const resolved = resolveComboLabel(rawValue, options);
      if (slot.loraWidget?.value !== resolved) {
        setWidgetValue(slot.loraWidget, resolved);
      }
    });
  };

  const dragState = {
    active: false,
    pending: false,
    sourceIndex: -1,
    targetIndex: -1,
    pointerY: null,
    startPointerY: null,
    pointerOffsetY: 0,
    pointerDown: false,
  };

  const buildSlotEntry = (slot) => {
    const options = getComboOptions(slot.loraWidget);
    const rawValue = slot.loraWidget?.value;
    const loraValue = resolveComboDisplayLabel(rawValue, options);
    const strengthDefault = resolveStrengthDefault(
      slot.strengthWidget?.options,
      1.0,
    );
    const strengthValue = slot.strengthWidget?.value ?? strengthDefault;
    const toggleValue = slot.toggleWidget?.value ?? true;
    const selectionValue = normalizeSelectionValue(slot.selectionWidget?.value);
    const filterValue = normalizeDialogFilterValue(slot.__loadLorasLoraFilter);
    const resetTopN = !!slot.selectionWidget?.__loadLorasResetTopN;
    return {
      loraValue,
      strengthValue,
      toggleValue,
      selectionValue,
      filterValue,
      resetTopN,
    };
  };

  const applySlotEntry = (slot, entry) => {
    applyLoraValue(slot.loraWidget, entry?.loraValue);
    const strengthDefault = resolveStrengthDefault(
      slot.strengthWidget?.options,
      1.0,
    );
    const strengthValue = Number.isFinite(entry?.strengthValue)
      ? entry.strengthValue
      : strengthDefault;
    setWidgetValue(slot.strengthWidget, strengthValue);
    setWidgetValue(slot.toggleWidget, !!entry?.toggleValue);
    slot.selectionWidget.value = normalizeSelectionValue(entry?.selectionValue);
    slot.selectionWidget.__loadLorasResetTopN = !!entry?.resetTopN;
    slot.__loadLorasLoraFilter = normalizeDialogFilterValue(
      entry?.filterValue,
    );
  };

  const compactSlots = () => {
    const entries = slots.map((slot) => buildSlotEntry(slot));
    const compacted = compactListByPredicate(entries, (entry) =>
      isFilledName(entry?.loraValue),
    );
    const hasChange = entries.some(
      (entry, index) => entry !== compacted[index],
    );
    if (!hasChange) {
      return false;
    }
    compacted.forEach((entry, index) => {
      applySlotEntry(slots[index], entry);
    });
    return true;
  };

  const reorderSlots = (sourceIndex, targetIndex) => {
    if (!Number.isFinite(sourceIndex) || !Number.isFinite(targetIndex)) {
      return;
    }
    if (sourceIndex === targetIndex) {
      return;
    }
    const entries = slots.map((slot) => buildSlotEntry(slot));
    const reordered = reorderListByMove(entries, sourceIndex, targetIndex);
    reordered.forEach((entry, index) => {
      applySlotEntry(slots[index], entry);
    });
    applyRowVisibility();
    markDirty(node);
  };

  const findSlotByPos = (pos) =>
    slots.find(
      (slot) =>
        !slot.rowWidget?.hidden && isPointInRect(pos, slot.__rowRect),
    );

  const isSlotDraggable = (slot) => {
    if (!slot) {
      return false;
    }
    return true;
  };

  const startSlotDrag = (slot, pos) => {
    if (!isSlotDraggable(slot)) {
      return false;
    }
    if (!Array.isArray(pos)) {
      return false;
    }
    const sourceIndex = slots.indexOf(slot);
    if (sourceIndex < 0) {
      return false;
    }
    const rowY = slot.__rowRect?.y ?? pos[1];
    dragState.active = false;
    dragState.pending = true;
    dragState.pointerDown = true;
    dragState.sourceIndex = sourceIndex;
    dragState.targetIndex = sourceIndex;
    dragState.pointerY = pos[1];
    dragState.startPointerY = pos[1];
    dragState.pointerOffsetY = pos[1] - rowY;
    markDirty(node);
    return true;
  };

  const updateSlotDrag = (event, pos) => {
    if (!dragState.pointerDown) {
      return false;
    }
    if (!Array.isArray(pos)) {
      return false;
    }
    if (typeof event?.buttons === 'number' && (event.buttons & 1) === 0) {
      cancelSlotDrag();
      return false;
    }
    dragState.pointerY = pos[1];
    if (dragState.pending && !dragState.active) {
      const startY =
        dragState.startPointerY ?? dragState.pointerY ?? 0;
      const distance = Math.abs(dragState.pointerY - startY);
      if (distance < DRAG_START_THRESHOLD) {
        return true;
      }
      dragState.active = true;
      dragState.pending = false;
      markDirty(node);
    }
    if (!dragState.active) {
      return true;
    }
    const targetSlot = findSlotByPos(pos);
    if (!targetSlot || !isSlotDraggable(targetSlot)) {
      markDirty(node);
      return true;
    }
    const targetIndex = slots.indexOf(targetSlot);
    if (targetIndex < 0) {
      markDirty(node);
      return true;
    }
    dragState.targetIndex = targetIndex;
    markDirty(node);
    return true;
  };

  const cancelSlotDrag = () => {
    if (!dragState.active && !dragState.pending) {
      return false;
    }
    dragState.active = false;
    dragState.pending = false;
    dragState.pointerDown = false;
    dragState.sourceIndex = -1;
    dragState.targetIndex = -1;
    dragState.pointerY = null;
    dragState.startPointerY = null;
    dragState.pointerOffsetY = 0;
    markDirty(node);
    return true;
  };

  const endSlotDrag = () => {
    if (!dragState.active && !dragState.pending) {
      return false;
    }
    const sourceIndex = dragState.sourceIndex;
    const targetIndex = dragState.targetIndex;
    const shouldReorder = dragState.active;
    dragState.active = false;
    dragState.pending = false;
    dragState.pointerDown = false;
    dragState.sourceIndex = -1;
    dragState.targetIndex = -1;
    dragState.pointerY = null;
    dragState.startPointerY = null;
    dragState.pointerOffsetY = 0;
    if (!shouldReorder) {
      return false;
    }
    if (sourceIndex < 0 || targetIndex < 0) {
      return false;
    }
    reorderSlots(sourceIndex, targetIndex);
    return true;
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
    let didAutoScrollToChecked = false;
    let suppressHoverSelection = false;
    let isFilterComposing = false;
    let suppressEnterOnce = false;
    let hadComposingEnter = false;
    let lastFilterQuery = "";
    let lastFilteredIndices = null;
    let activeFilterQuery = "";
    let previewRequestToken = 0;
    let previewObjectUrl = null;
    let lastPreviewLabel = '';
    let previewImageNaturalSize = { width: 0, height: 0 };
    let previewZoomActive = false;
    let previewZoomRaf = null;
    let previewZoomPoint = null;
    const currentOptionIndex = resolveComboOptionIndex(
      slot.loraWidget?.value,
      options,
    );
    const previewZoomScale = getLoraPreviewZoomScale();
    const isPreviewZoomEnabled = previewZoomScale > 1;

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
      style: getLoraPreviewPanelStyle(
        LORA_PREVIEW_PANEL_WIDTH,
        LORA_PREVIEW_PANEL_PADDING,
      ),
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
    previewPanel.append(previewImage, previewZoomLayer);
    const panel = $el("div", {
      style: {
        background: "#1e1e1e",
        color: "#e0e0e0",
        padding: "16px",
        borderRadius: "8px",
        width: loraDialogWidth,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
      },
    });
    const title = null;
    const filterInput = $el('input', {
      type: 'text',
      placeholder: 'Filter LoRAs',
      style: { flex: '1 1 auto', paddingRight: '28px' },
    });
    // IME確定のEnterで選択が走らないように抑制するため
    filterInput.addEventListener('compositionstart', () => {
      isFilterComposing = true;
      hadComposingEnter = false;
    });
    filterInput.addEventListener('compositionend', () => {
      isFilterComposing = false;
      if (hadComposingEnter) {
        hadComposingEnter = false;
        suppressEnterOnce = false;
        return;
      }
      suppressEnterOnce = true;
    });
    const missingFilterValue = resolveMissingLoraFilterValue(
      slot.loraWidget?.value,
      options,
    );
    const initialFilterValue = resolveLoraSlotFilterValue(
      slot,
      missingFilterValue,
    );
    const shouldSelectFilterOnOpen = shouldSelectLoraDialogFilterOnOpen(
      slot?.__loadLorasLoraFilter,
    );
    filterInput.value = initialFilterValue;
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
    const filterContainer = $el('div', {
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 auto',
      },
    });
    filterContainer.append(filterInput, clearFilterButton);
    const trashButton = $el('button', {
      'aria-label': 'Clear filter',
      title: 'Clear filter',
      style: {
        width: '28px',
        height: '28px',
        padding: '0',
        borderRadius: '4px',
        border: '1px solid #3a3a3a',
        background: '#2a2a2a',
        color: '#e0e0e0',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    const trashIcon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    trashIcon.setAttribute('viewBox', '0 0 24 24');
    trashIcon.setAttribute('width', '14');
    trashIcon.setAttribute('height', '14');
    trashIcon.setAttribute('aria-hidden', 'true');
    trashIcon.style.display = 'block';
    const trashPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    trashPath.setAttribute('d', trashIconPath);
    trashPath.setAttribute('fill', '#fff');
    trashIcon.append(trashPath);
    trashButton.append(trashIcon);
    const cancelButton = $el('button', { textContent: 'Cancel' });
    const debouncedFilter = createDebouncedRunner(() => {
      slot.__loadLorasLoraFilter = normalizeDialogFilterValue(filterInput.value);
      renderList(true);
    }, LORA_DIALOG_FILTER_DEBOUNCE_MS);
    const headerRow = $el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
      },
    });
    const headerItems = {
      filter: filterContainer,
      cancel: cancelButton,
      trash: trashButton,
    };
    loraDialogHeaderOrder.forEach((key) => {
      const item = headerItems[key];
      if (item) {
        headerRow.append(item);
      }
    });
    const list = $el('div', {
      style: getLoraDialogListStyle(),
    });

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
        return;
      }
      previewZoomLayer.style.backgroundImage = '';
      previewImage.removeAttribute('src');
      previewImage.style.display = 'none';
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
      const normalized = typeof label === 'string' ? label : '';
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
      const previewUrl = await fetchLoraPreviewUrl(normalized);
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
      const prevLabel = resolveComboLabel(slot.loraWidget?.value, options);
      const prevToggle = !!slot.toggleWidget?.value;
      setComboWidgetValue(slot.loraWidget, nextLabel);
      setWidgetValue(slot.toggleWidget, prevToggle);
      if (prevLabel !== nextLabel) {
        setWidgetValue(slot.selectionWidget, "");
        slot.selectionWidget.__loadLorasResetTopN = true;
      }
      slot.__loadLorasLoraFilter = normalizeDialogFilterValue(
        filterInput.value,
      );
      applyRowVisibility();
      markDirty(targetNode);
    };

    const createSelectedIcon = () => {
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(loraDialogSelectedIconSize));
      svg.setAttribute("height", String(loraDialogSelectedIconSize));
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.style.display = "block";
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", loraDialogSelectedIconPath);
      svg.append(path);
      return svg;
    };
    const createOpenFolderIcon = () => {
      const svg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', String(loraDialogOpenFolderIconSize));
      svg.setAttribute('height', String(loraDialogOpenFolderIconSize));
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.style.display = 'block';
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      path.setAttribute('d', loraDialogOpenFolderIconPath);
      svg.append(path);
      return svg;
    };

    const renderLabel = (labelContainer, label, query) => {
      const parts = splitLoraLabel(label);
      const segments = getHighlightSegments(parts.base, query);
      labelContainer.textContent = "";
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
        labelContainer.append(span);
      });
      if (parts.extension) {
        labelContainer.append(document.createTextNode(parts.extension));
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
      renderedButtons.forEach((entry, visibleIndex) => {
        const isSelected = visibleIndex === selectedVisibleIndex;
        const isHovered = visibleIndex === hoveredVisibleIndex;
        const isActive = isSelected || isHovered;
        entry.button.style.background = resolveLoraDialogItemBackground(
          isSelected,
          isHovered,
        );
        if (entry.iconWrap) {
          entry.iconWrap.style.opacity =
            entry.optionIndex === currentOptionIndex ? "1" : "0";
        }
        if (entry.openIconWrap) {
          entry.openIconWrap.style.opacity =
            entry.isOpenable && isActive ? '1' : '0';
          entry.openIconWrap.style.pointerEvents =
            entry.isOpenable && isActive ? 'auto' : 'none';
        }
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
        filteredIndices = filterLoraOptionIndicesFromBase(
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
      const noneOptionIndex = resolveNoneOptionIndex(options);
      visibleOptions.forEach((entry, index) => {
        const label = entry.label;
        const optionIndex = entry.index;
        const isOpenable =
          typeof label === 'string' && label !== 'None' && optionIndex !== noneOptionIndex;
        const button = $el("button", {
          style: {
            textAlign: "left",
            padding: `${loraDialogItemPaddingY}px ${loraDialogItemPaddingX}px`,
            borderRadius: "6px",
            border: loraDialogItemBorder,
            background: loraDialogItemBackground,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          },
        });
        button.style.color = "#e0e0e0";
        button.style.fontWeight = "400";
        // 選択移動でラベルの位置が揺れないように幅を固定する
        const iconWrap = $el("span", {
          style: {
            width: `${loraDialogSelectedIconSize}px`,
            height: `${loraDialogSelectedIconSize}px`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            opacity: "0",
          },
        });
        iconWrap.append(createSelectedIcon());
        const labelContainer = $el("span", {
          style: {
            flex: "1 1 auto",
            minWidth: "0",
          },
        });
        renderLabel(labelContainer, label, activeFilterQuery);
        const openIconWrap = $el('span', {
          style: {
            width: `${loraDialogOpenFolderIconSize}px`,
            height: `${loraDialogOpenFolderIconSize}px`,
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
          void openLoraFolder(label);
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
          applyHoverSelection(index);
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
          applySelection(label);
          closeDialog();
        };
        list.append(button);
      });
      refreshButtonStates();
      const previewVisibleIndex = resolvePreviewVisibleIndex(
        visibleOptions,
        currentOptionIndex,
      );
      updatePreviewByVisibleIndex(previewVisibleIndex);
    };

    const clearFilterValue = () => {
      debouncedFilter.cancel();
      filterInput.value = '';
      slot.__loadLorasLoraFilter = normalizeDialogFilterValue(
        filterInput.value,
      );
      renderList(true);
      focusInputLater(filterInput);
    };
    const applyNoneSelection = () => {
      debouncedFilter.cancel();
      const noneIndex = resolveNoneOptionIndex(options);
      if (noneIndex < 0) {
        clearFilterValue();
        return;
      }
      filterInput.value = '';
      slot.__loadLorasLoraFilter = normalizeDialogFilterValue(
        filterInput.value,
      );
      selectedOptionIndex = noneIndex;
      renderList(true);
      applySelectedLabel();
    };
    cancelButton.onclick = closeDialog;
    filterInput.oninput = () => {
      debouncedFilter.run();
    };
    clearFilterButton.onclick = clearFilterValue;
    trashButton.onclick = applyNoneSelection;
    list.addEventListener("mousemove", resumeHoverSelection);
    const scrollSelectedIntoView = () => {
      const entry = renderedButtons[selectedVisibleIndex];
      if (!entry) {
        return;
      }
      entry.button?.scrollIntoView?.({ block: "nearest" });
    };
    const scrollCheckedIntoView = () => {
      if (didAutoScrollToChecked) {
        return;
      }
      didAutoScrollToChecked = true;
      const entry = renderedButtons.find(
        (item) => item.optionIndex === currentOptionIndex,
      );
      if (!entry?.button) {
        return;
      }
      const listRect = list?.getBoundingClientRect?.();
      const buttonRect = entry.button?.getBoundingClientRect?.();
      if (!isRectFullyVisible(listRect, buttonRect)) {
        entry.button?.scrollIntoView?.({ block: "nearest" });
      }
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
      updatePreviewByVisibleIndex(selectedVisibleIndex);
    };

    const handleDialogKeyDown = (event) => {
      if (event?.__loadLorasDialogHandled) {
        return;
      }
      event.__loadLorasDialogHandled = true;
      const isProcessKey =
        event?.key === 'Process' || event?.keyCode === 229;
      if (suppressEnterOnce && !isProcessKey && event?.key !== 'Enter') {
        suppressEnterOnce = false;
      }
      if (suppressEnterOnce && event?.key === 'Enter') {
        suppressEnterOnce = false;
        return;
      }
      if (
        shouldIgnoreLoraDialogKeydownForIme(event, isFilterComposing, false)
      ) {
        if (
          event?.key === 'Enter' &&
          (event?.isComposing || isFilterComposing || isProcessKey)
        ) {
          hadComposingEnter = true;
        }
        return;
      }
      if (event.key === "ArrowDown") {
        debouncedFilter.flush();
        event.preventDefault();
        event.stopPropagation();
        moveSelection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        debouncedFilter.flush();
        event.preventDefault();
        event.stopPropagation();
        moveSelection(-1);
        return;
      }
      if (event.key === "Enter") {
        debouncedFilter.flush();
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
    panel.append(headerRow, list);
    dialogShell.append(previewPanel, panel);
    overlay.append(dialogShell);
    document.body.append(overlay);
    overlay.__loadLorasCleanup = () => {
      debouncedFilter.cancel();
      previewRequestToken += 1;
      if (previewZoomRaf !== null) {
        cancelAnimationFrame(previewZoomRaf);
        previewZoomRaf = null;
      }
      previewZoomPoint = null;
      setPreviewUrl(null);
    };
    requestAnimationFrame(() => {
      scrollCheckedIntoView();
    });
    focusInputLater(filterInput);
    if (shouldSelectFilterOnOpen) {
      requestAnimationFrame(() => {
        if (document.activeElement !== filterInput) {
          return;
        }
        if (typeof filterInput.select === 'function') {
          filterInput.select();
        }
      });
    }
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
      if (isPointInRect(pos, slot.__hitDragHandle)) {
        const isPrimaryButton =
          event?.button === 0 || event?.which === 1 || event?.buttons === 1;
        if (isPrimaryButton && startSlotDrag(slot, pos)) {
          if (event) {
            event.__loadLorasHandled = true;
          }
          return true;
        }
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

    const originalMouseMove = node.onMouseMove;
    const wrappedMouseMove = function (event, pos) {
      if (dragState.pointerDown) {
        updateSlotDrag(event, pos);
        return true;
      }
      return originalMouseMove?.apply(this, arguments);
    };
    wrappedMouseMove.__loadLorasHandler = true;
    node.onMouseMove = wrappedMouseMove;

    const originalMouseUp = node.onMouseUp;
    const wrappedMouseUp = function (event, pos) {
      if (endSlotDrag()) {
        if (event) {
          event.__loadLorasHandled = true;
        }
        return true;
      }
      return originalMouseUp?.apply(this, arguments);
    };
    wrappedMouseUp.__loadLorasHandler = true;
    node.onMouseUp = wrappedMouseUp;
  }

  if (!node.__loadLorasDrawForegroundWrapped) {
    node.__loadLorasDrawForegroundWrapped = true;
    const originalDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      originalDrawForeground?.apply(this, arguments);
      if (!dragState.active) {
        return;
      }
      const sourceSlot = slots[dragState.sourceIndex];
      if (!sourceSlot) {
        return;
      }
      const width = this?.size?.[0] ?? 0;
      const baseY = dragState.pointerY ?? sourceSlot.__rowRect?.y ?? 0;
      const dragY = baseY - (dragState.pointerOffsetY ?? 0);
      drawRowContent(sourceSlot, ctx, width, dragY, true);
    };
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
        const rawFilterValue = slot.__loadLorasLoraFilter;
        const normalizedFilterValue =
          rawFilterValue === undefined || rawFilterValue === null
            ? null
            : normalizeDialogFilterValue(rawFilterValue);
        values.push(
          loraValue,
          slot.strengthWidget?.value ?? strengthDefault,
          slot.toggleWidget?.value ?? true,
          normalizeSelectionValue(slot.selectionWidget?.value),
          normalizedFilterValue,
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
