import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerExtension = vi.fn();
const setDirtyCanvas = vi.fn();
const apiEventListeners = new Map();
const appGraph = {
  setDirtyCanvas,
  links: {},
};

vi.mock('../../../../scripts/app.js', () => ({
  app: {
    registerExtension,
    graph: appGraph,
    extensionManager: {
      setting: {
        get: () => undefined,
      },
    },
  },
}), { virtual: true });

vi.mock('../../../../scripts/api.js', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn((name, handler) => {
      if (!apiEventListeners.has(name)) {
        apiEventListeners.set(name, []);
      }
      apiEventListeners.get(name).push(handler);
    }),
    removeEventListener: vi.fn((name, handler) => {
      if (!apiEventListeners.has(name)) {
        return;
      }
      const next = apiEventListeners.get(name).filter((entry) => entry !== handler);
      apiEventListeners.set(name, next);
    }),
  },
}), { virtual: true });

vi.mock('../../../../scripts/ui.js', () => ({
  $el: (_tag, _attrs, children) => ({
    style: {},
    append: vi.fn(),
    appendChild: vi.fn(),
    remove: vi.fn(),
    addEventListener: vi.fn(),
    children: children ?? [],
  }),
}), { virtual: true });

const loadExtension = async () => {
  registerExtension.mockClear();
  vi.resetModules();
  apiEventListeners.clear();
  await import('../web/loadLorasWithTags/js/loadLorasWithTagsNode.js');
  return registerExtension.mock.calls[0][0];
};

const createNode = (initialSlotValues = ['None', 'None'], lorasJsonInput = null) => {
  const options = ['None', 'foo.safetensors', 'bar.safetensors'];
  const widgets = [];
  for (let index = 1; index <= 2; index += 1) {
    const combo = {
      name: `lora_name_${index}`,
      value: initialSlotValues[index - 1] ?? 'None',
      options: { values: options },
      callback: vi.fn((next) => {
        combo.value = next;
      }),
      computeSize: (width) => [width ?? 0, 24],
    };
    const strength = {
      name: `lora_strength_${index}`,
      value: 1.0,
      options: { min: -2, max: 2, step: 0.1, default: 1.0 },
      callback: vi.fn((next) => {
        strength.value = next;
      }),
      computeSize: (width) => [width ?? 0, 24],
    };
    const toggle = {
      name: `lora_on_${index}`,
      value: true,
      callback: vi.fn((next) => {
        toggle.value = next;
      }),
      computeSize: (width) => [width ?? 0, 24],
    };
    const selection = {
      name: `tag_selection_${index}`,
      value: '',
      callback: vi.fn((next) => {
        selection.value = next;
      }),
      computeSize: (width) => [width ?? 0, 24],
    };
    widgets.push(combo, strength, toggle, selection);
  }
  return {
    comfyClass: 'LoadLorasWithTags',
    widgets,
    inputs: [{ name: 'loras_json', link: 1 }],
    getInputData: vi.fn(() => lorasJsonInput),
    size: [320, 220],
    computeSize: () => [320, 320],
    setSize: vi.fn(),
    setDirtyCanvas,
  };
};

const getWidgetValue = (node, name) => node.widgets.find((widget) => widget.name === name)?.value;
const emitApiEvent = (name, detail) => {
  const handlers = apiEventListeners.get(name) ?? [];
  handlers.forEach((handler) => handler({ detail }));
};

describe('LoadLorasWithTags node auto fill', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
    appGraph.links = {};
  });

  it('onExecutedでloras_json入力からLoRAスロットを自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], '[{"name":"foo"},{"name":"bar"}]');

    extension.nodeCreated(node);
    node.onExecuted?.({});

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('bar.safetensors');
  });

  it('onExecutedで配列内JSON文字列のloras_json入力を自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], ['[{"name":"foo"},{"name":"bar"}]']);

    extension.nodeCreated(node);
    node.onExecuted?.({});

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('bar.safetensors');
  });

  it('手動で埋まっているスロットがあっても自動反映で上書きする', async () => {
    const extension = await loadExtension();
    const node = createNode(['bar.safetensors', 'None'], '[{"name":"foo"}]');

    extension.nodeCreated(node);
    node.onExecuted?.({});

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('None');
  });

  it('executedイベントのoutputからloras_jsonを自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], null);
    appGraph.links[1] = {
      origin_id: 999,
      origin_slot: 3,
      target_id: 1,
      target_slot: 0,
      data: undefined,
    };

    extension.nodeCreated(node);
    emitApiEvent('executed', {
      node: '999',
      output: {
        loras_json: ['[{"name":"foo"},{"name":"bar"}]'],
      },
    });

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('bar.safetensors');
  });

  it('入力リンクIDが文字列でもexecutedイベントから自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], null);
    node.inputs[0].link = '1';
    appGraph.links['1'] = {
      origin_id: '999',
      origin_slot: 3,
      target_id: 1,
      target_slot: 0,
      data: undefined,
    };

    extension.nodeCreated(node);
    emitApiEvent('executed', {
      node: '999',
      output: {
        loras_json: ['[{"name":"foo"},{"name":"bar"}]'],
      },
    });

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('bar.safetensors');
  });

  it('loras_jsonが未接続でもtags入力のJSON接続から自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], null);
    node.inputs = [
      { name: 'model', link: null },
      { name: 'clip', link: null },
      { name: 'tags', link: 1 },
      { name: 'loras_json', link: null },
    ];
    appGraph.links[1] = {
      origin_id: 999,
      origin_slot: 3,
      target_id: 1,
      target_slot: 2,
      data: undefined,
    };

    extension.nodeCreated(node);
    emitApiEvent('executed', {
      node: '999',
      output: {
        loras_json: ['[{"name":"foo"},{"name":"bar"}]'],
      },
    });

    expect(getWidgetValue(node, 'lora_name_1')).toBe('foo.safetensors');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('bar.safetensors');
  });

  it('一致しないLoRA名でも生の名前をスロットへ反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(['None', 'None'], null);
    appGraph.links[1] = {
      origin_id: 999,
      origin_slot: 3,
      target_id: 1,
      target_slot: 0,
      data: undefined,
    };

    extension.nodeCreated(node);
    emitApiEvent('executed', {
      node: '999',
      output: {
        loras_json: ['[{"name":"unknown-lora-a"},{"name":"unknown-lora-b"}]'],
      },
    });

    expect(getWidgetValue(node, 'lora_name_1')).toBe('unknown-lora-a');
    expect(getWidgetValue(node, 'lora_name_2')).toBe('unknown-lora-b');
  });
});
