import sys
import types
import unittest

if 'folder_paths' not in sys.modules:
    stub = types.ModuleType('folder_paths')
    stub.get_folder_paths = lambda *_args, **_kwargs: []
    stub.supported_pt_extensions = {'.safetensors'}
    stub.get_full_path = lambda *_args, **_kwargs: '/tmp/test.safetensors'
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

from hoge.ui.nodes import hoge as hoge_node


class HogeApplyTest(unittest.TestCase):
    def test_skips_when_disabled(self) -> None:
        calls = {'load': 0, 'apply': 0}

        def load_torch_file(*_args, **_kwargs):
            calls['load'] += 1
            return {'lora': True}

        def load_lora_for_models(model, clip, *_args, **_kwargs):
            calls['apply'] += 1
            return (f'{model}_lora', f'{clip}_lora')

        original_load = hoge_node.comfy.utils.load_torch_file
        original_apply = hoge_node.comfy.sd.load_lora_for_models
        original_full_path = hoge_node.folder_paths.get_full_path

        try:
            hoge_node.comfy.utils.load_torch_file = load_torch_file
            hoge_node.comfy.sd.load_lora_for_models = load_lora_for_models
            hoge_node.folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/test.safetensors'

            node = hoge_node.Hoge()
            model, clip = node.apply(
                'model',
                'clip',
                lora_name_1='a.safetensors',
                lora_strength_1=1.0,
                lora_on_1=False,
            )

            self.assertEqual((model, clip), ('model', 'clip'))
            self.assertEqual(calls['load'], 0)
            self.assertEqual(calls['apply'], 0)
        finally:
            hoge_node.comfy.utils.load_torch_file = original_load
            hoge_node.comfy.sd.load_lora_for_models = original_apply
            hoge_node.folder_paths.get_full_path = original_full_path

    def test_skips_when_strength_zero(self) -> None:
        calls = {'load': 0, 'apply': 0}

        def load_torch_file(*_args, **_kwargs):
            calls['load'] += 1
            return {'lora': True}

        def load_lora_for_models(model, clip, *_args, **_kwargs):
            calls['apply'] += 1
            return (f'{model}_lora', f'{clip}_lora')

        original_load = hoge_node.comfy.utils.load_torch_file
        original_apply = hoge_node.comfy.sd.load_lora_for_models
        original_full_path = hoge_node.folder_paths.get_full_path

        try:
            hoge_node.comfy.utils.load_torch_file = load_torch_file
            hoge_node.comfy.sd.load_lora_for_models = load_lora_for_models
            hoge_node.folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/test.safetensors'

            node = hoge_node.Hoge()
            model, clip = node.apply(
                'model',
                'clip',
                lora_name_1='a.safetensors',
                lora_strength_1=0,
                lora_on_1=True,
            )

            self.assertEqual((model, clip), ('model', 'clip'))
            self.assertEqual(calls['load'], 0)
            self.assertEqual(calls['apply'], 0)
        finally:
            hoge_node.comfy.utils.load_torch_file = original_load
            hoge_node.comfy.sd.load_lora_for_models = original_apply
            hoge_node.folder_paths.get_full_path = original_full_path

    def test_applies_when_enabled(self) -> None:
        calls = {'load': 0, 'apply': 0}

        def load_torch_file(*_args, **_kwargs):
            calls['load'] += 1
            return {'lora': True}

        def load_lora_for_models(model, clip, *_args, **_kwargs):
            calls['apply'] += 1
            return (f'{model}_lora', f'{clip}_lora')

        original_load = hoge_node.comfy.utils.load_torch_file
        original_apply = hoge_node.comfy.sd.load_lora_for_models
        original_full_path = hoge_node.folder_paths.get_full_path

        try:
            hoge_node.comfy.utils.load_torch_file = load_torch_file
            hoge_node.comfy.sd.load_lora_for_models = load_lora_for_models
            hoge_node.folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/test.safetensors'

            node = hoge_node.Hoge()
            model, clip = node.apply(
                'model',
                'clip',
                lora_name_1='a.safetensors',
                lora_strength_1=1.0,
                lora_on_1=True,
            )

            self.assertEqual((model, clip), ('model_lora', 'clip_lora'))
            self.assertEqual(calls['load'], 1)
            self.assertEqual(calls['apply'], 1)
        finally:
            hoge_node.comfy.utils.load_torch_file = original_load
            hoge_node.comfy.sd.load_lora_for_models = original_apply
            hoge_node.folder_paths.get_full_path = original_full_path


if __name__ == '__main__':
    unittest.main()
