import { describe, expect, it } from 'vitest';

import {
  checkpointDialogOpenFolderIconPath,
  checkpointDialogOpenFolderIconSize,
  checkpointDialogSelectedIconPath,
  checkpointDialogSelectedIconSize,
  checkpointDialogHeight,
  checkpointDialogMaxWidth,
  checkpointDialogPreviewPadding,
  checkpointDialogPreviewWidth,
  checkpointDialogWidth,
  getCheckpointHighlightSegments,
  resolveZoomBackgroundPosition,
  resolveCheckpointDialogItemBackground,
} from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

describe('CheckpointSelector dialog highlight', () => {
  it('returns a single segment when query is empty', () => {
    expect(getCheckpointHighlightSegments('Alpha', '')).toEqual([
      { text: 'Alpha', isMatch: false },
    ]);
  });

  it('highlights substring matches case-insensitively', () => {
    expect(getCheckpointHighlightSegments('ModelA', 'model')).toEqual([
      { text: 'Model', isMatch: true },
      { text: 'A', isMatch: false },
    ]);
  });

  it('highlights multiple matches', () => {
    expect(getCheckpointHighlightSegments('alpha beta alpha', 'alpha')).toEqual([
      { text: 'alpha', isMatch: true },
      { text: ' beta ', isMatch: false },
      { text: 'alpha', isMatch: true },
    ]);
  });
});

describe('CheckpointSelector dialog row styling', () => {
  it('uses selected background for selected rows', () => {
    expect(resolveCheckpointDialogItemBackground(true, false)).toBe('#424242');
  });

  it('uses hover background for hovered rows', () => {
    expect(resolveCheckpointDialogItemBackground(false, true)).toBe('#2a2a2a');
  });

  it('uses transparent background by default', () => {
    expect(resolveCheckpointDialogItemBackground(false, false)).toBe('transparent');
  });
});

describe('CheckpointSelector dialog icons', () => {
  it('exposes the selected icon path and size', () => {
    expect(checkpointDialogSelectedIconPath).toBe(
      'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 12l2 2l4 -4',
    );
    expect(checkpointDialogSelectedIconSize).toBe(19.2);
  });

  it('exposes the open folder icon path and size', () => {
    expect(checkpointDialogOpenFolderIconPath).toBe(
      'M13.5 6a.5.5 0 0 0 .5-.5A1.5 1.5 0 0 0 12.5 4h-5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 5 2H1.5A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h11.1a1.49 1.49 0 0 0 1.42-1.03l1.77-5.32a.5.5 0 0 0-.474-.658h-10.8a.75.75 0 0 0-.712.513l-1.83 5.49h-.5a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h3.5l.9 1.2c.378.504.97.8 1.6.8h5c.276 0 .5.224.5.5s.224.5.5.5z',
    );
    expect(checkpointDialogOpenFolderIconSize).toBe(19.2);
  });
});

describe('CheckpointSelector dialog layout', () => {
  it('matches the load loras dialog sizing', () => {
    expect(checkpointDialogWidth).toBe('65vw');
    expect(checkpointDialogHeight).toBe('70vh');
    expect(checkpointDialogMaxWidth).toBe('90vw');
    expect(checkpointDialogPreviewWidth).toBe(360);
    expect(checkpointDialogPreviewPadding).toBe(0);
  });
});

describe('CheckpointSelector preview zoom', () => {
  it('centers the zoom on the cursor', () => {
    expect(
      resolveZoomBackgroundPosition(
        { x: 50, y: 50 },
        { width: 100, height: 100 },
        { width: 100, height: 100, offsetX: 0, offsetY: 0 },
        2,
      ),
    ).toEqual({ x: -50, y: -50 });
  });

  it('clamps the zoom to the top left', () => {
    expect(
      resolveZoomBackgroundPosition(
        { x: 0, y: 0 },
        { width: 100, height: 100 },
        { width: 100, height: 100, offsetX: 0, offsetY: 0 },
        2,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it('clamps the zoom to the bottom right', () => {
    expect(
      resolveZoomBackgroundPosition(
        { x: 100, y: 100 },
        { width: 100, height: 100 },
        { width: 100, height: 100, offsetX: 0, offsetY: 0 },
        2,
      ),
    ).toEqual({ x: -100, y: -100 });
  });
});
