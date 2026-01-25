const normalizeKey = (event) => {
    if (!event || event.key == null) {
        return '';
    }
    return String(event.key).toLowerCase();
};

const isToggleShortcut = (event) => {
    if (!event) {
        return false;
    }
    const key = normalizeKey(event);
    if (key !== 'c') {
        return false;
    }
    if (event.altKey || event.shiftKey) {
        return false;
    }
    return Boolean(event.ctrlKey || event.metaKey);
};

const clampCursor = (text, cursor) => {
    if (!Number.isFinite(cursor)) {
        return 0;
    }
    const clamped = Math.max(0, Math.min(text.length, Math.trunc(cursor)));
    return clamped;
};

const getLineBounds = (text, cursor) => {
    const previousBreak = text.lastIndexOf('\n', Math.max(0, cursor - 1));
    const start = previousBreak === -1 ? 0 : previousBreak + 1;
    const nextBreak = text.indexOf('\n', cursor);
    const end = nextBreak === -1 ? text.length : nextBreak;
    return { start, end };
};

const toggleLineComment = (value, cursor) => {
    const text = String(value ?? '');
    const safeCursor = clampCursor(text, cursor);
    const { start, end } = getLineBounds(text, safeCursor);
    const line = text.slice(start, end);
    const indentMatch = line.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const content = line.slice(indent.length);

    const isSlashComment = content.startsWith('//');
    const isHashComment = !isSlashComment && content.startsWith('#');

    if (isSlashComment || isHashComment) {
        const prefix = isSlashComment ? '//' : '#';
        let removalLength = prefix.length;
        if (content.slice(removalLength, removalLength + 1) === ' ') {
            removalLength += 1;
        }
        const removeIndex = start + indent.length;
        const removeEnd = removeIndex + removalLength;
        let nextCursor = safeCursor;
        if (safeCursor > removeIndex && safeCursor <= removeEnd) {
            nextCursor = removeIndex;
        } else if (safeCursor > removeEnd) {
            nextCursor = safeCursor - removalLength;
        }
        const nextLine = indent + content.slice(removalLength);
        const nextText = text.slice(0, start) + nextLine + text.slice(end);
        return { text: nextText, cursor: nextCursor };
    }

    const prefix = '# ';
    const insertIndex = start + indent.length;
    const nextLine = indent + prefix + content;
    const nextText = text.slice(0, start) + nextLine + text.slice(end);
    const nextCursor = safeCursor < insertIndex ? safeCursor : safeCursor + prefix.length;
    return { text: nextText, cursor: nextCursor };
};

export { isToggleShortcut, toggleLineComment };
