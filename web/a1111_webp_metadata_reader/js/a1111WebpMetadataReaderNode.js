import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';
import {
    applyWidgetValue,
    buildInputPreviewPayload,
    isSupportedImagePath,
    normalizeDroppedPath,
    wrapWidgetCallback,
} from './a1111WebpMetadataReaderUtils.js';

const TARGET_NODE_CLASS = 'A1111WebpMetadataReader';
const PATH_WIDGET_NAME = 'image_path';
const PATH_WIDGET_WRAP_KEY = '__a1111WebpPathWidgetWrapped';
const PREVIEW_WIDGET_NAME = 'image_preview';
const PREVIEW_WIDGET_HEIGHT = 220;

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);

const markDirty = (node) => {
    if (typeof node?.setDirtyCanvas === 'function') {
        node.setDirtyCanvas(true, true);
        return;
    }
    if (app?.graph?.setDirtyCanvas) {
        app.graph.setDirtyCanvas(true, true);
    }
};

const setPathWidget = (node, value) => {
    const widget = getWidget(node, PATH_WIDGET_NAME);
    applyWidgetValue(widget, value);
};

const resolveDroppedPath = (file) => {
    if (!file) {
        return '';
    }
    const fullPath = typeof file.path === 'string' ? file.path.trim() : '';
    if (fullPath) {
        return fullPath;
    }
    return String(file.name || '').trim();
};

const getDroppedFile = (event) => {
    const files = event?.dataTransfer?.files;
    if (!files || files.length === 0) {
        return null;
    }
    for (const file of files) {
        const lower = String(file?.name || '').toLowerCase();
        if (lower.endsWith('.webp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
            return file;
        }
    }
    return files[0] || null;
};

const getDroppedPathFromText = (event) => {
    const dataTransfer = event?.dataTransfer;
    if (!dataTransfer || typeof dataTransfer.getData !== 'function') {
        return '';
    }
    const uriList = normalizeDroppedPath(dataTransfer.getData('text/uri-list'));
    if (isSupportedImagePath(uriList)) {
        return uriList;
    }
    const plainText = normalizeDroppedPath(dataTransfer.getData('text/plain'));
    if (isSupportedImagePath(plainText)) {
        return plainText;
    }
    return '';
};

const uploadDroppedFile = async (file) => {
    if (!file) {
        return '';
    }
    const formData = new FormData();
    formData.append('image', file, file.name || 'upload.webp');
    formData.append('type', 'input');
    const response = await api.fetchApi('/upload/image', {
        method: 'POST',
        body: formData,
    });
    if (!response?.ok) {
        return '';
    }
    const data = await response.json();
    if (!data || typeof data.name !== 'string') {
        return '';
    }
    const subfolder = typeof data.subfolder === 'string' ? data.subfolder.trim() : '';
    if (!subfolder) {
        return data.name;
    }
    return `${subfolder}/${data.name}`;
};

const createPreviewDom = () => {
    if (typeof document?.createElement !== 'function') {
        return null;
    }

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = `${PREVIEW_WIDGET_HEIGHT - 8}px`;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = '#1f1f1f';
    container.style.border = '1px solid #3a3a3a';
    container.style.borderRadius = '6px';
    container.style.overflow = 'hidden';

    const image = document.createElement('img');
    image.style.maxWidth = '100%';
    image.style.maxHeight = '100%';
    image.style.objectFit = 'contain';
    image.style.display = 'none';

    const placeholder = document.createElement('div');
    placeholder.textContent = 'No preview';
    placeholder.style.color = '#8a8a8a';
    placeholder.style.fontSize = '12px';

    container.appendChild(image);
    container.appendChild(placeholder);
    return { container, image, placeholder };
};

const clearPreview = (preview) => {
    if (!preview) {
        return;
    }
    preview.image.removeAttribute?.('src');
    preview.image.style.display = 'none';
    preview.placeholder.style.display = 'block';
};

const resolvePreviewUrl = (imagePath) => {
    const payload = buildInputPreviewPayload(imagePath);
    if (!payload) {
        return '';
    }
    const query = new URLSearchParams(payload).toString();
    const path = `/view?${query}`;
    if (typeof api?.apiURL === 'function') {
        return api.apiURL(path);
    }
    return path;
};

const setPreviewFromPath = (node, imagePath) => {
    const preview = ensurePreviewWidget(node);
    if (!preview) {
        return;
    }
    const src = resolvePreviewUrl(imagePath);
    if (!src) {
        clearPreview(preview);
        return;
    }
    preview.image.src = src;
    preview.image.style.display = 'block';
    preview.placeholder.style.display = 'none';
};

const resizeNodeToContent = (node) => {
    const nextSize = node?.computeSize?.();
    if (!Array.isArray(nextSize) || nextSize.length < 2) {
        return;
    }
    if (typeof node?.setSize === 'function') {
        node.setSize(nextSize);
    } else {
        node.size = nextSize;
    }
};

const ensurePreviewWidget = (node) => {
    if (node.__a1111WebpPreview) {
        return node.__a1111WebpPreview;
    }
    if (typeof node?.addDOMWidget !== 'function') {
        return null;
    }
    const dom = createPreviewDom();
    if (!dom) {
        return null;
    }
    const widget = node.addDOMWidget(PREVIEW_WIDGET_NAME, 'a1111_webp_preview', dom.container, {
        getHeight: () => PREVIEW_WIDGET_HEIGHT,
        getMinHeight: () => PREVIEW_WIDGET_HEIGHT,
        getMaxHeight: () => PREVIEW_WIDGET_HEIGHT,
        hideOnZoom: true,
    });
    widget.serialize = false;
    widget.computeSize = (width) => [width ?? 0, PREVIEW_WIDGET_HEIGHT];
    node.__a1111WebpPreview = { ...dom, widget };
    resizeNodeToContent(node);
    return node.__a1111WebpPreview;
};

const attachPathWidgetSync = (node) => {
    const widget = getWidget(node, PATH_WIDGET_NAME);
    if (!widget) {
        return;
    }
    wrapWidgetCallback(widget, PATH_WIDGET_WRAP_KEY, (value) => {
        setPreviewFromPath(node, value);
        markDirty(node);
    });
};

const attachDropHandler = (node) => {
    if (node.__a1111WebpDropHandlerAttached) {
        return;
    }
    node.__a1111WebpDropHandlerAttached = true;

    const originalDragOver = node.onDragOver;
    node.onDragOver = function () {
        const originalResult = originalDragOver?.apply(this, arguments);
        if (originalResult === true) {
            return true;
        }
        return true;
    };

    const originalDragDrop = node.onDragDrop;
    node.onDragDrop = function (event) {
        const file = getDroppedFile(event);
        if (file) {
            setPathWidget(this, resolveDroppedPath(file));
            (async () => {
                try {
                    const uploadedPath = await uploadDroppedFile(file);
                    if (uploadedPath) {
                        setPathWidget(this, uploadedPath);
                    }
                } catch (_error) {
                    // アップロード失敗時でも入力済みパスを維持して作業を継続させる
                }
                markDirty(this);
            })();
            markDirty(this);
            return true;
        }

        const droppedPath = getDroppedPathFromText(event);
        if (droppedPath) {
            setPathWidget(this, droppedPath);
            markDirty(this);
            return true;
        }
        return originalDragDrop?.apply(this, arguments);
    };

    const originalDropFile = node.onDropFile;
    node.onDropFile = function (file) {
        if (!file) {
            return originalDropFile?.apply(this, arguments);
        }
        setPathWidget(this, resolveDroppedPath(file));
        markDirty(this);
        return true;
    };

    const originalDropData = node.onDropData;
    node.onDropData = function (data) {
        const droppedPath = normalizeDroppedPath(data);
        if (!isSupportedImagePath(droppedPath)) {
            return originalDropData?.apply(this, arguments);
        }
        setPathWidget(this, droppedPath);
        markDirty(this);
        return true;
    };
};

const setupNode = (node) => {
    ensurePreviewWidget(node);
    attachPathWidgetSync(node);
    attachDropHandler(node);
    const pathWidget = getWidget(node, PATH_WIDGET_NAME);
    setPreviewFromPath(node, pathWidget?.value);
};

app.registerExtension({
    name: 'craftgear.a1111WebpMetadataReader',
    nodeCreated(node) {
        if (!isTargetNode(node)) {
            return;
        }
        setupNode(node);
    },
    loadedGraphNode(node) {
        if (!isTargetNode(node)) {
            return;
        }
        setupNode(node);
    },
});
