import { app } from '../../../../scripts/app.js';
import {
  buildTagDisplaySegments,
  computeDisplayHeight,
  defaultDisplayHeight,
  findInputIndex,
  formatDisabledTagLabel,
  persistInputText,
  readPersistedInputText,
  parseExcludedTags,
  serializeExcludedTags,
  shouldForwardWheelToCanvas,
  splitTags,
  toggleTag,
} from './tagToggleTextUtils.js';
import {
  FONT_SIZE_SETTING_ID,
  normalizeFontSize,
} from './tagToggleTextSettings.js';

const TARGET_NODE_CLASS = 'TagToggleTextNode';
const TEXT_INPUT_NAME = 'text';
const EXCLUDED_WIDGET_NAME = 'excluded_tags';
const DISPLAY_WIDGET_NAME = 'tag_toggle_display';

const DISPLAY_PADDING_X = 8;
const DISPLAY_PADDING_Y = 6;
const DISPLAY_PADDING_TOTAL = DISPLAY_PADDING_Y * 2 + 4;
const LINE_HEIGHT_RATIO = 18 / 14;

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);

const getFontSize = () => {
  const value = app?.extensionManager?.setting?.get?.(FONT_SIZE_SETTING_ID);
  return normalizeFontSize(value);
};

const resolveLineHeight = (fontSize) => Math.round(fontSize * LINE_HEIGHT_RATIO);

const hideExcludedTagsInput = (node) => {
  if (!node) {
    return;
  }
  const inputs = node.inputs || [];
  const index = findInputIndex(inputs, EXCLUDED_WIDGET_NAME);
  if (index >= 0 && typeof node.removeInput === 'function') {
    node.removeInput(index);
  }
};

const markDirty = (node) => {
  if (typeof node?.setDirtyCanvas === 'function') {
    node.setDirtyCanvas(true, true);
    return;
  }
  if (app?.graph?.setDirtyCanvas) {
    app.graph.setDirtyCanvas(true, true);
  }
};

const resizeNodeToContent = (node, keepWidth = false) => {
  const size = node?.computeSize?.();
  if (!Array.isArray(size)) {
    return;
  }
  const nextSize = [size[0], size[1]];
  if (keepWidth) {
    const width = node?.size?.[0];
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      nextSize[0] = width;
    }
  }
  if (typeof node?.setSize === 'function') {
    node.setSize(nextSize);
    return;
  }
  node.size = nextSize;
};

const ensureHiddenBehavior = (widget) => {
  if (!widget || widget.__tagToggleHiddenWrapped) {
    return;
  }
  const originalComputeSize = widget.computeSize;
  widget.computeSize = (width) => {
    if (widget.__tagToggleHidden) {
      return [0, -4];
    }
    if (originalComputeSize && originalComputeSize !== widget.computeSize) {
      return originalComputeSize(width);
    }
    return [width ?? 0, 24];
  };
  widget.__tagToggleHiddenWrapped = true;
};

const setWidgetHidden = (widget, hidden) => {
  if (!widget) {
    return;
  }
  ensureHiddenBehavior(widget);
  widget.__tagToggleHidden = hidden;
  if (widget.inputEl) {
    widget.inputEl.style.display = hidden ? 'none' : '';
  }
  widget.hidden = hidden;
  if (widget.__tagToggleKeepSerialization) {
    widget.serialize = true;
  }
};

const resolveExecutedText = (value) => {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '';
    }
    const first = value[0];
    return first == null ? '' : String(first);
  }
  return String(value);
};

const getInputText = (node) => {
  if (node && typeof node.__tagToggleInputText === 'string') {
    return node.__tagToggleInputText;
  }
  const inputs = node?.inputs || [];
  const inputIndex = inputs.findIndex((input) => input?.name === TEXT_INPUT_NAME);
  if (inputIndex >= 0 && typeof node?.getInputData === 'function') {
    const value = node.getInputData(inputIndex);
    if (value != null) {
      return String(value);
    }
  }
  const widget = getWidget(node, TEXT_INPUT_NAME);
  if (widget?.value != null) {
    return String(widget.value);
  }
  return '';
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

const getExcludedTags = (node) => {
  if (Array.isArray(node.__tagToggleExcluded)) {
    return node.__tagToggleExcluded;
  }
  const widget = getWidget(node, EXCLUDED_WIDGET_NAME);
  const parsed = parseExcludedTags(widget?.value);
  node.__tagToggleExcluded = parsed;
  return parsed;
};

const setExcludedTags = (node, tags) => {
  node.__tagToggleExcluded = tags;
  const widget = getWidget(node, EXCLUDED_WIDGET_NAME);
  if (!widget) {
    return;
  }
  setWidgetValue(widget, serializeExcludedTags(tags));
};

const getPersistedInputText = (node) => {
  if (typeof node?.__tagToggleInputText === 'string') {
    return node.__tagToggleInputText;
  }
  const widget = getWidget(node, TEXT_INPUT_NAME);
  if (widget?.value != null) {
    return String(widget.value);
  }
  return null;
};

const toggleExcludedTag = (node, tag) => {
  const current = getExcludedTags(node);
  const next = toggleTag(current, tag);
  setExcludedTags(node, next);
  renderTagDisplay(node);
  markDirty(node);
};

const moveWidgetBefore = (node, widget, targetWidget) => {
  if (!widget) {
    return;
  }
  const list = node.widgets || [];
  const currentIndex = list.indexOf(widget);
  if (currentIndex >= 0) {
    list.splice(currentIndex, 1);
  }
  if (!targetWidget) {
    list.push(widget);
    return;
  }
  const targetIndex = list.indexOf(targetWidget);
  if (targetIndex < 0) {
    list.push(widget);
    return;
  }
  list.splice(targetIndex, 0, widget);
};

const getDisplayHeight = (node) =>
  computeDisplayHeight({
    nodeHeight: node?.size?.[1],
    titleHeight: LiteGraph?.NODE_TITLE_HEIGHT,
    fallbackHeight: defaultDisplayHeight,
    extraPadding: DISPLAY_PADDING_TOTAL,
  });

const syncDisplayHeight = (node) => {
  const display = node.__tagToggleDisplay;
  if (!display) {
    return;
  }
  const height = getDisplayHeight(node);
  display.container.style.height = `${height}px`;
  display.container.style.minHeight = `${height}px`;
  display.container.style.maxHeight = `${height}px`;
};

const applyFontSize = (node) => {
  const display = node.__tagToggleDisplay;
  if (!display?.container) {
    return;
  }
  const fontSize = getFontSize();
  display.container.style.fontSize = `${fontSize}px`;
  display.container.style.lineHeight = `${resolveLineHeight(fontSize)}px`;
};

const createDisplayDom = (node) => {
  const container = document.createElement('div');
  const displayBox = document.createElement('div');
  const label = document.createElement('div');
  const content = document.createElement('div');
  const fontSize = getFontSize();

  container.style.height = '100%';
  container.style.width = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.boxSizing = 'border-box';

  displayBox.style.flex = '1';
  displayBox.style.minHeight = '0';
  displayBox.style.overflowY = 'auto';
  displayBox.style.overflowX = 'hidden';
  displayBox.style.boxSizing = 'border-box';
  displayBox.style.padding = `${DISPLAY_PADDING_Y}px ${DISPLAY_PADDING_X}px`;
  displayBox.style.fontSize = `${fontSize}px`;
  displayBox.style.lineHeight = `${resolveLineHeight(fontSize)}px`;
  displayBox.style.fontFamily = 'sans-serif';
  displayBox.style.whiteSpace = 'normal';
  displayBox.style.wordBreak = 'break-word';
  displayBox.style.cursor = 'default';

  label.style.display = 'none';
  label.style.color = '#c0c0c0';
  label.style.fontSize = '12px';
  label.style.lineHeight = '16px';
  label.style.marginTop = '4px';
  // 理由: 無効タグがある時だけ追加情報を出し、視認性を上げるため

  content.style.display = 'block';
  displayBox.appendChild(content);

  container.appendChild(displayBox);
  container.appendChild(label);

  displayBox.addEventListener('click', (event) => {
    const target = event?.target;
    const element =
      target && target.nodeType === 3 ? target.parentElement : target;
    const tagElement = element?.closest?.('[data-tag]');
    const tag = tagElement?.dataset?.tag;
    if (!tag) {
      return;
    }
    toggleExcludedTag(node, tag);
    event.preventDefault();
    event.stopPropagation();
  });
  displayBox.addEventListener('wheel', (event) => {
    if (event?.__tagToggleWheelForwarded) {
      return;
    }
    const shouldForward = shouldForwardWheelToCanvas({
      deltaY: event?.deltaY,
      scrollTop: displayBox.scrollTop,
      scrollHeight: displayBox.scrollHeight,
      clientHeight: displayBox.clientHeight,
    });
    if (!shouldForward) {
      return;
    }
    const canvas = app?.canvas?.canvas;
    if (!canvas || typeof canvas.dispatchEvent !== 'function') {
      return;
    }
    const forwarded = new WheelEvent(event.type || 'wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    });
    forwarded.__tagToggleWheelForwarded = true;
    canvas.dispatchEvent(forwarded);
    event.preventDefault();
    event.stopPropagation();
  });

  return { container, content, label, displayBox };
};

const renderTagDisplay = (node) => {
  const display = node.__tagToggleDisplay;
  if (!display) {
    return;
  }
  const { content, container, label, displayBox } = display;
  const inputText = getInputText(node);
  const tags = splitTags(inputText);
  const excluded = getExcludedTags(node);
  const segments = buildTagDisplaySegments({ tags, excluded });
  const textColor = LiteGraph?.WIDGET_TEXT_COLOR ?? '#d0d0d0';
  const disabledLabel = formatDisabledTagLabel({ tags, excluded });

  displayBox.style.color = textColor;
  content.textContent = '';

  if (label) {
    label.textContent = disabledLabel ?? '';
    label.style.display = disabledLabel ? 'block' : 'none';
  }

  segments.forEach((segment) => {
    if (segment.type === 'separator') {
      content.appendChild(document.createTextNode(segment.text));
      return;
    }
    if (segment.type === 'empty') {
      const span = document.createElement('span');
      span.textContent = segment.text;
      span.style.color = '#8a8a8a';
      content.appendChild(span);
      return;
    }
    if (segment.type === 'tag') {
      const span = document.createElement('span');
      span.textContent = segment.text;
      span.dataset.tag = segment.text;
      span.style.cursor = 'pointer';
      if (segment.excluded) {
        span.style.opacity = '0.55';
        span.style.textDecoration = 'line-through';
      }
      content.appendChild(span);
    }
  });
};

const ensureDisplayWidget = (node) => {
  if (node.__tagToggleDisplay) {
    return node.__tagToggleDisplay;
  }
  if (typeof node?.addDOMWidget !== 'function') {
    return null;
  }
  const dom = createDisplayDom(node);
  const widget = node.addDOMWidget(
    DISPLAY_WIDGET_NAME,
    'tag_toggle_display',
    dom.container,
    {
      getHeight: () => getDisplayHeight(node),
      getMinHeight: () => getDisplayHeight(node),
      getMaxHeight: () => getDisplayHeight(node),
      hideOnZoom: true,
    },
  );
  widget.serialize = false;
  widget.computeSize = (width) => [width ?? 0, getDisplayHeight(node)];
  node.__tagToggleDisplay = { ...dom, widget };
  syncDisplayHeight(node);
  return node.__tagToggleDisplay;
};

const setupTagToggleUi = (node) => {
  if (node.__tagToggleUiReady) {
    return;
  }
  node.__tagToggleUiReady = true;
  hideExcludedTagsInput(node);

  const originalOnExecuted = node.onExecuted;
  node.onExecuted = function (output) {
    originalOnExecuted?.apply(this, arguments);
    const resolved = resolveExecutedText(output?.input_text);
    if (resolved !== null) {
      node.__tagToggleInputText = resolved;
      renderTagDisplay(node);
      markDirty(node);
    }
  };

  const excludedWidget = getWidget(node, EXCLUDED_WIDGET_NAME);
  if (excludedWidget) {
    excludedWidget.__tagToggleKeepSerialization = true;
    setWidgetHidden(excludedWidget, true);
    node.__tagToggleExcluded = parseExcludedTags(excludedWidget.value);
  }

  const textWidget = getWidget(node, TEXT_INPUT_NAME);
  if (textWidget) {
    setWidgetHidden(textWidget, true);
  }

  const display = ensureDisplayWidget(node);
  if (display?.widget) {
    moveWidgetBefore(node, display.widget, excludedWidget ?? textWidget);
  }
  applyFontSize(node);
  syncDisplayHeight(node);
  renderTagDisplay(node);
  resizeNodeToContent(node, true);

  if (!node.__tagToggleResizeReady) {
    node.__tagToggleResizeReady = true;
    const originalOnResize = node.onResize;
    node.onResize = function () {
      originalOnResize?.apply(this, arguments);
      syncDisplayHeight(node);
      renderTagDisplay(node);
    };
  }

  if (!node.__tagToggleExcludeHandleReady) {
    node.__tagToggleExcludeHandleReady = true;
    const originalOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function () {
      const result = originalOnConnectionsChange?.apply(this, arguments);
      hideExcludedTagsInput(node);
      return result;
    };
    hideExcludedTagsInput(node);
  }

  if (!node.__tagToggleSerializeReady) {
    node.__tagToggleSerializeReady = true;
    const originalSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      originalSerialize?.apply(this, arguments);
      const inputText = getPersistedInputText(node);
      if (typeof inputText === 'string') {
        persistInputText(o, inputText);
      }
    };
  }

  if (!node.__tagToggleConfigureReady) {
    node.__tagToggleConfigureReady = true;
    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      const result = originalConfigure?.apply(this, arguments);
      const persisted = readPersistedInputText(info);
      if (typeof persisted === 'string') {
        node.__tagToggleInputText = persisted;
      }
      const excludedWidget = getWidget(node, EXCLUDED_WIDGET_NAME);
      if (excludedWidget) {
        node.__tagToggleExcluded = parseExcludedTags(excludedWidget.value);
      }
      renderTagDisplay(node);
      return result;
    };
  }
};

app.registerExtension({
  name: 'craftgear.tagToggleText',
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupTagToggleUi(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    setupTagToggleUi(node);
  },
});
