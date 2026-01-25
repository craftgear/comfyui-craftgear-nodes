import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE,
  DEFAULT_CHECKPOINT_FONT_SIZE,
  normalizeCheckpointPreviewZoomScale,
  normalizeCheckpointFontSize,
} from '../web/checkpoint_selector/js/checkpointSelectorSettings.js';

describe('normalizeCheckpointPreviewZoomScale', () => {
  it('returns default when value is invalid', () => {
    expect(normalizeCheckpointPreviewZoomScale('')).toBe(
      DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeCheckpointPreviewZoomScale('nope')).toBe(
      DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE,
    );
  });

  it('returns default when value is less than 1', () => {
    expect(normalizeCheckpointPreviewZoomScale(0)).toBe(
      DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE,
    );
    expect(normalizeCheckpointPreviewZoomScale(-1)).toBe(
      DEFAULT_CHECKPOINT_PREVIEW_ZOOM_SCALE,
    );
  });

  it('returns parsed value when valid', () => {
    expect(normalizeCheckpointPreviewZoomScale(1)).toBe(1);
    expect(normalizeCheckpointPreviewZoomScale(2.5)).toBe(2.5);
  });
});

describe('normalizeCheckpointFontSize', () => {
  it('returns default when value is invalid or non-positive', () => {
    expect(normalizeCheckpointFontSize(undefined)).toBe(
      DEFAULT_CHECKPOINT_FONT_SIZE,
    );
    expect(normalizeCheckpointFontSize(null)).toBe(
      DEFAULT_CHECKPOINT_FONT_SIZE,
    );
    expect(normalizeCheckpointFontSize('abc')).toBe(
      DEFAULT_CHECKPOINT_FONT_SIZE,
    );
    expect(normalizeCheckpointFontSize(0)).toBe(
      DEFAULT_CHECKPOINT_FONT_SIZE,
    );
    expect(normalizeCheckpointFontSize(-5)).toBe(
      DEFAULT_CHECKPOINT_FONT_SIZE,
    );
  });

  it('returns parsed value when valid', () => {
    expect(normalizeCheckpointFontSize(18)).toBe(18);
    expect(normalizeCheckpointFontSize('20')).toBe(20);
  });
});
