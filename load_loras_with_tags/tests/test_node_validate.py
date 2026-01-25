import sys
import types
import unittest

stub = types.ModuleType('folder_paths')
stub.get_folder_paths = lambda *_args, **_kwargs: []
stub.supported_pt_extensions = {'.safetensors'}
stub.get_full_path = lambda *_args, **_kwargs: '/tmp/test.safetensors'
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

from load_loras_with_tags.ui.nodes import load_loras_with_tags as load_loras_with_tags_node


class LoadLorasWithTagsValidateTest(unittest.TestCase):
    def test_allows_missing_when_disabled(self) -> None:
        result = load_loras_with_tags_node.LoadLorasWithTags.VALIDATE_INPUTS(
            lora_name_1='missing.safetensors',
            lora_on_1=False,
        )

        self.assertTrue(result is True)

    def test_rejects_missing_when_enabled(self) -> None:
        result = load_loras_with_tags_node.LoadLorasWithTags.VALIDATE_INPUTS(
            lora_name_1='missing.safetensors',
            lora_on_1=True,
        )

        self.assertIsInstance(result, str)
        self.assertIn('LoRA not found', result)
