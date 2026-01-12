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

from load_lora_with_triggers.ui.nodes import load_lora_with_triggers as ui_node


class LoadLoraWithTriggersInputTypesTest(unittest.TestCase):
    def test_input_types_include_strength_slider(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.LoadLoraWithTriggers.INPUT_TYPES()
            required = inputs['required']
            strength = required['lora_strength']
            meta = strength[1]

            self.assertEqual(strength[0], 'FLOAT')
            self.assertEqual(meta['display'], 'slider')
            self.assertEqual(meta['min'], -2.0)
            self.assertEqual(meta['max'], 2.0)
            self.assertEqual(meta['step'], 0.1)
            self.assertEqual(meta['default'], 1.0)
        finally:
            ui_node.collect_lora_names = original_collect
            ui_node.folder_paths.get_folder_paths = original_get_paths
            ui_node.folder_paths.supported_pt_extensions = original_supported

    def test_output_types_include_trigger_strings(self) -> None:
        self.assertEqual(
            ui_node.LoadLoraWithTriggers.RETURN_TYPES,
            ('MODEL', 'CLIP', 'STRING'),
        )
        self.assertEqual(
            ui_node.LoadLoraWithTriggers.RETURN_NAMES,
            (
                'model',
                'clip',
                'selected triggers',
            ),
        )

    def test_input_types_include_trigger_selection(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.LoadLoraWithTriggers.INPUT_TYPES()
            required = inputs['required']
            trigger_selection = required['trigger_selection']
            meta = trigger_selection[1]

            self.assertEqual(trigger_selection[0], 'STRING')
            self.assertEqual(meta['default'], '')
        finally:
            ui_node.collect_lora_names = original_collect
            ui_node.folder_paths.get_folder_paths = original_get_paths
            ui_node.folder_paths.supported_pt_extensions = original_supported

    def test_input_types_include_model_and_clip(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.LoadLoraWithTriggers.INPUT_TYPES()
            required = inputs['required']

            self.assertEqual(required['model'][0], 'MODEL')
            self.assertEqual(required['clip'][0], 'CLIP')
        finally:
            ui_node.collect_lora_names = original_collect
            ui_node.folder_paths.get_folder_paths = original_get_paths
            ui_node.folder_paths.supported_pt_extensions = original_supported


if __name__ == '__main__':
    unittest.main()
