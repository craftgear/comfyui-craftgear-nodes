import sys
import types
import unittest

stub = types.ModuleType('folder_paths')
sys.modules['folder_paths'] = stub
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
from load_loras_with_tags.ui.nodes import load_loras_with_tags as load_loras_with_tags_node  # noqa: E402


class LoadLorasWithTagsApplyLoraNameTest(unittest.TestCase):
    def test_apply_resolves_lora_name_index(self) -> None:
        calls: dict[str, str] = {}

        def get_full_path(_category: str, filename: str) -> str:
            calls['filename'] = filename
            return f'/tmp/{filename}'

        folder_paths.get_folder_paths = lambda *_args, **_kwargs: []
        folder_paths.supported_pt_extensions = {'.safetensors'}
        folder_paths.get_full_path = get_full_path
        load_loras_with_tags_node.collect_lora_names = lambda *_args, **_kwargs: ['example.safetensors']
        load_loras_with_tags_node.extract_lora_triggers = lambda *_args, **_kwargs: []
        load_loras_with_tags_node.filter_lora_triggers = lambda _triggers, _selection: []

        node = load_loras_with_tags_node.LoadLorasWithTags()
        result = node.apply(
            'model',
            'clip',
            lora_name_1=1,
            lora_strength_1=0,
            lora_on_1=True,
            tag_selection_1='',
            tags='alpha',
        )

        self.assertEqual(calls.get('filename'), 'example.safetensors')
        self.assertEqual(result, ('model', 'clip', 'alpha'))

    def test_apply_resolves_lora_name_string_index(self) -> None:
        calls: dict[str, str] = {}

        def get_full_path(_category: str, filename: str) -> str:
            calls['filename'] = filename
            return f'/tmp/{filename}'

        folder_paths.get_full_path = get_full_path
        load_loras_with_tags_node.collect_lora_names = lambda *_args, **_kwargs: ['example.safetensors']
        load_loras_with_tags_node.extract_lora_triggers = lambda *_args, **_kwargs: []
        load_loras_with_tags_node.filter_lora_triggers = lambda _triggers, _selection: []

        node = load_loras_with_tags_node.LoadLorasWithTags()
        result = node.apply(
            'model',
            'clip',
            lora_name_1='1',
            lora_strength_1=0,
            lora_on_1=True,
            tag_selection_1='',
            tags='alpha',
        )

        self.assertEqual(calls.get('filename'), 'example.safetensors')
        self.assertEqual(result, ('model', 'clip', 'alpha'))
