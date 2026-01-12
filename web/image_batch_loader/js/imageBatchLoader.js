import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';

const TARGET_NODE_NAME = 'image_batch_loader';
const DIRECTORY_WIDGET_NAME = 'directory';

const getNodeName = (node) => node?.comfyClass || node?.type || '';
const normalizeNodeName = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizedTargetName = normalizeNodeName(TARGET_NODE_NAME);
const isTargetNode = (node) => normalizeNodeName(getNodeName(node)).includes(normalizedTargetName);
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);

const requestDirectory = async () => {
    const response = await api.fetchApi('/craftgear/select_directory', {
        method: 'POST',
    });
    if (!response.ok) {
        return '';
    }
    const data = await response.json();
    if (!data || typeof data.path !== 'string') {
        return '';
    }
    return data.path;
};

const attachButton = (node) => {
    if (node.__imageBatchDirectoryButtonAdded) {
        return;
    }

    node.addWidget('button', 'Select Directory', 'Pick', async () => {
        const selected = await requestDirectory();
        if (!selected) {
            return;
        }
        const widget = getWidget(node, DIRECTORY_WIDGET_NAME);
        if (!widget) {
            return;
        }
        widget.value = selected;
        app.graph.setDirtyCanvas(true, true);
    });

    node.__imageBatchDirectoryButtonAdded = true;
};

app.registerExtension({
    name: 'craftgear.imageBatchLoader',
    nodeCreated(node) {
        if (!isTargetNode(node)) {
            return;
        }
        attachButton(node);
    },
    loadedGraphNode(node) {
        if (!isTargetNode(node)) {
            return;
        }
        attachButton(node);
    },
});
