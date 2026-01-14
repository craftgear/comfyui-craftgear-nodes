import sys
import types
import unittest

if 'folder_paths' not in sys.modules:
    stub = types.ModuleType('folder_paths')
    stub.get_folder_paths = lambda *_args, **_kwargs: []
    stub.supported_pt_extensions = {'.safetensors'}
    stub.get_full_path = lambda *_args, **_kwargs: None
    sys.modules['folder_paths'] = stub

if 'comfy' not in sys.modules:
    comfy = types.ModuleType('comfy')
    utils = types.ModuleType('comfy.utils')
    sd = types.ModuleType('comfy.sd')
    utils.load_torch_file = lambda *_args, **_kwargs: {}
    sd.load_lora_for_models = lambda model, clip, *_args, **_kwargs: (model, clip)
    comfy.utils = utils
    comfy.sd = sd
    sys.modules['comfy'] = comfy
    sys.modules['comfy.utils'] = utils
    sys.modules['comfy.sd'] = sd

from load_lora_with_triggers.ui.nodes import load_lora_with_triggers_stack as ui_node


class LoadLoraWithTriggersStackInputTypesTest(unittest.TestCase):
    def test_input_types_include_stack_slots(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.LoadLoraWithTriggersStack.INPUT_TYPES()
            required = inputs['required']

            self.assertEqual(required['model'][0], 'MODEL')
            self.assertEqual(required['clip'][0], 'CLIP')

            lora_keys = [key for key in required.keys() if key.startswith('lora_name_')]
            strength_keys = [key for key in required.keys() if key.startswith('lora_strength_')]
            selection_keys = [key for key in required.keys() if key.startswith('trigger_selection_')]
            toggle_keys = [key for key in required.keys() if key.startswith('lora_on_')]

            self.assertEqual(len(lora_keys), ui_node.MAX_LORA_STACK)
            self.assertEqual(len(strength_keys), ui_node.MAX_LORA_STACK)
            self.assertEqual(len(selection_keys), ui_node.MAX_LORA_STACK)
            self.assertEqual(len(toggle_keys), ui_node.MAX_LORA_STACK)

            self.assertIn('lora_name_1', required)
            self.assertIn(f'lora_name_{ui_node.MAX_LORA_STACK}', required)
        finally:
            ui_node.collect_lora_names = original_collect
            ui_node.folder_paths.get_folder_paths = original_get_paths
            ui_node.folder_paths.supported_pt_extensions = original_supported


if __name__ == '__main__':
    unittest.main()
