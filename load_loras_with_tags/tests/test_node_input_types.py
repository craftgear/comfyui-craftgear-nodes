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

from load_loras_with_tags.ui.nodes import load_loras_with_tags as load_loras_with_tags_node


class LoadLorasWithTagsInputTypesTest(unittest.TestCase):
    def test_input_types_include_stack_fields(self) -> None:
        inputs = load_loras_with_tags_node.LoadLorasWithTags.INPUT_TYPES()
        required = inputs['required']
        self.assertEqual(required['model'][0], 'MODEL')
        self.assertEqual(required['clip'][0], 'CLIP')
        self.assertIn('lora_name_1', required)
        self.assertIn('lora_strength_1', required)
        self.assertIn('lora_on_1', required)
        self.assertIn('lora_name_10', required)
        self.assertIn('lora_strength_10', required)
        self.assertIn('lora_on_10', required)
        self.assertIn('tag_selection_1', required)
        self.assertIn('tag_selection_10', required)
        self.assertNotIn('tags', required)
        optional = inputs.get('optional', {})
        self.assertIn('tags', optional)
        tags = optional['tags']
        self.assertEqual(tags[0], 'STRING')
        self.assertTrue(tags[1].get('forceInput'))

    def test_strength_slider_metadata(self) -> None:
        inputs = load_loras_with_tags_node.LoadLorasWithTags.INPUT_TYPES()
        strength = inputs['required']['lora_strength_1']
        meta = strength[1]
        self.assertEqual(strength[0], 'FLOAT')
        self.assertEqual(meta['display'], 'slider')
        self.assertEqual(meta['min'], -2.0)
        self.assertEqual(meta['max'], 2.0)
        self.assertEqual(meta['step'], 0.1)
        self.assertEqual(meta['default'], 1.0)

    def test_output_types(self) -> None:
        self.assertEqual(load_loras_with_tags_node.LoadLorasWithTags.RETURN_TYPES, ('MODEL', 'CLIP', 'STRING'))
        self.assertEqual(load_loras_with_tags_node.LoadLorasWithTags.RETURN_NAMES, ('model', 'clip', 'tags'))


if __name__ == '__main__':
    unittest.main()
