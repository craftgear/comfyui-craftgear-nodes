import sys
import types
import unittest

if 'folder_paths' not in sys.modules:
    stub = types.ModuleType('folder_paths')
    stub.get_filename_list = lambda *_args, **_kwargs: ['example.safetensors']
    stub.get_folder_paths = lambda *_args, **_kwargs: []
    stub.supported_pt_extensions = {'.safetensors'}
    stub.get_full_path = lambda *_args, **_kwargs: None
    sys.modules['folder_paths'] = stub

if 'comfy' not in sys.modules:
    comfy = types.ModuleType('comfy')
    sd = types.ModuleType('comfy.sd')
    sd.load_checkpoint_guess_config = lambda *_args, **_kwargs: (None, None, None)
    comfy.sd = sd
    sys.modules['comfy'] = comfy
    sys.modules['comfy.sd'] = sd

from checkpoint_selector.ui import node as checkpoint_selector_node


class CheckpointSelectorInputTypesTest(unittest.TestCase):
    def test_input_types_include_checkpoint_slots(self) -> None:
        inputs = checkpoint_selector_node.CheckpointSelector.INPUT_TYPES()
        required = inputs['required']
        self.assertEqual(required['ckpt_name_1'][0][0], 'None')
        self.assertIn('ckpt_name_1', required)
        self.assertIn('ckpt_name_20', required)
        hidden = inputs.get('hidden', {})
        self.assertEqual(hidden.get('unique_id'), 'UNIQUE_ID')
        self.assertEqual(hidden.get('extra_pnginfo'), 'EXTRA_PNGINFO')

    def test_output_types(self) -> None:
        self.assertEqual(
            checkpoint_selector_node.CheckpointSelector.RETURN_TYPES,
            ('MODEL', 'CLIP', 'VAE'),
        )
        self.assertEqual(
            checkpoint_selector_node.CheckpointSelector.RETURN_NAMES,
            ('model', 'clip', 'vae'),
        )


if __name__ == '__main__':
    unittest.main()
