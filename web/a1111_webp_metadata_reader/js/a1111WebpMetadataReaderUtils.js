const isSupportedImagePath = (value) => {
  const lower = String(value || '').toLowerCase();
  return (
    lower.endsWith('.webp') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg')
  );
};

const normalizeDroppedPath = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.startsWith('file://')) {
    try {
      return decodeURIComponent(text.replace(/^file:\/\//, ''));
    } catch (_error) {
      return text.replace(/^file:\/\//, '');
    }
  }
  return text;
};

const fileNameFromPath = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const parts = text.split(/[\\/]/);
  return parts[parts.length - 1] || text;
};

const buildInputPreviewPayload = (value) => {
  const text = String(value || '').trim().replaceAll('\\', '/');
  if (!text) {
    return null;
  }
  const parts = text.split('/').filter((part) => part && part !== '.');
  if (parts.length === 0) {
    return null;
  }
  const filename = parts[parts.length - 1];
  if (!filename) {
    return null;
  }
  const subfolder = parts.slice(0, -1).join('/');
  if (!subfolder) {
    return {
      filename,
      type: 'input',
    };
  }
  return {
    filename,
    subfolder,
    type: 'input',
  };
};

const applyWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  widget.value = value;
  if (typeof widget.callback === 'function') {
    widget.callback(value);
  }
};

const wrapWidgetCallback = (widget, markerKey, onChange) => {
  if (!widget || widget[markerKey]) {
    return;
  }
  const original = widget.callback;
  widget.callback = (value, ...args) => {
    const result = original?.(value, ...args);
    onChange?.(value);
    return result;
  };
  widget[markerKey] = true;
};

export {
  applyWidgetValue,
  buildInputPreviewPayload,
  fileNameFromPath,
  isSupportedImagePath,
  normalizeDroppedPath,
  wrapWidgetCallback,
};
