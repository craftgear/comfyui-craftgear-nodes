# A1111 Metadata Writer

## Overview
This node belongs to the **comfyui-craftgear-nodes** pack. It is intended to save prompts and tag data produced by sibling nodes such as **Load Loras With Tags**, **Commentable Multiline Text**, and **Toggle Tags** as A1111-compatible `parameters` in PNG/WebP outputs. Because `OUTPUT_NODE = True`, it runs even when its outputs are not connected.

## Inputs
- `image` (`IMAGE`, required): Target image to save.
- `overwrite` (`BOOLEAN`, default `False`):  
  - `True`: Tries to find the latest file that matches the `SaveImage` filename prefix and overwrites it. Creates a new file if none exist.  
  - `False`: Saves a new file using the `suffix`.
- `suffix` (`STRING`, default `_a1111`): Used when `overwrite` is `False`. Empty or truthy/falsey strings like `true/false/none` fall back to `_a1111`.
- `format` (toggle `png`/`webp`, default `png`): Output image format switch. Runtime normalization still falls back to `png` for unexpected values.
- Hidden `prompt` (`PROMPT`): Provided automatically by ComfyUI. If missing, the node aborts without saving.
- Hidden `extra_pnginfo` (`EXTRA_PNGINFO`): Additional metadata to embed. Keys `prompt` and `parameters` are skipped to avoid collisions.

## Outputs
- `parameters` (`STRING`): A1111-formatted prompt string.
- `path` (`STRING`): Absolute path of the saved file.

## Behavior
1) Parse `prompt` (KSampler, etc.) and build the A1111-style `parameters` string. If parsing fails, no file is saved.  
2) Decide the output path:  
   - Uses `folder_paths.get_output_directory()` as the base.  
   - When `overwrite=True`, picks the latest file with the same extension as `format`; otherwise builds a new filename with the `suffix`.
3) Write metadata by format:
   - `png`: Writes PNG text chunks `prompt`, `parameters`, and non-reserved `extra_pnginfo`.
   - `webp`: Writes only `parameters` into EXIF `UserComment` for A1111-style metadata compatibility.

## Usage
1) Place after an image-producing node; outputs may be left unconnected if you just need the side-effect save.  
2) Choose output `format` with the `png/webp` toggle.  
3) For overwriting, turn on `overwrite` and use the same filename prefix as your `SaveImage` node.  
4) For copying with a new name, keep `overwrite` off and adjust `suffix`.

## Notes
- If `prompt` is absent or cannot be parsed into parameters, the node returns empty strings and does not write a file.  
- When `overwrite=True`, the `suffix` input is disabled and ignored.  
- Any `prompt` or `parameters` keys inside `extra_pnginfo` are ignored to prevent duplication.
- For `webp` output, `prompt` and `extra_pnginfo` are not embedded; only `parameters` is written.
