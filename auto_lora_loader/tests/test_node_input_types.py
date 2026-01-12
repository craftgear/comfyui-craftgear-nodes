import unittest

from auto_lora_loader.ui.nodes import auto_lora_loader as ui_node


class AutoLoraLoaderInputTypesTest(unittest.TestCase):
    def test_input_types_include_strength_slider(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.AutoLoraLoader.INPUT_TYPES()
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

    def test_output_types_include_triggers(self) -> None:
        self.assertEqual(ui_node.AutoLoraLoader.RETURN_TYPES, ('STRING', 'FLOAT', 'LIST'))
        self.assertEqual(ui_node.AutoLoraLoader.RETURN_NAMES, ('lora_name', 'lora_strength', 'lora_triggers'))

    def test_input_types_include_trigger_selection(self) -> None:
        original_collect = ui_node.collect_lora_names
        original_get_paths = ui_node.folder_paths.get_folder_paths
        original_supported = ui_node.folder_paths.supported_pt_extensions

        try:
            ui_node.collect_lora_names = lambda *_args, **_kwargs: ['a.safetensors']
            ui_node.folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
            ui_node.folder_paths.supported_pt_extensions = {'.safetensors'}

            inputs = ui_node.AutoLoraLoader.INPUT_TYPES()
            required = inputs['required']
            trigger_selection = required['trigger_selection']
            meta = trigger_selection[1]

            self.assertEqual(trigger_selection[0], 'STRING')
            self.assertEqual(meta['default'], '')
        finally:
            ui_node.collect_lora_names = original_collect
            ui_node.folder_paths.get_folder_paths = original_get_paths
            ui_node.folder_paths.supported_pt_extensions = original_supported


if __name__ == '__main__':
    unittest.main()
