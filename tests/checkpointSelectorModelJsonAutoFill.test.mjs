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
  await import('../web/checkpoint_selector/js/checkpointSelectorNode.js');
  return registerExtension.mock.calls[0][0];
};

const createNode = (modelJsonInput = null) => ({
  id: 1,
  comfyClass: 'CheckpointSelector',
  widgets: [
    {
      name: 'ckpt_name_1',
      value: 'ckptA.safetensors',
      options: { values: ['', 'ckptA.safetensors', 'ckptB.safetensors'] },
      callback: vi.fn(),
      computeSize: (width) => [width ?? 0, 20],
    },
    {
      name: 'slot_active_1',
      value: false,
      callback: vi.fn(),
      computeSize: (width) => [width ?? 0, 20],
    },
    {
      name: 'ckpt_name_2',
      value: 'ckptB.safetensors',
      options: { values: ['', 'ckptA.safetensors', 'ckptB.safetensors'] },
      callback: vi.fn(),
      computeSize: (width) => [width ?? 0, 20],
    },
    {
      name: 'slot_active_2',
      value: true,
      callback: vi.fn(),
      computeSize: (width) => [width ?? 0, 20],
    },
  ],
  inputs: [{ name: 'model_json', link: 1 }],
  addInput: vi.fn(function addInput(name, type) {
    this.inputs.push({ name, type, link: null });
  }),
  getInputData: vi.fn(() => modelJsonInput),
  size: [320, 220],
});

const getWidgetValue = (node, name) => node.widgets.find((widget) => widget.name === name)?.value;
const emitApiEvent = (name, detail) => {
  const handlers = apiEventListeners.get(name) ?? [];
  handlers.forEach((handler) => handler({ detail }));
};

describe('CheckpointSelector model_json auto fill', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
    appGraph.links = {};
  });

  it('onExecutedでmodel_json入力からチェックポイントを自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode('{"name":"ckptB.safetensors"}');

    extension.nodeCreated(node);
    node.onExecuted?.({});

    expect(getWidgetValue(node, 'ckpt_name_1')).toBe('ckptB.safetensors');
    expect(getWidgetValue(node, 'slot_active_1')).toBe(true);
    expect(getWidgetValue(node, 'ckpt_name_2')).toBe('');
    expect(getWidgetValue(node, 'slot_active_2')).toBe(false);
  });

  it('executedイベントのoutputからmodel_jsonを自動反映する', async () => {
    const extension = await loadExtension();
    const node = createNode(null);
    appGraph.links[1] = {
      origin_id: 999,
      origin_slot: 2,
      target_id: 1,
      target_slot: 0,
      data: undefined,
    };

    extension.nodeCreated(node);
    emitApiEvent('executed', {
      node: '999',
      output: {
        model_json: ['{"name":"ckptB.safetensors"}'],
      },
    });

    expect(getWidgetValue(node, 'ckpt_name_1')).toBe('ckptB.safetensors');
    expect(getWidgetValue(node, 'slot_active_1')).toBe(true);
    expect(getWidgetValue(node, 'ckpt_name_2')).toBe('');
    expect(getWidgetValue(node, 'slot_active_2')).toBe(false);
  });

  it('model_json入力が欠けているノードには入力ハンドルを補完する', async () => {
    const extension = await loadExtension();
    const node = createNode(null);
    node.inputs = [];

    extension.nodeCreated(node);

    expect(node.addInput).toHaveBeenCalledWith('model_json', 'STRING');
    expect(node.inputs.some((input) => input?.name === 'model_json')).toBe(true);
  });
});
