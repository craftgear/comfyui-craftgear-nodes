import { app } from '../../../../scripts/app.js';

const TARGET_NODE_CLASS = 'JoinTextNode';
const INPUT_PREFIX = 'text_';
const SEPARATOR_WIDGET_NAME = 'separator';
const SEPARATOR_SPACER_NAME = '__joinTextSeparatorSpacer__';
const SEPARATOR_SPACER_HEIGHT = 4;

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;

const markDirty = (node) => {
    if (typeof node?.setDirtyCanvas === 'function') {
        node.setDirtyCanvas(true, true);
        return;
    }
    if (app?.graph?.setDirtyCanvas) {
        app.graph.setDirtyCanvas(true, true);
    }
};

const getTextInputs = (node) =>
    (node.inputs || []).filter((input) => input?.name?.startsWith(INPUT_PREFIX));

const addTextInput = (node, index) => {
    node.addInput(`${INPUT_PREFIX}${index}`, 'STRING');
};

const pruneTrailingInputs = (node) => {
    const textInputs = getTextInputs(node);
    for (let i = textInputs.length - 1; i >= 1; i -= 1) {
        const input = textInputs[i];
        if (input?.link != null) {
            break;
        }
        const inputIndex = node.inputs.indexOf(input);
        if (inputIndex >= 0) {
            node.removeInput(inputIndex);
        }
    }
};

const ensureTrailingInput = (node) => {
    const textInputs = getTextInputs(node);
    if (textInputs.length === 0) {
        addTextInput(node, 1);
        return;
    }
    const lastInput = textInputs[textInputs.length - 1];
    if (lastInput?.link != null) {
        addTextInput(node, textInputs.length + 1);
    }
};

const syncInputs = (node) => {
    pruneTrailingInputs(node);
    ensureTrailingInput(node);
    markDirty(node);
};

const createSpacerWidget = (height) => ({
    name: SEPARATOR_SPACER_NAME,
    height,
    computeSize: (width) => [width ?? 0, height],
});

// separator直前に擬似ウィジェットを挿入して入力ハンドルとの間に見た目の余白を作るため
const ensureSeparatorSpacer = (node, spacerHeight = SEPARATOR_SPACER_HEIGHT) => {
    const widgets = node?.widgets;
    if (!Array.isArray(widgets)) {
        return false;
    }
    let separatorIndex = widgets.findIndex((widget) => widget?.name === SEPARATOR_WIDGET_NAME);
    if (separatorIndex < 0) {
        return false;
    }

    const spacerIndex = widgets.findIndex((widget) => widget?.name === SEPARATOR_SPACER_NAME);
    const spacer = spacerIndex >= 0 ? widgets[spacerIndex] : createSpacerWidget(spacerHeight);
    spacer.height = spacerHeight;
    spacer.computeSize = (width) => [width ?? 0, spacerHeight];

    const alreadyPlaced = spacerIndex >= 0 && spacerIndex === separatorIndex - 1 && spacer.height === spacerHeight;
    if (alreadyPlaced) {
        return false;
    }

    if (spacerIndex >= 0) {
        widgets.splice(spacerIndex, 1);
        if (spacerIndex < separatorIndex) {
            separatorIndex -= 1;
        }
    }

    widgets.splice(separatorIndex, 0, spacer);
    markDirty(node);
    return true;
};

const attachDynamicInputs = (node) => {
    if (node.__joinTextNodeDynamicInputs) {
        return;
    }
    const original = node.onConnectionsChange;
    node.onConnectionsChange = (...args) => {
        const result = original?.apply(node, args);
        syncInputs(node);
        return result;
    };
    node.__joinTextNodeDynamicInputs = true;
    syncInputs(node);
};

const decorateSeparatorSpacing = (node) => {
    if (node.__joinTextSeparatorDecorated) {
        return;
    }
    node.__joinTextSeparatorDecorated = true;
    ensureSeparatorSpacer(node);
};

app.registerExtension({
    name: 'craftgear.joinTextNode',
    nodeCreated: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        attachDynamicInputs(node);
        decorateSeparatorSpacing(node);
    },
    loadedGraphNode: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        attachDynamicInputs(node);
        decorateSeparatorSpacing(node);
    },
});

export { ensureSeparatorSpacer, SEPARATOR_SPACER_HEIGHT, SEPARATOR_SPACER_NAME };
