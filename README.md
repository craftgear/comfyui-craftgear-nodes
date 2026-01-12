# craftgear nodes

Custom nodes for ComfyUI.

## Nodes

### Auto Lora Loader (craftgear/loras)

Selects a LoRA from the ComfyUI loras folder and returns its name, strength, and trigger words.

Inputs:
- lora_name: Dropdown of LoRA files
- lora_strength: Float, default 1.0, range -2.0 to 2.0
- trigger_selection: String, JSON list of selected triggers

Outputs:
- lora_name: String
- lora_strength: Float
- lora_triggers: List of strings

Behavior:
- If lora_name is None, returns an empty name and empty trigger list
- Reads safetensors metadata to extract trigger words
- Filters triggers by trigger_selection when provided

UI helpers:
- Trigger selection dialog
- Fuzzy filter for the lora_name dropdown

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

### image_batch_loader (craftgear/image)

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
2. Add the node named Auto Lora Loader, Camera Shake, or image_batch_loader.
3. Connect the inputs and adjust parameters as needed.

For image_batch_loader:

1. Click Select Directory to choose a folder.
2. Run the graph to get a batch of images.

## Camera Shake example

Text only example.

1. Add an image batch loader and connect it to Camera Shake.
2. Start with strength 0.8 to 1.2 for subtle motion.
3. Increase toward 2.0 to 3.0 for stronger motion.
4. If edges look off, try edge_mode 2_crop or 3_prepad.

## Project layout

- auto_lora_loader/logic: LoRA helpers
- auto_lora_loader/ui: Node and API code
- auto_lora_loader/tests: Unit tests
- image_batch_loader: Image batch loader node
- web/auto_lora_loader: Auto Lora Loader UI extensions
- web/image_batch_loader: Image batch loader UI extensions
- camera_shake: Camera shake node

## Tests

Python tests:

- python -m unittest discover -s auto_lora_loader/tests
- python -m unittest discover -s image_batch_loader/tests

Node script test:

- node auto_lora_loader/tests/loraFuzzyMatch.test.mjs
