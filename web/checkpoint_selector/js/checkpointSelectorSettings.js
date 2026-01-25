export const CHECKPOINT_PREVIEW_ZOOM_SCALE_SETTING_ID =
  'craftgear.checkpointSelector.previewZoomScale';
export const DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE = 2;

export const normalizeCheckpointPreviewZoomScale = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE;
  }
  return parsed;
};
