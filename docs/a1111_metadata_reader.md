# A1111 Metadata Reader

## Overview
This node reads A1111-style metadata text from image files and returns parsed fields as node outputs.  
The display name is **A1111 Metadata Reader** and the class is `A1111WebpMetadataReader`.

## Input
- `image_path` (`STRING`, required): Image path to read metadata from.

## Outputs
- `positive_prompt` (`STRING`)
- `negative_prompt` (`STRING`)
- `model json` (`STRING`)
- `loras json` (`STRING`)
- `steps` (`INT`)
- `sampler` (`STRING`)
- `cfg_scale` (`FLOAT`)
- `seed` (`INT`)
- `size` (`STRING`)
- `clip_skip` (`INT`)
- `raw_parameters` (`STRING`)

## Behavior
1) Resolve `image_path`:
- If the path exists as-is, use it.
- Otherwise, try under ComfyUI `input` directory (`folder_paths.get_input_directory()`), including basename fallback.
2) Read metadata text by format:
- `webp`: EXIF `UserComment` (EXIF chunk in RIFF).
- `png`: `parameters` / `Extparameters` style text chunks (`tEXt`, `zTXt`, `iTXt`) and Pillow info fallback.
- `jpg`/`jpeg`: EXIF `UserComment`.
3) Parse A1111 parameters into structured outputs.
- `model json` format: `{"name":"","hash":"","modelVersionId":""}`
- `loras json` format: `[{"name":"","hash":"","modelVersionId":""}]`

## UI Behavior
- The node provides an image preview area.
- Drag and drop supports `.webp`, `.png`, `.jpg`, `.jpeg`.
- Pressing Enter in the `image_path` input triggers preview/output sync.

## API (used by UI extension)
- Endpoint: `POST /my_custom_node/a1111_reader_metadata`
- Request: `{ "image_path": "<path>" }`
- Response: `{ "model_json": "...", "loras_json": "..." }`
- On invalid input or read failure, returns empty defaults.

## Notes
- If metadata is missing or parsing fails, outputs fall back to empty/default values.
- The node can parse A1111-style `Hashes`/`Lora hashes` and `Civitai resources` when present.
