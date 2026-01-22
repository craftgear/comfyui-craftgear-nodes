import base64
import hashlib
import json
import os
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from a1111_metadata_writer.logic import a1111_metadata as logic
from a1111_metadata_writer.ui import node as node_module
from a1111_metadata_writer.ui.node import A1111MetadataWriter

try:
    import torch
except Exception:
    torch = None
try:
    from PIL import Image  # noqa: F401
except Exception:
    Image = None


BASE_PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X2l1cAAAAASUVORK5CYII='
)


def build_prompt() -> dict:
    return {
        '1': {
            'inputs': {'ckpt_name': 'models/test.safetensors'},
            'class_type': 'CheckpointLoaderSimple',
        },
        '2': {
            'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
            'class_type': 'EmptyLatentImage',
        },
        '3': {
            'inputs': {'text': 'masterpiece, tag1'},
            'class_type': 'CLIPTextEncode',
        },
        '4': {
            'inputs': {'text': 'bad'},
            'class_type': 'CLIPTextEncode',
        },
        '5': {
            'inputs': {
                'seed': 123,
                'steps': 20,
                'cfg': 6.5,
                'sampler_name': 'euler_a',
                'scheduler': 'karras',
                'denoise': 1.0,
                'model': ['1', 0],
                'positive': ['3', 0],
                'negative': ['4', 0],
                'latent_image': ['2', 0],
            },
            'class_type': 'KSampler',
        },
    }


def build_prompt_with_commentable_and_join() -> dict:
    return {
        '1': {
            'inputs': {'ckpt_name': 'models/test.safetensors'},
            'class_type': 'CheckpointLoaderSimple',
        },
        '2': {
            'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
            'class_type': 'EmptyLatentImage',
        },
        '3': {
            'inputs': {'text': 'masterpiece\n//comment\nbest quality', 'separator': ','},
            'class_type': 'CommentableMultilineTextNode',
        },
        '4': {
            'inputs': {'text_1': ['3', 0], 'text_2': 'extra', 'separator': ','},
            'class_type': 'JoinTextNode',
        },
        '5': {
            'inputs': {'text': ['4', 0], 'excluded_tags': '["best quality"]'},
            'class_type': 'TagToggleTextNode',
        },
        '6': {
            'inputs': {'text': ['5', 0]},
            'class_type': 'CLIPTextEncode',
        },
        '7': {
            'inputs': {'text': 'bad'},
            'class_type': 'CLIPTextEncode',
        },
        '8': {
            'inputs': {
                'seed': 123,
                'steps': 20,
                'cfg': 6.5,
                'sampler_name': 'euler_a',
                'scheduler': 'karras',
                'denoise': 1.0,
                'model': ['1', 0],
                'positive': ['6', 0],
                'negative': ['7', 0],
                'latent_image': ['2', 0],
            },
            'class_type': 'KSampler',
        },
    }


def build_prompt_with_tag_toggle() -> dict:
    return {
        '1': {
            'inputs': {'ckpt_name': 'models/test.safetensors'},
            'class_type': 'CheckpointLoaderSimple',
        },
        '2': {
            'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
            'class_type': 'EmptyLatentImage',
        },
        '3': {
            'inputs': {'text': 'alpha, beta, gamma', 'excluded_tags': '["beta"]'},
            'class_type': 'TagToggleTextNode',
        },
        '4': {
            'inputs': {'text': ['3', 0]},
            'class_type': 'CLIPTextEncode',
        },
        '5': {
            'inputs': {'text': 'bad'},
            'class_type': 'CLIPTextEncode',
        },
        '6': {
            'inputs': {
                'seed': 123,
                'steps': 20,
                'cfg': 6.5,
                'sampler_name': 'euler_a',
                'scheduler': 'karras',
                'denoise': 1.0,
                'model': ['1', 0],
                'positive': ['4', 0],
                'negative': ['5', 0],
                'latent_image': ['2', 0],
            },
            'class_type': 'KSampler',
        },
    }


def build_prompt_with_lora_loader() -> dict:
    return {
        '1': {
            'inputs': {'ckpt_name': 'models/base.safetensors'},
            'class_type': 'CheckpointLoaderSimple',
        },
        '2': {
            'inputs': {
                'model': ['1', 0],
                'clip': ['1', 1],
                'lora_name': 'styles/bar.safetensors',
                'strength_model': 0.75,
                'strength_clip': 0.5,
            },
            'class_type': 'LoraLoader',
        },
        '3': {
            'inputs': {'text': 'masterpiece', 'clip': ['2', 1]},
            'class_type': 'CLIPTextEncode',
        },
        '4': {
            'inputs': {'text': 'bad', 'clip': ['2', 1]},
            'class_type': 'CLIPTextEncode',
        },
        '5': {
            'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
            'class_type': 'EmptyLatentImage',
        },
        '6': {
            'inputs': {
                'seed': 123,
                'steps': 20,
                'cfg': 6.5,
                'sampler_name': 'euler_a',
                'scheduler': 'karras',
                'denoise': 1.0,
                'model': ['2', 0],
                'positive': ['3', 0],
                'negative': ['4', 0],
                'latent_image': ['5', 0],
            },
            'class_type': 'KSampler',
        },
    }


def build_prompt_with_load_loras_with_tags() -> dict:
    return {
        '1': {
            'inputs': {'ckpt_name': 'models/base.safetensors'},
            'class_type': 'CheckpointLoaderSimple',
        },
        '2': {
            'inputs': {
                'model': ['1', 0],
                'clip': ['1', 1],
                'tags': '',
                'lora_name_1': 'detail/alpha.safetensors',
                'lora_strength_1': 0.8,
                'lora_on_1': True,
                'tag_selection_1': '[]',
                'lora_name_2': 'beta.safetensors',
                'lora_strength_2': 1.0,
                'lora_on_2': False,
                'tag_selection_2': '[]',
            },
            'class_type': 'LoadLorasWithTags',
        },
        '3': {
            'inputs': {'text': 'masterpiece', 'clip': ['2', 1]},
            'class_type': 'CLIPTextEncode',
        },
        '4': {
            'inputs': {'text': 'bad', 'clip': ['2', 1]},
            'class_type': 'CLIPTextEncode',
        },
        '5': {
            'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
            'class_type': 'EmptyLatentImage',
        },
        '6': {
            'inputs': {
                'seed': 123,
                'steps': 20,
                'cfg': 6.5,
                'sampler_name': 'euler_a',
                'scheduler': 'karras',
                'denoise': 1.0,
                'model': ['2', 0],
                'positive': ['3', 0],
                'negative': ['4', 0],
                'latent_image': ['5', 0],
            },
            'class_type': 'KSampler',
        },
    }


class TestA1111MetadataWriter(unittest.TestCase):
    def test_build_a1111_parameters_from_prompt(self) -> None:
        prompt = build_prompt()
        params = logic.build_a1111_parameters_from_prompt(prompt)
        expected = (
            'masterpiece, tag1\n'
            'Negative prompt: bad\n'
            'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
            'Model: test, Scheduler: karras'
        )
        self.assertEqual(params, expected)

    def test_commentable_and_join_are_supported(self) -> None:
        prompt = build_prompt_with_commentable_and_join()
        params = logic.build_a1111_parameters_from_prompt(prompt)
        expected = (
            'masterpiece, extra\n'
            'Negative prompt: bad\n'
            'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
            'Model: test, Scheduler: karras'
        )
        self.assertEqual(params, expected)

    def test_tag_toggle_is_supported(self) -> None:
        prompt = build_prompt_with_tag_toggle()
        params = logic.build_a1111_parameters_from_prompt(prompt)
        expected = (
            'alpha, gamma\n'
            'Negative prompt: bad\n'
            'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
            'Model: test, Scheduler: karras'
        )
        self.assertEqual(params, expected)

    def test_lora_loader_is_included(self) -> None:
        prompt = build_prompt_with_lora_loader()
        params = logic.build_a1111_parameters_from_prompt(prompt)
        expected = (
            'masterpiece, <lora:bar:0.75>\n'
            'Negative prompt: bad\n'
            'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
            'Model: base, Scheduler: karras'
        )
        self.assertEqual(params, expected)

    def test_load_loras_with_tags_is_included(self) -> None:
        prompt = build_prompt_with_load_loras_with_tags()
        params = logic.build_a1111_parameters_from_prompt(prompt)
        expected = (
            'masterpiece, <lora:alpha:0.8>\n'
            'Negative prompt: bad\n'
            'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
            'Model: base, Scheduler: karras'
        )
        self.assertEqual(params, expected)

    def test_hashes_are_added_when_files_exist(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = os.path.join(temp_dir, 'base.safetensors')
            lora_path = os.path.join(temp_dir, 'bar.safetensors')
            with open(model_path, 'wb') as file:
                file.write(b'model-data')
            with open(lora_path, 'wb') as file:
                file.write(b'lora-data')
            model_hash = hashlib.sha256(b'model-data').hexdigest()[:10]
            lora_hash = hashlib.sha256(b'lora-data').hexdigest()[:10]
            prompt = {
                '1': {
                    'inputs': {'ckpt_name': model_path},
                    'class_type': 'CheckpointLoaderSimple',
                },
                '2': {
                    'inputs': {
                        'model': ['1', 0],
                        'clip': ['1', 1],
                        'lora_name': lora_path,
                        'strength_model': 0.75,
                        'strength_clip': 0.5,
                    },
                    'class_type': 'LoraLoader',
                },
                '3': {
                    'inputs': {'text': 'masterpiece', 'clip': ['2', 1]},
                    'class_type': 'CLIPTextEncode',
                },
                '4': {
                    'inputs': {'text': 'bad', 'clip': ['2', 1]},
                    'class_type': 'CLIPTextEncode',
                },
                '5': {
                    'inputs': {'width': 512, 'height': 768, 'batch_size': 1},
                    'class_type': 'EmptyLatentImage',
                },
                '6': {
                    'inputs': {
                        'seed': 123,
                        'steps': 20,
                        'cfg': 6.5,
                        'sampler_name': 'euler_a',
                        'scheduler': 'karras',
                        'denoise': 1.0,
                        'model': ['2', 0],
                        'positive': ['3', 0],
                        'negative': ['4', 0],
                        'latent_image': ['5', 0],
                    },
                    'class_type': 'KSampler',
                },
            }
            params = logic.build_a1111_parameters_from_prompt(prompt)
            expected = (
                'masterpiece, <lora:bar:0.75>\n'
                'Negative prompt: bad\n'
                'Steps: 20, Sampler: Euler a, CFG scale: 6.5, Seed: 123, Size: 512x768, '
                f'Model: base, Scheduler: karras, Hashes: {{"model": "{model_hash}", '
                f'"lora:bar": "{lora_hash}"}}'
            )
            self.assertEqual(params, expected)

    def test_hash_cache_uses_mtime_and_size(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'cache.safetensors')
            with open(path, 'wb') as file:
                file.write(b'first')
            original = logic._hash_file_uncached
            with mock.patch.object(
                logic, '_hash_file_uncached', side_effect=original
            ) as mocked:
                first = logic._hash_file_short(path)
                second = logic._hash_file_short(path)
                self.assertEqual(first, second)
                self.assertEqual(mocked.call_count, 1)
                with open(path, 'wb') as file:
                    file.write(b'second')
                stat = os.stat(path)
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
                third = logic._hash_file_short(path)
                self.assertNotEqual(first, third)
                self.assertEqual(mocked.call_count, 2)

    def test_hash_cache_is_persistent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = os.path.join(temp_dir, 'hash_cache.json')
            target_path = os.path.join(temp_dir, 'persist.safetensors')
            with open(target_path, 'wb') as file:
                file.write(b'persist')
            original = logic._hash_file_uncached
            with mock.patch.object(
                logic, '_hash_cache_path', return_value=cache_path
            ), mock.patch.object(
                logic, '_hash_file_uncached', side_effect=original
            ) as mocked:
                first = logic._hash_file_short(target_path)
                self.assertTrue(os.path.exists(cache_path))
                self.assertEqual(mocked.call_count, 1)
                logic._HASH_CACHE.clear()
                logic._HASH_CACHE_LOADED = False
                second = logic._hash_file_short(target_path)
                self.assertEqual(first, second)
                self.assertEqual(mocked.call_count, 1)

    def test_suffix_false_defaults_to_a1111(self) -> None:
        self.assertEqual(node_module._build_filename_prefix(False), 'ComfyUI_a1111')
        self.assertEqual(node_module._build_filename_prefix('False'), 'ComfyUI_a1111')
        self.assertEqual(node_module._build_filename_prefix('  '), 'ComfyUI_a1111')
        self.assertEqual(node_module._build_filename_prefix('_custom'), 'ComfyUI_custom')

    def test_write_a1111_parameters_to_png(self) -> None:
        prompt = build_prompt()
        png_with_prompt = logic.set_png_text_value(
            BASE_PNG, 'prompt', json.dumps(prompt)
        )
        params = logic.build_a1111_parameters_from_png(png_with_prompt)
        updated = logic.set_png_text_value(png_with_prompt, 'parameters', params)
        text_map = logic.read_png_text(updated)
        self.assertEqual(text_map.get('parameters'), params)
        self.assertIn('prompt', text_map)

    @unittest.skipIf(torch is None or Image is None, 'torch and PIL are required')
    def test_node_writes_copy_with_suffix(self) -> None:
        prompt = build_prompt()
        with tempfile.TemporaryDirectory() as temp_dir:
            node = A1111MetadataWriter()
            image = torch.zeros((1, 1, 1, 3), dtype=torch.float32)
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI_a1111', 0, '', 'ComfyUI_a1111'),
            ):
                params, output_path = node.apply(
                    image=image,
                    overwrite=False,
                    suffix='_a1111',
                    prompt=prompt,
                    extra_pnginfo={'workflow': {'id': '1'}},
                )
            self.assertTrue(output_path.endswith('_a1111.png'))
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, 'rb') as file:
                text_map = logic.read_png_text(file.read())
            self.assertEqual(text_map.get('parameters'), params)
            self.assertIn('prompt', text_map)

    @unittest.skipIf(torch is None or Image is None, 'torch and PIL are required')
    def test_overwrite_uses_latest_file(self) -> None:
        prompt = build_prompt()
        with tempfile.TemporaryDirectory() as temp_dir:
            oldest = os.path.join(temp_dir, 'ComfyUI_00001_.png')
            newest = os.path.join(temp_dir, 'ComfyUI_00003_.png')
            with open(oldest, 'wb') as file:
                file.write(BASE_PNG)
            with open(newest, 'wb') as file:
                file.write(BASE_PNG)
            node = A1111MetadataWriter()
            image = torch.zeros((1, 1, 1, 3), dtype=torch.float32)
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI', 4, '', 'ComfyUI'),
            ):
                params, output_path = node.apply(
                    image=image,
                    overwrite=True,
                    suffix='_a1111',
                    prompt=prompt,
                    extra_pnginfo={'workflow': {'id': '1'}},
                )
            self.assertEqual(output_path, newest)
            with open(output_path, 'rb') as file:
                text_map = logic.read_png_text(file.read())
            self.assertEqual(text_map.get('parameters'), params)

if __name__ == '__main__':
    unittest.main()
