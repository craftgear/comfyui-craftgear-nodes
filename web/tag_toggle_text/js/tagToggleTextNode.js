import { app } from '../../../../scripts/app.js';
import {
  parseExcludedTags,
  serializeExcludedTags,
  splitTags,
  shouldHandleClick,
  toggleTag,
} from './tagToggleTextUtils.js';

const TARGET_NODE_CLASS = 'TagToggleTextNode';
const TEXT_INPUT_NAME = 'text';
const EXCLUDED_WIDGET_NAME = 'excluded_tags';

const MARGIN = 10;
const TITLE_HEIGHT = 14;
const TITLE_GAP = 4;
const TAG_LINE_HEIGHT = 18;

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);

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

const toggleExcludedTag = (node, tag) => {
  const current = getExcludedTags(node);
  const next = toggleTag(current, tag);
  setExcludedTags(node, next);
  markDirty(node);
};

const isPointInRect = (pos, rect) =>
  pos[0] >= rect.x &&
  pos[0] <= rect.x + rect.width &&
  pos[1] >= rect.y &&
  pos[1] <= rect.y + rect.height;

const createDisplayWidget = (node) => {
  const widget = {
    type: 'custom',
    name: 'tag_toggle_display',
    value: '',
    serialize: false,
    computeSize(width) {
      const height = widget.__tagToggleHeight ?? 120;
      return [width ?? 0, height];
    },
    draw(ctx, _node, width, y) {
      const bodyWidth = Math.max(0, width - MARGIN * 2);
      const startX = MARGIN;
      let cursorY = y + MARGIN;

      ctx.save();
      ctx.textBaseline = 'top';

      const inputText = getInputText(node);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#b0b0b0';
      ctx.fillText('Tags', startX, cursorY);
      cursorY += TITLE_HEIGHT + TITLE_GAP;

      ctx.font = '14px sans-serif';
      ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? '#d0d0d0';
      const tags = splitTags(inputText);
      const excluded = new Set(getExcludedTags(node));

      widget.__tagRects = [];
      let tagX = startX;
      let tagY = cursorY;

      if (tags.length === 0) {
        ctx.fillStyle = '#8a8a8a';
        ctx.fillText('(no tags)', startX, tagY);
        tagY += TAG_LINE_HEIGHT;
      } else {
        tags.forEach((tag, index) => {
          const separator = index < tags.length - 1 ? ', ' : '';
          const tagWidth = ctx.measureText(tag).width;
          const separatorWidth = ctx.measureText(separator).width;
          const totalWidth = tagWidth + separatorWidth;

          if (tagX > startX && tagX + totalWidth > startX + bodyWidth) {
            tagX = startX;
            tagY += TAG_LINE_HEIGHT;
          }

          const isExcluded = excluded.has(tag);
          ctx.save();
          if (isExcluded) {
            ctx.globalAlpha *= 0.55;
          }
          ctx.fillStyle = LiteGraph?.WIDGET_TEXT_COLOR ?? '#d0d0d0';
          ctx.fillText(tag, tagX, tagY);
          ctx.restore();

          widget.__tagRects.push({
            tag,
            x: tagX,
            y: tagY,
            width: tagWidth,
            height: TAG_LINE_HEIGHT,
          });

          if (isExcluded) {
            const strikeY = tagY + TAG_LINE_HEIGHT / 2;
            ctx.save();
            ctx.strokeStyle = '#c0c0c0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tagX, strikeY);
            ctx.lineTo(tagX + tagWidth, strikeY);
            ctx.stroke();
            ctx.restore();
          }

          tagX += tagWidth;
          if (separator) {
            if (tagX > startX && tagX + separatorWidth > startX + bodyWidth) {
              tagX = startX;
              tagY += TAG_LINE_HEIGHT;
            }
            ctx.fillText(separator, tagX, tagY);
            tagX += separatorWidth;
          }
        });
        tagY += TAG_LINE_HEIGHT;
      }

      ctx.restore();

      const nextHeight = tagY + MARGIN - y;
      if (widget.__tagToggleHeight !== nextHeight) {
        widget.__tagToggleHeight = nextHeight;
        resizeNodeToContent(node, true);
      }
    },
    mouse(event, pos) {
      if (!shouldHandleClick(event)) {
        return false;
      }
      if (!Array.isArray(pos)) {
        return false;
      }
      const rects = widget.__tagRects || [];
      const hit = rects.find((rect) => isPointInRect(pos, rect));
      if (!hit) {
        return false;
      }
      toggleExcludedTag(node, hit.tag);
      if (event) {
        event.__tagToggleHandled = true;
      }
      return true;
    },
    onMouseDown(event, pos) {
      return widget.mouse?.(event, pos);
    },
  };
  return widget;
};

const insertBeforeWidget = (node, targetWidget, widgets) => {
  const list = node.widgets || [];
  if (!targetWidget) {
    list.push(...widgets);
    return;
  }
  const targetIndex = list.indexOf(targetWidget);
  if (targetIndex < 0) {
    list.push(...widgets);
    return;
  }
  list.splice(targetIndex, 0, ...widgets);
};

const setupTagToggleUi = (node) => {
  if (node.__tagToggleUiReady) {
    return;
  }
  node.__tagToggleUiReady = true;

  const originalOnExecuted = node.onExecuted;
  node.onExecuted = function (output) {
    originalOnExecuted?.apply(this, arguments);
    const resolved = resolveExecutedText(output?.input_text);
    if (resolved !== null) {
      node.__tagToggleInputText = resolved;
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

  const displayWidget = createDisplayWidget(node);
  insertBeforeWidget(node, excludedWidget ?? textWidget, [displayWidget]);
  resizeNodeToContent(node, true);
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
