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

  it('collects enabled slots from LoadLorasWithTags in order', () => {
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
});
