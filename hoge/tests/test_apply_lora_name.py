import sys
import types
import unittest

if 'folder_paths' not in sys.modules:
    stub = types.ModuleType('folder_paths')
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

import folder_paths  # noqa: E402
from hoge.ui.nodes import hoge as hoge_node  # noqa: E402


class HogeApplyLoraNameTest(unittest.TestCase):
    def test_apply_resolves_lora_name_index(self) -> None:
        calls: dict[str, str] = {}

        def get_full_path(_category: str, filename: str) -> str:
            calls['filename'] = filename
            if not isinstance(filename, str):
                raise TypeError('filename must be str')
            return f'/tmp/{filename}'

        folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
        folder_paths.supported_pt_extensions = {'.safetensors'}
        folder_paths.get_full_path = get_full_path
        hoge_node.collect_lora_names = lambda *_args, **_kwargs: ['example.safetensors']
        hoge_node.extract_lora_triggers = lambda *_args, **_kwargs: []
        hoge_node.filter_lora_triggers = lambda _triggers, _selection: []

        node = hoge_node.Hoge()
        result = node.apply(
            'model',
            'clip',
            lora_name_1=1,
            lora_strength_1=0,
            lora_on_1=True,
            trigger_selection_1='',
        )

        self.assertEqual(calls.get('filename'), 'example.safetensors')
        self.assertEqual(result, ('model', 'clip', ''))

    def test_apply_resolves_lora_name_string_index(self) -> None:
        calls: dict[str, str] = {}

        def get_full_path(_category: str, filename: str) -> str:
            calls['filename'] = filename
            return f'/tmp/{filename}'

        folder_paths.get_full_path = get_full_path
        hoge_node.collect_lora_names = lambda *_args, **_kwargs: ['example.safetensors']
        hoge_node.extract_lora_triggers = lambda *_args, **_kwargs: []
        hoge_node.filter_lora_triggers = lambda _triggers, _selection: []

        node = hoge_node.Hoge()
        result = node.apply(
            'model',
            'clip',
            lora_name_1='1',
            lora_strength_1=0,
            lora_on_1=True,
            trigger_selection_1='',
        )

        self.assertEqual(calls.get('filename'), 'example.safetensors')
        self.assertEqual(result, ('model', 'clip', ''))


if __name__ == '__main__':
    unittest.main()
