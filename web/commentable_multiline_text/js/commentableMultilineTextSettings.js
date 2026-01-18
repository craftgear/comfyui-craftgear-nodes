export const FONT_SIZE_SETTING_ID = 'craftgear.commentableMultilineText.fontSize';
export const DEFAULT_FONT_SIZE = 16;

export const normalizeFontSize = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_FONT_SIZE;
    }
    return parsed;
};
