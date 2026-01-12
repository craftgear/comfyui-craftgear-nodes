import { app } from '../../../../scripts/app.js';

const TARGET_NODE_CLASS = 'JoinTextNode';
const INPUT_PREFIX = 'text_';

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;

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
    app.graph.setDirtyCanvas(true, true);
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

app.registerExtension({
    name: 'craftgear.joinTextNode',
    nodeCreated: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        attachDynamicInputs(node);
    },
    loadedGraphNode: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        attachDynamicInputs(node);
    },
});
