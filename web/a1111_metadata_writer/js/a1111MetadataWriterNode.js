import { app } from '../../../../scripts/app.js';

const TARGET_NODE_CLASS = 'A1111MetadataWriter';
const OVERWRITE_NAME = 'overwrite';
const SUFFIX_NAME = 'suffix';

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;

const getWidget = (node, name) =>
    node?.widgets?.find((widget) => widget?.name === name);

const setSuffixDisabled = (node) => {
    const overwriteWidget = getWidget(node, OVERWRITE_NAME);
    const suffixWidget = getWidget(node, SUFFIX_NAME);
    if (!suffixWidget) {
        return;
    }
    const disabled = Boolean(overwriteWidget?.value);
    if (suffixWidget.inputEl) {
        suffixWidget.inputEl.disabled = disabled;
    }
    suffixWidget.disabled = disabled;
};

const wrapCallback = (widget, onChange) => {
    if (!widget || widget.__a1111MetadataWriterWrapped) {
        return;
    }
    const original = widget.callback;
    widget.callback = (value) => {
        const result = original?.(value);
        if (typeof onChange === 'function') {
            onChange(value);
        }
        return result;
    };
    widget.__a1111MetadataWriterWrapped = true;
};

const attach = (node) => {
    if (!isTargetNode(node)) {
        return;
    }
    const overwriteWidget = getWidget(node, OVERWRITE_NAME);
    wrapCallback(overwriteWidget, () => setSuffixDisabled(node));
    setSuffixDisabled(node);
};

app.registerExtension({
    name: 'craftgear.a1111MetadataWriter',
    nodeCreated: attach,
    loadedGraphNode: attach,
});
