import { app } from '../../../../scripts/app.js';

import {
    FONT_SIZE_SETTING_ID,
    normalizeFontSize,
} from './commentableMultilineTextSettings.js';
import { isToggleShortcut, toggleLineComment } from './commentableMultilineTextUtils.js';

const TARGET_NODE_CLASS = 'CommentableMultilineTextNode';
const TEXT_WIDGET_NAME = 'text';

const getNodeClass = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeClass(node) === TARGET_NODE_CLASS;

const getTextWidget = (node) =>
    node?.widgets?.find((widget) => widget?.name === TEXT_WIDGET_NAME);

const getFontSize = () => {
    const value = app?.extensionManager?.setting?.get?.(FONT_SIZE_SETTING_ID);
    return normalizeFontSize(value);
};

const applyFontSize = (node) => {
    const widget = getTextWidget(node);
    if (!widget?.inputEl) {
        return;
    }
    const fontSize = getFontSize();
    widget.inputEl.style.fontSize = `${fontSize}px`;
};

const attachToggleShortcut = (node) => {
    const widget = getTextWidget(node);
    const inputEl = widget?.inputEl;
    if (!inputEl || widget.__commentableToggleReady) {
        return;
    }
    widget.__commentableToggleReady = true;
    inputEl.addEventListener('keydown', (event) => {
        if (!isToggleShortcut(event)) {
            return;
        }
        const selectionStart = inputEl.selectionStart ?? 0;
        const selectionEnd = inputEl.selectionEnd ?? 0;
        if (selectionStart !== selectionEnd) {
            return;
        }
        event.preventDefault();
        const { text, cursor } = toggleLineComment(String(inputEl.value ?? ''), selectionStart);
        inputEl.value = text;
        widget.value = text;
        if (typeof widget.callback === 'function') {
            widget.callback(text);
        }
        inputEl.selectionStart = cursor;
        inputEl.selectionEnd = cursor;
    });
};

app.registerExtension({
    name: 'craftgear.commentableMultilineText',
    nodeCreated: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        applyFontSize(node);
        attachToggleShortcut(node);
    },
    loadedGraphNode: (node) => {
        if (!isTargetNode(node)) {
            return;
        }
        applyFontSize(node);
        attachToggleShortcut(node);
    },
});
