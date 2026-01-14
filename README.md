# craftgear nodes

Custom nodes for ComfyUI.

Node summary:
- Load LoRAs With Tags: Apply multiple LoRAs and return selected tags
- Camera Shake: Add smooth handheld motion to image batches
- Commentable Multiline Text: Remove comment lines and join text
- Join Texts: Join multiple text inputs into one line
- Image Batch Loader: Load a directory of images into a batch

## Nodes

### Load LoRAs With Tags (craftgear/loras)

Selects LoRAs from the ComfyUI loras folder, applies them to model and clip, and returns selected tags.

Inputs:
- model: Model
- clip: CLIP
- lora_name: Dropdown of LoRA files
- lora_strength: Float, default 1.0, range -2.0 to 2.0
- lora_on: Boolean, default true
- tag_selection: String, JSON list of selected tags

Outputs:
- model: Model
- clip: CLIP
- tags: Comma-separated string

Behavior:
- If lora_name is None, returns the input model and clip and an empty string
- If lora_strength is 0, returns the input model and clip and the selected tag string
- Reads safetensors metadata to extract tags
- Filters tags by tag_selection when provided

### Camera Shake (craftgear/image)

Adds a smooth handheld camera shake to an image batch.

Inputs:
- images: Image batch
- strength: Float, default 1.0, range 0.0 to 3.0
- edge_mode: Dropdown
  - 1_scale: Scales up to reduce empty edges
  - 2_crop: Crops then resizes back to the original size
  - 3_prepad: Pads before shaking, then crops back

Outputs:
- images: Image batch

Behavior:
- Uses smooth random motion over time
- Auto detects orientation and applies the same coefficients as the original script
  - Landscape: rotation 0.4 degrees, move X 10, move Y 6
  - Portrait: rotation 0.6 degrees, move X 6, move Y 10
- edge_mode controls how empty edges are handled
  - 1_scale scales slightly to keep size
  - 2_crop crops then resizes
  - 3_prepad pads with edge colors before shaking and crops back
- Recommended use
  - 1_scale: Use when you want to avoid any border artifacts with minimal setup
  - 2_crop: Use when you prefer strict framing and do not mind a small resample
  - 3_prepad: Use when you want to keep framing while avoiding black edges

### Commentable Multiline Text (craftgear/text)

Turns a multiline text input into a single line string.

Inputs:
- text: Multiline string
- separator: String, default ","

Outputs:
- text: String

Behavior:
- Lines starting with # or // are removed, leading whitespace is ignored
- Leading and trailing whitespace is trimmed
- Empty lines are kept
- The remaining lines are joined by separator
- If separator is empty after trimming, lines are joined with ","

### Join Texts (craftgear/text)

Joins multiple text inputs into a single line string.

Inputs:
- text_1: Text input, socket only
- separator: String, default ","
- Additional text inputs appear when the last input is connected

Outputs:
- text: String

Behavior:
- Empty lines and empty strings are removed
- Remaining lines are joined by separator
- When the last connected input is disconnected, the trailing empty input is removed

### Image Batch Loader (craftgear/image)

Loads every image file in a directory and returns a batch.

Inputs:
- directory: String path
- filter: Regex for partial filename match (case-insensitive)

Outputs:
- batch: IMAGE batch

Behavior:
- Uses the OS directory dialog button to set the path
- Reads only the top-level directory
- Loads files in name order
- Supports png, jpg, jpeg, webp
- Skips files that cannot be read
- Applies the filter to filenames when provided
- Empty or invalid regex means no filtering
- Batch includes only images that match the first loaded image size
- Returns an empty batch when nothing is loaded

## Install

Place this folder under your ComfyUI custom nodes directory.

Example path:
- /path/to/ComfyUI/custom_nodes/comfyui-craftgear-nodes

## Usage

1. Start ComfyUI or restart it if it is already running.
2. Add the node named Load LoRAs With Tags, Camera Shake, or Image Batch Loader.
3. Connect the inputs and adjust parameters as needed.

For Image Batch Loader:

1. Click Select Directory to choose a folder.
2. Run the graph to get a batch of images.

## Camera Shake example

Text only example.

1. Add an image batch loader and connect it to Camera Shake.
2. Start with strength 0.8 to 1.2 for subtle motion.
3. Increase toward 2.0 to 3.0 for stronger motion.
4. If edges look off, try edge_mode 2_crop or 3_prepad.

## Project layout

- load_loras_with_tags: Load LoRAs With Tags node
- image_batch_loader: Image batch loader node
- web/loadLorasWithTags: Load LoRAs With Tags UI extensions
- web/image_batch_loader: Image batch loader UI extensions
- camera_shake: Camera shake node
- camera_shake/tests: Camera shake tests
- join_text_node: Join text node
- join_text_node/tests: Join text tests

## Tests

Python tests:

- python -m unittest discover -s load_loras_with_tags/tests
- python -m unittest discover -s image_batch_loader/tests
- python -m unittest discover -s camera_shake/tests
- python -m unittest discover -s join_text_node/tests
- python -m unittest discover -s commentable_multiline_text/tests

Node script test:

- node load_loras_with_tags/tests/loadLorasWithTagsUiUtils.test.mjs
