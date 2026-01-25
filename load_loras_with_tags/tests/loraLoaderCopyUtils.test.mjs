import { describe, expect, it } from 'vitest';

import {
  collectLoraEntriesFromNode,
  isSupportedLoraNodeClass,
  normalizeNodeClass,
  orderCopySources,
} from '../../web/loadLorasWithTags/js/loraLoaderCopyUtils.js';

const widget = (name, value, options) => ({
  name,
  value,
  options: options ? { values: options } : undefined,
});

const buildLoraLoaderNode = ({ name, strengthModel, strengthClip }) => ({
  comfyClass: 'LoraLoader',
  widgets: [
    widget('lora_name', name),
    widget('strength_model', strengthModel),
    widget('strength_clip', strengthClip),
  ],
});

const buildLoraLoaderModelOnlyNode = ({ name, strength }) => ({
  comfyClass: 'LoraLoaderModelOnly',
  widgets: [widget('lora_name', name), widget('strength', strength)],
});

const buildPowerLoraLoaderNode = () => ({
  comfyClass: 'Power Lora Loader (rgthree)',
  widgets: [
    widget('header', { foo: 'bar' }),
    widget('lora_1', {
      lora: 'theta.safetensors',
      strength: 0.6,
      on: true,
    }),
    widget('lora_2', {
      lora: 'iota.safetensors',
      strength: 0.9,
      on: false,
    }),
  ],
});

const buildLoadLorasWithTagsNode = (entries, options) => {
  const widgets = [];
  entries.forEach((entry, index) => {
    const slot = index + 1;
    widgets.push(widget(`lora_name_${slot}`, entry.name, options));
    widgets.push(widget(`lora_strength_${slot}`, entry.strength));
    widgets.push(widget(`lora_on_${slot}`, entry.on));
    widgets.push(widget(`tag_selection_${slot}`, entry.selection ?? ''));
  });
  return { comfyClass: 'LoadLorasWithTags', widgets };
};

describe('collectLoraEntriesFromNode', () => {
  it('prefers active clip strength when model is zero on LoraLoader', () => {
    const node = buildLoraLoaderNode({
      name: 'alpha.safetensors',
      strengthModel: 0,
      strengthClip: 0.55,
    });
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      label: 'alpha.safetensors',
      strength: 0.55,
      enabled: true,
    });
  });

  it('defaults to strength 1 when loader strengths are missing', () => {
    const node = buildLoraLoaderNode({ name: 'beta.safetensors' });
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toHaveLength(1);
    expect(entries[0].strength).toBe(1);
  });

  it('returns zero strength when both model and clip are explicitly zero', () => {
    const node = buildLoraLoaderNode({ name: 'zero.safetensors', strengthModel: 0, strengthClip: 0 });
    const entries = collectLoraEntriesFromNode(node);
    expect(entries[0].strength).toBe(0);
  });

  it('returns clip strength even when it is zero and model is missing', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        widget('lora_name', 'epsilon'),
        widget('strength_clip', 0),
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries[0].strength).toBe(0);
  });

  it('returns array when strengthModel is non-zero and clip missing', () => {
    const node = buildLoraLoaderNode({ name: 'delta', strengthModel: 0.7, strengthClip: null });
    const entries = collectLoraEntriesFromNode(node);
    expect(entries[0].strength).toBe(0.7);
  });

  it('reads strength from LoraLoaderModelOnly', () => {
    const node = buildLoraLoaderModelOnlyNode({
      name: 'gamma.safetensors',
      strength: 0.8,
    });
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      label: 'gamma.safetensors',
      strength: 0.8,
      enabled: true,
    });
  });

  it('collects slots from LoadLorasWithTags including disabled ones in order', () => {
    const options = ['None', 'delta.safetensors', 'epsilon.safetensors'];
    const node = buildLoadLorasWithTagsNode(
      [
        { name: 1, strength: 0.7, on: true },
        { name: 2, strength: 0.4, on: false },
        { name: 'None', strength: 1, on: true },
      ],
      options,
    );
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([
      {
        label: 'delta.safetensors',
        strength: 0.7,
        enabled: true,
        selection: '',
      },
      {
        label: 'epsilon.safetensors',
        strength: 0.4,
        enabled: false,
        selection: '',
      },
    ]);
  });

  it('accepts class names with spaces and casing differences', () => {
    expect(isSupportedLoraNodeClass('Lora Loader')).toBe(true);
    expect(isSupportedLoraNodeClass('lora loader model only')).toBe(true);
    expect(isSupportedLoraNodeClass('Load Loras With Tags')).toBe(true);
    expect(isSupportedLoraNodeClass('Power Lora Loader (rgthree)')).toBe(true);
    expect(isSupportedLoraNodeClass('LoraLoader|pysssss')).toBe(true);
    expect(isSupportedLoraNodeClass('OtherNode')).toBe(false);
    expect(normalizeNodeClass('Lora Loader')).toBe('loraloader');
  });

  it('collects active rows from Power Lora Loader', () => {
    const node = buildPowerLoraLoaderNode();
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([
      { label: 'theta.safetensors', strength: 0.6, enabled: true },
      // disabled row should be ignored
    ]);
  });

  it('preserves tag selection when copying from LoadLorasWithTags', () => {
    const options = ['None', 'delta.safetensors'];
    const node = buildLoadLorasWithTagsNode(
      [{ name: 1, strength: 1.1, on: true, selection: '["tag_a","tag_b"]' }],
      options,
    );
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([
      {
        label: 'delta.safetensors',
        strength: 1.1,
        enabled: true,
        selection: '["tag_a","tag_b"]',
      },
    ]);
  });

  it('orders copy sources deterministically', () => {
    const nodes = [
      { comfyClass: 'LoraLoader', title: 'zeta', id: 5 },
      { comfyClass: 'Power Lora Loader (rgthree)', title: 'alpha', id: 2 },
      { comfyClass: 'LoraLoaderModelOnly', title: 'beta', id: 3 },
    ];
    const ordered = orderCopySources(nodes);
    expect(ordered.map((n) => n.title)).toEqual(['alpha', 'beta', 'zeta']);
  });

  it('sorts copy sources by title then class then id', () => {
    const nodes = [
      { comfyClass: 'B', title: 'same', id: 5 },
      { comfyClass: 'A', title: 'same', id: 1 },
    ];
    const ordered = orderCopySources(nodes);
    expect(ordered.map((n) => n.id)).toEqual([1, 5]);
  });

  it('handles unsupported node classes gracefully', () => {
    const entries = collectLoraEntriesFromNode({ comfyClass: 'UnknownNode' });
    expect(entries).toEqual([]);
    expect(isSupportedLoraNodeClass('UnknownNode')).toBe(false);
  });

  it('returns empty when sources are not an array', () => {
    expect(orderCopySources(null)).toEqual([]);
  });

  it('collects rows by pattern when power loader rows are absent', () => {
    const node = {
      comfyClass: 'Power Lora Loader (rgthree)',
      widgets: [
        { name: 'lora_1', value: 'eta.safetensors' },
        { name: 'strength_1', value: 0.3 },
        { name: 'on_1', value: true },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([{ label: 'eta.safetensors', strength: 0.3, enabled: true }]);
  });

  it('skips power loader rows with string off toggle', () => {
    const node = {
      comfyClass: 'Power Lora Loader (rgthree)',
      widgets: [
        { name: 'lora_1', value: { lora: 'lambda', strength: 0.4, on: 'off' } },
        { name: 'strength_1', value: 0.4 },
        { name: 'on_1', value: 'off' },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([]);
  });

  it('uses fallback strength when object lacks numeric fields', () => {
    const node = {
      comfyClass: 'Power Lora Loader (rgthree)',
      widgets: [{ name: 'lora_1', value: { lora: 'omega', enabled: true } }],
    };
    expect(collectLoraEntriesFromNode(node)).toEqual([{ label: 'omega', strength: 1, enabled: true }]);
  });

  it('preserves unknown option labels', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_1', value: 'custom', options: { values: ['alpha'] } },
        { name: 'strength_1', value: 0.4 },
        { name: 'on_1', value: true },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries[0].label).toBe('custom');
  });

  it('filters out disabled pattern rows', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_1', value: 'theta', options: { values: ['theta'] } },
        { name: 'strength_1', value: 0.5 },
        { name: 'on_1', value: false },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([]);
  });

  it('treats numeric toggles correctly', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_1', value: 'theta', options: { values: ['theta'] } },
        { name: 'strength_1', value: 0.5 },
        { name: 'on_1', value: 0 },
        { name: 'lora_2', value: 'eta', options: { values: ['eta'] } },
        { name: 'strength_2', value: 0.7 },
        { name: 'on_2', value: 2 },
        { name: 'lora_3', value: 'upsilon', options: { values: ['upsilon'] } },
        { name: 'strength_3', value: 0.9 },
        { name: 'on_3', value: 'maybe' },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([
      { label: 'eta', strength: 0.7, enabled: true },
      { label: 'upsilon', strength: 0.9, enabled: true },
    ]);
  });

  it('falls back to pattern rows when name widget is missing on LoraLoader', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_1', value: 'phi' },
        { name: 'strength_1', value: 0.9 },
        { name: 'on_1', value: true },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([{ label: 'phi', strength: 0.9, enabled: true }]);
  });

  it('skips pattern rows when label is None', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_1', value: 'None', options: { values: ['None'] } },
        { name: 'strength_1', value: 0.5 },
        { name: 'on_1', value: true },
      ],
    };
    expect(collectLoraEntriesFromNode(node)).toEqual([]);
  });

  it('returns empty when LoraLoader label is None', () => {
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        widget('lora_name', 'None'),
        widget('strength_model', 0.3),
      ],
    };
    expect(collectLoraEntriesFromNode(node)).toEqual([]);
  });

  it('returns empty when widgets are not an array', () => {
    expect(collectLoraEntriesFromNode({ comfyClass: 'LoraLoader', widgets: null })).toEqual([]);
  });

  it('ignores power loader entries missing lora names', () => {
    const node = {
      comfyClass: 'Power Lora Loader (rgthree)',
      widgets: [{ name: 'lora_1', value: { strength: 0.4, on: true } }],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([{ label: '[object Object]', strength: 1, enabled: true }]);
  });

  it('skips power loader rows with label None', () => {
    const node = {
      comfyClass: 'Power Lora Loader (rgthree)',
      widgets: [{ name: 'lora_1', value: { lora: 'None', strength: 0.4, on: true } }],
    };
    expect(collectLoraEntriesFromNode(node)).toEqual([
      { label: '[object Object]', strength: 1, enabled: true },
    ]);
  });

  it('returns empty when LoraLoaderModelOnly has empty label', () => {
    const node = {
      comfyClass: 'LoraLoaderModelOnly',
      widgets: [{ name: 'lora_name', value: 'None' }],
    };
    expect(collectLoraEntriesFromNode(node)).toEqual([]);
  });

  it('returns empty when LoraLoaderModelOnly is missing name widget', () => {
    expect(collectLoraEntriesFromNode({ comfyClass: 'LoraLoaderModelOnly', widgets: [] })).toEqual([]);
  });

  it('orders sources using id fallback when ids are missing', () => {
    const nodes = [
      { comfyClass: 'A', title: 'same' },
      { comfyClass: 'A', title: 'same', id: 5 },
    ];
    const ordered = orderCopySources(nodes);
    expect(ordered.map((n) => n.id ?? 0)).toEqual([0, 5]);
  });

  it('interprets truthy and falsy toggle values through isEnabled', () => {
    expect(isSupportedLoraNodeClass('loraloader')).toBe(true);
    const node = {
      comfyClass: 'LoraLoader',
      widgets: [
        { name: 'lora_name', value: 'iota' },
        { name: 'strength_model', value: 0 },
        { name: 'strength_clip', value: 0.2 },
        { name: 'lora_on_1', value: 'off' },
      ],
    };
    const entries = collectLoraEntriesFromNode(node);
    expect(entries).toEqual([
      { label: 'iota', strength: 0.2, enabled: true },
    ]);
  });
});
