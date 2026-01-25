import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDirtyCanvas = vi.fn();
const registerExtension = vi.fn();
vi.mock('../../../../scripts/app.js', () => ({
  app: {
    graph: {
      setDirtyCanvas,
    },
    registerExtension,
  },
}), { virtual: true });

const joinModule = await import('../web/join_text_node/js/joinTextNode.js');
const { ensureSeparatorSpacer } = joinModule;

const getExtension = () => registerExtension.mock.calls[0][0];

const buildNode = () => {
  const node = {
    comfyClass: 'JoinTextNode',
    inputs: [
      { name: 'text_1', link: null },
      { name: 'text_2', link: null },
    ],
    widgets: [{ name: 'separator', computeSize: (width) => [width ?? 0, 20] }],
    addInput: vi.fn(function addInput(name, _type) {
      this.inputs.push({ name, link: null });
    }),
    removeInput: vi.fn(function removeInput(index) {
      this.inputs.splice(index, 1);
    }),
    setDirtyCanvas,
    onConnectionsChange: vi.fn(),
  };
  return node;
};

describe('JoinTextNode dynamic inputs', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
  });

  it('prunes trailing empty inputs and keeps spacer decoration', () => {
    const node = buildNode();
    const ext = getExtension();
    ext.nodeCreated(node);
    expect(node.inputs.map((i) => i.name)).toEqual(['text_1']);
    expect(node.widgets[0].name).toBe('__joinTextSeparatorSpacer__');
    expect(setDirtyCanvas).toHaveBeenCalled();
  });

  it('adds a new input when the last input is linked after connection change', () => {
    const node = buildNode();
    const ext = getExtension();
    ext.nodeCreated(node);
    node.inputs[0].link = 42;
    node.onConnectionsChange();
    expect(node.inputs.map((i) => i.name)).toEqual(['text_1', 'text_2']);
    expect(node.addInput).toHaveBeenCalledWith('text_2', 'STRING');
  });

  it('handles loadedGraphNode similarly to nodeCreated', () => {
    const node = buildNode();
    const ext = getExtension();
    ext.loadedGraphNode(node);
    expect(node.inputs.map((i) => i.name)).toEqual(['text_1']);
    expect(node.widgets[0].name).toBe('__joinTextSeparatorSpacer__');
  });

  it('skips setup when already decorated or dynamic', () => {
    const node = buildNode();
    node.__joinTextSeparatorDecorated = true;
    node.__joinTextNodeDynamicInputs = true;
    const ext = getExtension();
    ext.nodeCreated(node);
    expect(node.addInput).not.toHaveBeenCalled();
    expect(node.widgets[0].name).toBe('separator');
  });

  it('ignores non-target nodes', () => {
    const node = { comfyClass: 'OtherNode', widgets: [] };
    const ext = getExtension();
    ext.nodeCreated(node);
    ext.loadedGraphNode(node);
    expect(node.widgets).toEqual([]);
  });

  it('adds initial input when none exist', () => {
    const node = {
      comfyClass: 'JoinTextNode',
      inputs: [],
      widgets: [{ name: 'separator', computeSize: (width) => [width ?? 0, 20] }],
      addInput: vi.fn(function addInput(name, _type) {
        this.inputs.push({ name, link: null });
      }),
      removeInput: vi.fn(),
      setDirtyCanvas,
      onConnectionsChange: vi.fn(),
    };
    const ext = getExtension();
    ext.nodeCreated(node);
    expect(node.addInput).toHaveBeenCalledWith('text_1', 'STRING');
  });

  it('stops pruning when a linked input is encountered', () => {
    const node = {
      comfyClass: 'JoinTextNode',
      inputs: [
        { name: 'text_1', link: null },
        { name: 'text_2', link: 99 },
      ],
      widgets: [{ name: 'separator', computeSize: (width) => [width ?? 0, 20] }],
      addInput: vi.fn(function addInput(name, _type) {
        this.inputs.push({ name, link: null });
      }),
      removeInput: vi.fn(function removeInput(index) {
        this.inputs.splice(index, 1);
      }),
      setDirtyCanvas,
      onConnectionsChange: vi.fn(),
    };
    const ext = getExtension();
    ext.nodeCreated(node);
    expect(node.removeInput).not.toHaveBeenCalled();
    expect(node.inputs.map((i) => i.name)).toContain('text_3');
  });

  it('returns false when spacer cannot be ensured without widgets', () => {
    expect(ensureSeparatorSpacer({ widgets: null })).toBe(false);
  });
});
