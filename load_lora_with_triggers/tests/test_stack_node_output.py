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
    comfy.utils = types.ModuleType('comfy.utils')
    comfy.sd = types.ModuleType('comfy.sd')
    sys.modules['comfy'] = comfy
    sys.modules['comfy.utils'] = comfy.utils
    sys.modules['comfy.sd'] = comfy.sd

from load_lora_with_triggers.ui.nodes import load_lora_with_triggers_stack as ui_node


class LoadLoraWithTriggersStackOutputTest(unittest.TestCase):
    def test_select_lora_applies_multiple_slots(self) -> None:
        node = ui_node.LoadLoraWithTriggersStack()
        original_get_path = ui_node.folder_paths.get_full_path
        original_extract = ui_node.extract_lora_triggers
        original_filter = ui_node.filter_lora_triggers
        original_load = ui_node.comfy.utils.load_torch_file
        original_apply = ui_node.comfy.sd.load_lora_for_models

        try:
            ui_node.folder_paths.get_full_path = lambda _kind, name: f'/tmp/{name}'
            ui_node.comfy.utils.load_torch_file = lambda path, **_kwargs: path
            ui_node.comfy.sd.load_lora_for_models = (
                lambda model, clip, lora, strength_model, strength_clip: (
                    f'{model}|{lora}:{strength_model}',
                    f'{clip}|{lora}:{strength_clip}',
                )
            )

            def fake_extract(path):
                if path.endswith('a.safetensors'):
                    return ['alpha']
                return ['beta', 'gamma']

            ui_node.extract_lora_triggers = fake_extract
            ui_node.filter_lora_triggers = lambda triggers, _selection: triggers

            model, clip, triggers = node.select_lora(
                'model',
                'clip',
                lora_name_1='a.safetensors',
                lora_strength_1=1.0,
                trigger_selection_1='',
                lora_name_2='b.safetensors',
                lora_strength_2=0.5,
                trigger_selection_2='',
            )

            self.assertEqual(model, 'model|/tmp/a.safetensors:1.0|/tmp/b.safetensors:0.5')
            self.assertEqual(clip, 'clip|/tmp/a.safetensors:1.0|/tmp/b.safetensors:0.5')
            self.assertEqual(triggers, 'alpha,beta,gamma')
        finally:
            ui_node.folder_paths.get_full_path = original_get_path
            ui_node.extract_lora_triggers = original_extract
            ui_node.filter_lora_triggers = original_filter
            ui_node.comfy.utils.load_torch_file = original_load
            ui_node.comfy.sd.load_lora_for_models = original_apply


if __name__ == '__main__':
    unittest.main()
