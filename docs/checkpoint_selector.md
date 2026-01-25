# Checkpoint Selector

A lightweight node extension for switching Stable Diffusion checkpoints quickly.

## Features
- Up to 20 checkpoint slots, selectable with a single radio button (one active at a time).
- Inline preview for the selected checkpoint; hover to zoom.
- Search box for fast filtering.
- Keeps the original `ckpt_name_*` widgets hidden while providing a compact row UI.

## How to Use
1. Drop the node; one row appears by default (20 max). The underlying widgets stay hidden.
2. Click the radio to choose the active slot.
3. Click the label to open the selection dialog, filter with the search box, and click a row to apply.
4. If a preview image exists beside the checkpoint file, it shows on the right; hover to zoom when enabled.

## Settings
- `craftgear.checkpointSelector.fontSize` (default: 16)  
  Controls font size for the dialog and row labels.
- `craftgear.checkpointSelector.previewZoomScale` (default: 2)  
  Hover zoom magnification for the preview (minimum 1).

## Tips
- Arrow keys move selection in the dialog; Enter selects; Esc closes (IME input suppresses shortcuts).
- The active row is highlighted and drives the preview target.

## Limitations
- Preview falls back to “No preview” when no image is found alongside the checkpoint.
- Large checkpoint lists may take a moment to render.
