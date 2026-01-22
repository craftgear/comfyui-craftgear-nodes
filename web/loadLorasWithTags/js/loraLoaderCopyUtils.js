import {
  normalizeOptions,
  resolveComboDisplayLabel,
  resolveStrengthDefault,
  shouldPreserveUnknownOption,
} from './loadLorasWithTagsUiUtils.js';
import { normalizeSelectionValue } from './selectionValueUtils.js';

const toNumber = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isZero = (value) => Math.abs(value) < 1e-9;

const isEnabled = (value) => {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return !isZero(value);
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'false' || text === '0' || text === 'off' || text === 'no') {
    return false;
  }
  if (text === 'true' || text === '1' || text === 'on' || text === 'yes') {
    return true;
  }
  return true;
};

const normalizeNodeClass = (value) =>
  String(value ?? '').replace(/\s+/g, '').toLowerCase();

const isSupportedLoraNodeClass = (value) => {
  const normalized = normalizeNodeClass(value);
  return (
    normalized === 'loraloader' ||
    normalized === 'loraloadermodelonly' ||
    normalized === 'loadloraswithtags' ||
    normalized.includes('powerloraloader') ||
    normalized.includes('loraloader')
  );
};

const findWidget = (node, name) => node?.widgets?.find?.((widget) => widget?.name === name);

const resolveLabel = (widget) => {
  const options = normalizeOptions(widget?.options?.values);
  const raw = widget?.value;
  if (options.length === 0) {
    return String(raw ?? '');
  }
  if (shouldPreserveUnknownOption(raw, options)) {
    return raw ?? '';
  }
  return resolveComboDisplayLabel(raw, options);
};

const resolveStrength = (widget, fallback = 1) => {
  const defaultValue = resolveStrengthDefault(widget?.options, fallback);
  return toNumber(widget?.value, defaultValue);
};

const pickStrengthFromObject = (value, fallback = 1) => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const list = [
    value.strength,
    value.strength_model,
    value.strength_clip,
    value.strengthTwo,
    value.model,
    value.clip,
  ];
  for (const candidate of list) {
    const parsed = toNumber(candidate, null);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const collectRowsByPattern = (widgets) => {
  if (!Array.isArray(widgets)) {
    return [];
  }
  const strengthBySuffix = new Map();
  widgets.forEach((widget) => {
    const name = String(widget?.name ?? '').toLowerCase();
    const strengthMatch = name.match(/strength[_-]?(\d+)/);
    if (strengthMatch) {
      strengthBySuffix.set(strengthMatch[1], widget);
    }
  });
  const toggleBySuffix = new Map();
  widgets.forEach((widget) => {
    const name = String(widget?.name ?? '').toLowerCase();
    const toggleMatch = name.match(/on[_-]?(\d+)/);
    if (toggleMatch) {
      toggleBySuffix.set(toggleMatch[1], widget);
    }
  });
  const rows = [];
  widgets.forEach((widget) => {
    const name = String(widget?.name ?? '').toLowerCase();
    const loraMatch = name.match(/lora[_-]?(\d+)/);
    if (!loraMatch) {
      return;
    }
    const suffix = loraMatch[1];
    const rawValue = widget?.value;
    const label = resolveLabel(widget);
    if (!label || label === 'None') {
      return;
    }
    const strengthWidget = strengthBySuffix.get(suffix);
    const strength = resolveStrength(strengthWidget, 1);
    const toggleWidget = toggleBySuffix.get(suffix);
    const enabled = isEnabled(toggleWidget?.value);
    rows.push({ label, strength, enabled });
  });
  return rows;
};

const collectFromLoraLoader = (node) => {
  const nameWidget = findWidget(node, 'lora_name');
  if (!nameWidget) {
    return collectRowsByPattern(node?.widgets);
  }
  const label = resolveLabel(nameWidget);
  if (!label || label === 'None') {
    return [];
  }
  const strengthModelWidget = findWidget(node, 'strength_model');
  const strengthClipWidget = findWidget(node, 'strength_clip');
  const strengthModel = toNumber(strengthModelWidget?.value, null);
  const strengthClip = toNumber(strengthClipWidget?.value, null);
  const pickStrength = () => {
    if (strengthModel !== null && !isZero(strengthModel)) {
      return strengthModel;
    }
    if (strengthClip !== null && !isZero(strengthClip)) {
      return strengthClip;
    }
    if (strengthModel !== null) {
      return strengthModel;
    }
    if (strengthClip !== null) {
      return strengthClip;
    }
    return 1;
  };
  const strength = pickStrength();
  return [
    {
      label,
      strength,
      enabled: true,
    },
  ];
};

const collectFromPowerLoraLoader = (node) => {
  const widgets = Array.isArray(node?.widgets) ? node.widgets : [];
  const rows = [];
  widgets.forEach((widget) => {
    const value = widget?.value;
    if (!value || typeof value !== 'object') {
      return;
    }
    if (!('lora' in value)) {
      return;
    }
    const label = String(value.lora ?? '');
    if (!label || label === 'None') {
      return;
    }
    const strength = pickStrengthFromObject(value, 1);
    const enabled = isEnabled(value.on ?? value.enabled ?? true);
    if (!enabled) {
      return;
    }
    rows.push({ label, strength, enabled });
  });
  // fallback to pattern-based rows if none were found
  if (rows.length === 0) {
    return collectRowsByPattern(widgets);
  }
  return rows;
};

const collectFromLoraLoaderModelOnly = (node) => {
  const nameWidget = findWidget(node, 'lora_name');
  if (!nameWidget) {
    return [];
  }
  const label = resolveLabel(nameWidget);
  if (!label || label === 'None') {
    return [];
  }
  const strengthWidget = findWidget(node, 'strength');
  const strength = toNumber(strengthWidget?.value, 1);
  return [
    {
      label,
      strength,
      enabled: true,
    },
  ];
};

const collectFromLoadLorasWithTags = (node) => {
  const output = [];
  for (let index = 1; index <= 10; index += 1) {
    const nameWidget = findWidget(node, `lora_name_${index}`);
    const strengthWidget = findWidget(node, `lora_strength_${index}`);
    const toggleWidget = findWidget(node, `lora_on_${index}`);
    const selectionWidget = findWidget(node, `tag_selection_${index}`);
    const options = normalizeOptions(nameWidget?.options?.values);
    const label = resolveComboDisplayLabel(nameWidget?.value, options);
    if (!label || label === 'None') {
      continue;
    }
    const enabled = isEnabled(toggleWidget?.value);
    if (!enabled) {
      continue;
    }
    const strength = resolveStrength(strengthWidget, 1);
    const selection = normalizeSelectionValue(selectionWidget?.value);
    output.push({ label, strength, enabled, selection });
  }
  return output;
};

const collectLoraEntriesFromNode = (node) => {
  const comfyClass = node?.comfyClass || node?.type || '';
  const normalized = normalizeNodeClass(comfyClass);
  if (normalized === 'loadloraswithtags') {
    return collectFromLoadLorasWithTags(node);
  }
  if (normalized.includes('powerloraloader')) {
    return collectFromPowerLoraLoader(node);
  }
  if (normalized.includes('loraloadermodelonly')) {
    return collectFromLoraLoaderModelOnly(node);
  }
  if (normalized.includes('loraloader')) {
    return collectFromLoraLoader(node);
  }
  return [];
};

const orderCopySources = (sources) => {
  if (!Array.isArray(sources)) {
    return [];
  }
  return [...sources].sort((a, b) => {
    const titleA = String(a?.title || a?.properties?.title || '').toLowerCase();
    const titleB = String(b?.title || b?.properties?.title || '').toLowerCase();
    if (titleA !== titleB) {
      return titleA.localeCompare(titleB);
    }
    const classA = normalizeNodeClass(a?.comfyClass || a?.type);
    const classB = normalizeNodeClass(b?.comfyClass || b?.type);
    if (classA !== classB) {
      return classA.localeCompare(classB);
    }
    const idA = Number.isFinite(a?.id) ? a.id : 0;
    const idB = Number.isFinite(b?.id) ? b.id : 0;
    return idA - idB;
  });
};

export {
  collectLoraEntriesFromNode,
  isSupportedLoraNodeClass,
  normalizeNodeClass,
  orderCopySources,
};
