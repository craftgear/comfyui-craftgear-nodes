import importlib.util
import runpy
import sys
import types
import unittest
from pathlib import Path


class RootInitTest(unittest.TestCase):
    def setUp(self) -> None:
        self._modules_backup = dict(sys.modules)

    def tearDown(self) -> None:
        sys.modules.clear()
        sys.modules.update(self._modules_backup)

    def test_import_root_init(self) -> None:
        fake_torch = types.SimpleNamespace(Tensor=object, device=object, dtype=object)
        fake_nn = types.SimpleNamespace(functional=types.SimpleNamespace())
        sys.modules['torch'] = fake_torch
        sys.modules['torch.nn'] = fake_nn
        sys.modules['torch.nn.functional'] = fake_nn.functional
        sys.modules['server'] = types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(instance=types.SimpleNamespace(routes=types.SimpleNamespace(post=lambda _p: (lambda h: h))))
        )
        sys.modules['aiohttp'] = types.SimpleNamespace(
            web=types.SimpleNamespace(Request=object, Response=object, json_response=lambda payload: payload)
        )
        sys.modules['aiohttp.web'] = sys.modules['aiohttp'].web
        sys.modules['folder_paths'] = types.SimpleNamespace(
            get_folder_paths=lambda *_args, **_kwargs: [],
            supported_pt_extensions={'.safetensors'},
            get_full_path=lambda *_args, **_kwargs: None,
            get_output_directory=lambda *_args, **_kwargs: '',
        )
        comfy = types.ModuleType('comfy')
        comfy.utils = types.SimpleNamespace(load_torch_file=lambda *_args, **_kwargs: {})
        comfy.sd = types.SimpleNamespace(load_lora_for_models=lambda model, clip, *_args, **_kwargs: (model, clip))
        sys.modules['comfy'] = comfy
        sys.modules['comfy.utils'] = comfy.utils
        sys.modules['comfy.sd'] = comfy.sd

        root = Path(__file__).resolve().parents[1]
        module_name = 'craftgear_nodes_root'
        spec = importlib.util.spec_from_file_location(
            module_name,
            root / '__init__.py',
            submodule_search_locations=[str(root)],
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        assert spec.loader is not None
        spec.loader.exec_module(module)

        self.assertIn('A1111MetadataWriter', module.NODE_CLASS_MAPPINGS)
        self.assertIn('A1111WebpMetadataReader', module.NODE_CLASS_MAPPINGS)
        self.assertIn('A1111MetadataWriter', module.NODE_DISPLAY_NAME_MAPPINGS)
        self.assertIn('A1111WebpMetadataReader', module.NODE_DISPLAY_NAME_MAPPINGS)

    def test_run_root_init(self) -> None:
        sys.modules['server'] = types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(instance=types.SimpleNamespace(routes=types.SimpleNamespace(post=lambda _p: (lambda h: h))))
        )
        sys.modules['aiohttp'] = types.SimpleNamespace(
            web=types.SimpleNamespace(Request=object, Response=object, json_response=lambda payload: payload)
        )
        sys.modules['aiohttp.web'] = sys.modules['aiohttp'].web
        sys.modules['folder_paths'] = types.SimpleNamespace(
            get_folder_paths=lambda *_args, **_kwargs: [],
            supported_pt_extensions={'.safetensors'},
            get_full_path=lambda *_args, **_kwargs: None,
            get_output_directory=lambda *_args, **_kwargs: '',
        )
        comfy = types.ModuleType('comfy')
        comfy.utils = types.SimpleNamespace(load_torch_file=lambda *_args, **_kwargs: {})
        comfy.sd = types.SimpleNamespace(load_lora_for_models=lambda model, clip, *_args, **_kwargs: (model, clip))
        sys.modules['comfy'] = comfy
        sys.modules['comfy.utils'] = comfy.utils
        sys.modules['comfy.sd'] = comfy.sd
        sys.modules['torch'] = types.SimpleNamespace(Tensor=object)
        sys.modules['torch.nn'] = types.SimpleNamespace(functional=types.SimpleNamespace())
        sys.modules['torch.nn.functional'] = sys.modules['torch.nn'].functional

        root = Path(__file__).resolve().parents[1]
        data = runpy.run_path(str(root / '__init__.py'))
        self.assertIn('NODE_CLASS_MAPPINGS', data)


if __name__ == '__main__':
    unittest.main()
