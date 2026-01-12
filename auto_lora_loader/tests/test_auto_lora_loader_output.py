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
    utils.load_torch_file = lambda *_args, **_kwargs: {'loaded': True}
    sd.load_lora_for_models = lambda model, clip, *_args, **_kwargs: (
        f'{model}-lora',
        f'{clip}-lora',
    )
    comfy.utils = utils
    comfy.sd = sd
    sys.modules['comfy'] = comfy
    sys.modules['comfy.utils'] = utils
    sys.modules['comfy.sd'] = sd

from auto_lora_loader.ui.nodes import auto_lora_loader as ui_node


class AutoLoraLoaderOutputTest(unittest.TestCase):
    def test_select_lora_builds_prompt_strings(self) -> None:
        node = ui_node.AutoLoraLoader()
        original_get_path = ui_node.folder_paths.get_full_path
        original_extract = ui_node.extract_lora_triggers
        original_filter = ui_node.filter_lora_triggers

        try:
            ui_node.folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/sample.safetensors'
            ui_node.extract_lora_triggers = lambda *_args, **_kwargs: ['alpha', 'beta']
            ui_node.filter_lora_triggers = lambda *_args, **_kwargs: ['beta', 'alpha']

            model, clip, trigger_words = node.select_lora(
                'model', 'clip', 'sample.safetensors', 0.7, '[]'
            )

            self.assertEqual(trigger_words, 'beta,alpha')
            self.assertEqual(model, 'model-lora')
            self.assertEqual(clip, 'clip-lora')
        finally:
            ui_node.folder_paths.get_full_path = original_get_path
            ui_node.extract_lora_triggers = original_extract
            ui_node.filter_lora_triggers = original_filter

    def test_select_lora_handles_empty_triggers(self) -> None:
        node = ui_node.AutoLoraLoader()
        original_get_path = ui_node.folder_paths.get_full_path
        original_extract = ui_node.extract_lora_triggers
        original_filter = ui_node.filter_lora_triggers

        try:
            ui_node.folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/sample.safetensors'
            ui_node.extract_lora_triggers = lambda *_args, **_kwargs: []
            ui_node.filter_lora_triggers = lambda *_args, **_kwargs: []

            model, clip, trigger_words = node.select_lora(
                'model', 'clip', 'dir/sample.safetensors', 1.2, ''
            )

            self.assertEqual(trigger_words, '')
            self.assertEqual(model, 'model-lora')
            self.assertEqual(clip, 'clip-lora')
        finally:
            ui_node.folder_paths.get_full_path = original_get_path
            ui_node.extract_lora_triggers = original_extract
            ui_node.filter_lora_triggers = original_filter

    def test_select_lora_skips_when_none(self) -> None:
        node = ui_node.AutoLoraLoader()
        model, clip, trigger_words = node.select_lora(
            'model', 'clip', 'None', 1.0, ''
        )

        self.assertEqual(trigger_words, '')
        self.assertEqual(model, 'model')
        self.assertEqual(clip, 'clip')


if __name__ == '__main__':
    unittest.main()
