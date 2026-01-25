import sys
import types
import unittest

stub = types.ModuleType('folder_paths')
stub.get_folder_paths = lambda *_args, **_kwargs: []
stub.supported_pt_extensions = {'.safetensors'}
stub.get_full_path = lambda *_args, **_kwargs: None
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

from load_loras_with_tags.ui.nodes import load_loras_with_tags as node_module


class LoadLorasWithTagsUtilsTest(unittest.TestCase):
    def test_resolve_lora_name_variants(self) -> None:
        choices = ['None', 'a.safetensors', 'b.safetensors']
        self.assertEqual(node_module.resolve_lora_name({'value': 'a.safetensors'}, choices), 'a.safetensors')
        self.assertEqual(node_module.resolve_lora_name({'name': 'b.safetensors'}, choices), 'b.safetensors')
        self.assertEqual(node_module.resolve_lora_name(1, choices), 'a.safetensors')
        self.assertEqual(node_module.resolve_lora_name(99, choices), 'None')
        self.assertEqual(node_module.resolve_lora_name('2', choices), 'b.safetensors')
        self.assertEqual(node_module.resolve_lora_name('99', choices), 'None')
        self.assertEqual(node_module.resolve_lora_name(None, choices), 'None')

    def test_split_and_dedupe_tags(self) -> None:
        self.assertEqual(node_module.split_tags(None), [])
        self.assertEqual(node_module.split_tags('a, b,, c'), ['a', 'b', 'c'])
        self.assertEqual(node_module.dedupe_tags(['A', 'a', 'b']), ['A', 'b'])

    def test_escape_parentheses(self) -> None:
        self.assertEqual(node_module.escape_parentheses('(alpha:1.2)'), '(alpha:1.2)')
        self.assertEqual(node_module.escape_parentheses('foo(bar)'), 'foo\\(bar\\)')
        self.assertEqual(node_module.escape_parentheses('\\(alpha:1.2\\)'), '(alpha:1.2)')

    def test_is_weighted_tag(self) -> None:
        self.assertTrue(node_module._is_weighted_tag('(alpha:1.2)'))
        self.assertFalse(node_module._is_weighted_tag('alpha'))
        self.assertFalse(node_module._is_weighted_tag('(alpha:)'))
        self.assertFalse(node_module._is_weighted_tag('(alpha)'))
        self.assertFalse(node_module._is_weighted_tag('(:1.2)'))
