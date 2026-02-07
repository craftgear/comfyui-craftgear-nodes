import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerExtension = vi.fn();
const setDirtyCanvas = vi.fn();
const apiUrl = vi.fn((path) => `http://localhost${path}`);
const fetchApi = vi.fn();
const dispatchEvent = vi.fn();

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
    fetchApi,
    dispatchEvent,
    apiURL: apiUrl,
  },
}), { virtual: true });

const loadExtension = async () => {
  registerExtension.mockClear();
  vi.resetModules();
  await import('../web/a1111_webp_metadata_reader/js/a1111WebpMetadataReaderNode.js');
  return registerExtension.mock.calls[0][0];
};

const waitForCondition = async (condition, timeoutMs = 200) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start >= timeoutMs) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const createNode = () => {
  const inputListeners = new Map();
  const inputEl = {
    value: '',
    addEventListener: vi.fn((name, handler) => {
      inputListeners.set(name, handler);
    }),
  };
  const pathWidget = {
    name: 'image_path',
    value: '',
    inputEl,
    callback: vi.fn((value) => {
      pathWidget.value = value;
      inputEl.value = value;
    }),
    computeSize: (width) => [width ?? 0, 20],
  };
  const domWidgets = [];
  return {
    id: 5,
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
    __testInputListeners: inputListeners,
  };
};

describe('A1111WebpMetadataReader node', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
    apiUrl.mockClear();
    fetchApi.mockReset();
    dispatchEvent.mockReset();
    globalThis.document = {
      createElement: vi.fn(() => {
        const listeners = new Map();
        return {
          style: {},
          textContent: '',
          children: [],
          __listeners: listeners,
          appendChild(child) {
            this.children.push(child);
          },
          removeAttribute(name) {
            delete this[name];
          },
          addEventListener(name, handler) {
            listeners.set(name, handler);
          },
        };
      }),
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
    fetchApi.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_json: '{"name":"model"}',
        loras_json: '[{"name":"foo"}]',
      }),
    });
    extension.nodeCreated(node);
    dispatchEvent.mockClear();
    const previewImage = node.__a1111WebpPreview?.image;

    node.widgets[0].callback('input/sample.webp');
    await waitForCondition(() => dispatchEvent.mock.calls.length === 1);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    expect(previewImage.src).toContain('/view?');
    expect(previewImage.src).toContain('filename=sample.webp');
    expect(previewImage.src).toContain('subfolder=input');
    expect(previewImage.src).toContain('type=input');
    expect(fetchApi).toHaveBeenCalledWith(
      '/my_custom_node/a1111_reader_metadata',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const event = dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('executed');
    expect(event.detail).toEqual({
      node: '5',
      output: {
        model_json: ['{"name":"model"}'],
        loras_json: ['[{"name":"foo"}]'],
      },
    });
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

  it('image_path入力でEnter押下時にメタデータ同期イベントを発火する', async () => {
    const extension = await loadExtension();
    const node = createNode();
    fetchApi.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_json: '{"name":"model-enter"}',
        loras_json: '[{"name":"foo-enter"}]',
      }),
    });
    extension.nodeCreated(node);
    dispatchEvent.mockClear();

    const keydown = node.__testInputListeners.get('keydown');
    expect(typeof keydown).toBe('function');

    node.widgets[0].inputEl.value = 'input/enter.webp';
    keydown({
      key: 'Enter',
      isComposing: false,
    });
    await waitForCondition(() => dispatchEvent.mock.calls.length === 1);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('executed');
    expect(event.detail.output).toEqual({
      model_json: ['{"name":"model-enter"}'],
      loras_json: ['[{"name":"foo-enter"}]'],
    });
  });

  it('プレビュー画像のload時にもメタデータ同期イベントを発火する', async () => {
    const extension = await loadExtension();
    const node = createNode();
    fetchApi.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_json: '{"name":"model-load"}',
        loras_json: '[{"name":"foo-load"}]',
      }),
    });
    extension.nodeCreated(node);
    dispatchEvent.mockClear();

    node.widgets[0].value = 'input/load.webp';
    const previewImage = node.__a1111WebpPreview?.image;
    expect(typeof previewImage?.onload).toBe('function');

    previewImage.onload();
    await waitForCondition(() => dispatchEvent.mock.calls.length === 1);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('executed');
    expect(event.detail.output).toEqual({
      model_json: ['{"name":"model-load"}'],
      loras_json: ['[{"name":"foo-load"}]'],
    });
  });

  it('プレビュー領域へのドロップでimage_pathを更新する', async () => {
    const extension = await loadExtension();
    const node = createNode();
    fetchApi.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_json: '{"name":"model-drop"}',
        loras_json: '[]',
      }),
    });
    extension.nodeCreated(node);

    const previewContainer = node.__a1111WebpPreview?.container;
    const dragOver = previewContainer?.__listeners?.get('dragover');
    const drop = previewContainer?.__listeners?.get('drop');
    expect(typeof dragOver).toBe('function');
    expect(typeof drop).toBe('function');

    const dragOverPreventDefault = vi.fn();
    const dragOverStopPropagation = vi.fn();
    const dataTransfer = { dropEffect: '' };
    dragOver({
      preventDefault: dragOverPreventDefault,
      stopPropagation: dragOverStopPropagation,
      dataTransfer,
    });
    expect(dragOverPreventDefault).toHaveBeenCalledTimes(1);
    expect(dragOverStopPropagation).toHaveBeenCalledTimes(1);
    expect(dataTransfer.dropEffect).toBe('copy');

    const dropPreventDefault = vi.fn();
    const dropStopPropagation = vi.fn();
    drop({
      preventDefault: dropPreventDefault,
      stopPropagation: dropStopPropagation,
      dataTransfer: {
        files: [],
        getData: (type) => (type === 'text/plain' ? 'input/drop.png' : ''),
      },
    });
    await waitForCondition(() => node.widgets[0].value === 'input/drop.png');

    expect(node.widgets[0].value).toBe('input/drop.png');
    expect(dropPreventDefault).toHaveBeenCalledTimes(1);
    expect(dropStopPropagation).toHaveBeenCalledTimes(1);
  });
});
