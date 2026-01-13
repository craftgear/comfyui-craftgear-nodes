import { normalizeSelectionValue } from './selectionValueUtils.js';

const ensureSelectionSerializable = (widget) => {
  if (!widget || widget.__selectionSerializedWrapped) {
    return;
  }
  const originalSerialize = widget.serializeValue;
  widget.serializeValue = function () {
    const target = widget ?? this;
    if (target) {
      target.value = normalizeSelectionValue(target.value);
    }
    if (typeof originalSerialize === 'function') {
      return originalSerialize.apply(this, arguments);
    }
    return target ? target.value : '';
  };
  widget.__selectionSerializedWrapped = true;
};

export { ensureSelectionSerializable };
