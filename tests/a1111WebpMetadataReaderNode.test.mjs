import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerExtension = vi.fn();
const setDirtyCanvas = vi.fn();
const apiUrl = vi.fn((path) => `http://localhost${path}`);

vi.mock('../../../../scripts/app.js', () => ({
  app: {
    registerExtension,
    graph: {
      setDirtyCanvas,
    },
  },
}), { virtual: true });

vi.mock('../../../../scripts/api.js', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: apiUrl,
  },
}), { virtual: true });

const loadExtension = async () => {
  registerExtension.mockClear();
  vi.resetModules();
  await import('../web/a1111_webp_metadata_reader/js/a1111WebpMetadataReaderNode.js');
  return registerExtension.mock.calls[0][0];
};

const createNode = () => {
  const pathWidget = {
    name: 'image_path',
    value: '',
    callback: vi.fn((value) => {
      pathWidget.value = value;
    }),
    computeSize: (width) => [width ?? 0, 20],
  };
  const domWidgets = [];
  return {
    comfyClass: 'A1111WebpMetadataReader',
    widgets: [pathWidget],
    outputs: [
      { name: 'positive_prompt', type: '*' },
      { name: 'negative_prompt', type: '*' },
      { name: 'model', type: '*' },
      { name: 'loras', type: '*' },
      { name: 'steps', type: '*' },
      { name: 'sampler', type: '*' },
      { name: 'cfg_scale', type: '*' },
      { name: 'seed', type: '*' },
      { name: 'size', type: '*' },
      { name: 'clip_skip', type: '*' },
      { name: 'raw_parameters', type: '*' },
    ],
    domWidgets,
    size: [280, 120],
    computeSize: () => [280, 300],
    setSize: vi.fn(),
    setDirtyCanvas,
    addDOMWidget: vi.fn((name, type, element, options) => {
      const widget = {
        name,
        type,
        element,
        options,
        serialize: true,
        computeSize: (width) => [width ?? 0, options?.getHeight?.() ?? 0],
      };
      domWidgets.push(widget);
      return widget;
    }),
  };
};

describe('A1111WebpMetadataReader node', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
    apiUrl.mockClear();
    globalThis.document = {
      createElement: vi.fn(() => ({
        style: {},
        textContent: '',
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        removeAttribute(name) {
          delete this[name];
        },
      })),
    };
  });

  it('node作成時にプレビュー用DOM widgetを追加する', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);

    expect(node.addDOMWidget).toHaveBeenCalledTimes(1);
    expect(node.domWidgets).toHaveLength(1);
    expect(node.domWidgets[0].name).toBe('image_preview');
  });

  it('image_path callbackでプレビューURLが更新される', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);
    const previewImage = node.__a1111WebpPreview?.image;

    node.widgets[0].callback('input/sample.webp');

    expect(previewImage.src).toContain('/view?');
    expect(previewImage.src).toContain('filename=sample.webp');
    expect(previewImage.src).toContain('subfolder=input');
    expect(previewImage.src).toContain('type=input');
  });

  it('出力スロット型をRETURN_TYPESに同期する', async () => {
    const extension = await loadExtension();
    const node = createNode();
    extension.nodeCreated(node);

    expect(node.outputs.map((output) => output.type)).toEqual([
      'STRING',
      'STRING',
      'STRING',
      'STRING',
      'INT',
      'STRING',
      'FLOAT',
      'INT',
      'STRING',
      'INT',
      'STRING',
    ]);
  });
});
