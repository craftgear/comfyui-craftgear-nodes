import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerExtension = vi.fn();
const setDirtyCanvas = vi.fn();

vi.mock('../../../../scripts/app.js', () => ({
  app: {
    registerExtension,
    graph: {
      setDirtyCanvas,
    },
  },
}), { virtual: true });

vi.mock('../../../../scripts/ui.js', () => ({
  $el: (tag = 'div', props = {}) => {
    const el = document.createElement(tag);
    if (props?.style) {
      Object.assign(el.style, props.style);
    }
    if (props?.innerText) {
      el.innerText = props.innerText;
    }
    return el;
  },
}), { virtual: true });

const getWidget = (node, name) => node.widgets.find((w) => w.name === name);

const createNode = () => {
  const buildCombo = (name) => ({
    name,
    value: '',
    options: { values: ['', 'modelA', 'modelB'] },
    computeSize: (width) => [width ?? 0, 20],
  });
  const buildToggle = (name) => ({
    name,
    value: false,
    computeSize: (width) => [width ?? 0, 20],
  });
  return {
    comfyClass: 'CheckpointSelector',
    size: [240, 120],
    widgets: [
      buildCombo('ckpt_name_1'),
      buildToggle('slot_active_1'),
      buildCombo('ckpt_name_2'),
      buildToggle('slot_active_2'),
    ],
  };
};

const loadExtension = async () => {
  registerExtension.mockClear();
  vi.resetModules();
  await import('../web/checkpoint_selector/js/checkpointSelectorNode.js');
  return registerExtension.mock.calls[0][0];
};

describe('CheckpointSelector persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes string values so reload keeps selection', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);

    getWidget(node, 'ckpt_name_1').value = 'modelA';
    getWidget(node, 'slot_active_1').value = true;

    const data = {};
    node.onSerialize(data);

    expect(data.widgets_values).toEqual(['modelA', true, '', false]);
  });

  it('restores numeric saved values with empty option offset', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);

    node.onConfigure({ widgets_values: [1, true, 0, false] });

    expect(getWidget(node, 'ckpt_name_1').value).toBe('modelB');
    expect(getWidget(node, 'slot_active_1').value).toBe(true);
    expect(getWidget(node, 'ckpt_name_2').value).toBe('modelA');
    expect(getWidget(node, 'slot_active_2').value).toBe(false);
  });

  it('restores empty selection as empty string', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);

    node.onConfigure({ widgets_values: ['', false, '', false] });

    expect(getWidget(node, 'ckpt_name_1').value).toBe('');
    expect(getWidget(node, 'slot_active_1').value).toBe(false);
  });
});
