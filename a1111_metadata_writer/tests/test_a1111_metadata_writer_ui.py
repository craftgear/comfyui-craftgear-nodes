import os
import tempfile
import unittest
from unittest import mock
import types
import sys

from a1111_metadata_writer.ui import node as node_module


class DummyImage:
    def __init__(self, width: int, height: int) -> None:
        self.size = (width, height)


class TestA1111MetadataWriterUi(unittest.TestCase):
    def test_input_types_format_is_png_webp_toggle(self) -> None:
        required = node_module.A1111MetadataWriter.INPUT_TYPES()['required']
        self.assertIn('format', required)
        self.assertEqual(required['format'][0], ['png', 'webp'])
        self.assertEqual(required['format'][1]['default'], 'png')

    def test_build_preview_payload_in_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            subfolder = os.path.join(temp_dir, 'nested')
            os.makedirs(subfolder, exist_ok=True)
            output_path = os.path.join(subfolder, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir):
                payload = node_module._build_preview_payload(output_path)
        self.assertEqual(payload, {'filename': 'image.png', 'subfolder': 'nested', 'type': 'output'})

    def test_build_preview_payload_outside_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as other_dir:
            output_path = os.path.join(other_dir, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir):
                payload = node_module._build_preview_payload(output_path)
        self.assertIsNone(payload)

    def test_build_output_path_uses_counter(self) -> None:
        dummy = DummyImage(64, 64)
        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI_custom', 4, '', 'ComfyUI_custom'),
            ):
                output_path = node_module._build_output_path(dummy, '_custom')
        self.assertTrue(output_path.endswith('ComfyUI_custom_00004_.png'))
        self.assertTrue(output_path.startswith(temp_dir))

    def test_build_output_path_uses_counter_for_webp(self) -> None:
        dummy = DummyImage(64, 64)
        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI_custom', 4, '', 'ComfyUI_custom'),
            ):
                output_path = node_module._build_output_path(dummy, '_custom', 'webp')
        self.assertTrue(output_path.endswith('ComfyUI_custom_00004_.webp'))
        self.assertTrue(output_path.startswith(temp_dir))

    def test_build_overwrite_path_uses_latest(self) -> None:
        dummy = DummyImage(64, 64)
        with tempfile.TemporaryDirectory() as temp_dir:
            latest = os.path.join(temp_dir, 'ComfyUI_00003_.png')
            with open(os.path.join(temp_dir, 'ComfyUI_00001_.png'), 'wb') as file:
                file.write(b'')
            with open(latest, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI', 4, '', 'ComfyUI'),
            ):
                output_path = node_module._build_overwrite_path(dummy, {'1': {'class_type': 'SaveImage'}})
        self.assertEqual(output_path, latest)

    def test_build_overwrite_path_uses_latest_webp(self) -> None:
        dummy = DummyImage(64, 64)
        with tempfile.TemporaryDirectory() as temp_dir:
            with open(os.path.join(temp_dir, 'ComfyUI_00001_.png'), 'wb') as file:
                file.write(b'')
            latest_webp = os.path.join(temp_dir, 'ComfyUI_00003_.webp')
            with open(os.path.join(temp_dir, 'ComfyUI_00002_.webp'), 'wb') as file:
                file.write(b'')
            with open(latest_webp, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module,
                '_get_save_image_path',
                return_value=(temp_dir, 'ComfyUI', 4, '', 'ComfyUI'),
            ):
                output_path = node_module._build_overwrite_path(dummy, {'1': {'class_type': 'SaveImage'}}, 'webp')
        self.assertEqual(output_path, latest_webp)

    def test_resolve_overwrite_prefix(self) -> None:
        prompt = {
            '1': {
                'class_type': 'SaveImage',
                'inputs': {'filename_prefix': 'demo'},
            }
        }
        self.assertEqual(node_module._resolve_overwrite_prefix(prompt), 'demo')
        self.assertEqual(node_module._resolve_overwrite_prefix({}), 'ComfyUI')

    def test_build_result_includes_ui_images(self) -> None:
        preview = {'filename': 'image.png', 'type': 'output'}
        result = node_module._build_result('params', '/tmp/image.png', preview)
        self.assertEqual(result['result'], ('params', '/tmp/image.png'))
        self.assertEqual(result['ui']['images'], [preview])

    def test_build_result_without_preview(self) -> None:
        result = node_module._build_result('params', '/tmp/image.png', None)
        self.assertEqual(result['result'], ('params', '/tmp/image.png'))
        self.assertEqual(result['ui']['images'], [])

    def test_normalize_suffix(self) -> None:
        self.assertEqual(node_module._normalize_suffix(None), '')
        self.assertEqual(node_module._normalize_suffix(True), '')
        self.assertEqual(node_module._normalize_suffix('  '), '')
        self.assertEqual(node_module._normalize_suffix('False'), '')
        self.assertEqual(node_module._normalize_suffix('_demo'), '_demo')

    def test_build_filename_prefix_defaults(self) -> None:
        self.assertEqual(node_module._build_filename_prefix(''), 'ComfyUI_a1111')
        self.assertEqual(node_module._build_filename_prefix('_demo'), 'ComfyUI_demo')

    def test_build_output_path_requires_output_dir(self) -> None:
        dummy = DummyImage(64, 64)
        with mock.patch.object(node_module, '_default_image_path', return_value=''):
            with self.assertRaises(ValueError):
                node_module._build_output_path(dummy, '_demo')

    def test_find_latest_output_path_no_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with open(os.path.join(temp_dir, 'other.txt'), 'wb') as file:
                file.write(b'')
            result = node_module._find_latest_output_path(temp_dir, 'ComfyUI', 'png')
        self.assertEqual(result, '')

    def test_normalize_output_format(self) -> None:
        self.assertEqual(node_module._normalize_output_format('png'), 'png')
        self.assertEqual(node_module._normalize_output_format('WEBP'), 'webp')
        self.assertEqual(node_module._normalize_output_format('invalid'), 'png')

    def test_build_preview_payload_no_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=''):
                payload = node_module._build_preview_payload(output_path)
        self.assertIsNone(payload)

    def test_build_pnginfo_excludes_reserved_keys(self) -> None:
        class DummyPngInfo:
            def __init__(self) -> None:
                self.text: dict[str, str] = {}

            def add_text(self, key: str, value: str) -> None:
                self.text[key] = value

        dummy_module = types.SimpleNamespace(PngInfo=DummyPngInfo)
        modules_backup = dict(sys.modules)
        try:
            sys.modules['PIL'] = types.SimpleNamespace(PngImagePlugin=dummy_module)
            sys.modules['PIL.PngImagePlugin'] = dummy_module
            pnginfo = node_module._build_pnginfo(
                {'id': '1'},
                {'extra': {'a': 1}, 'prompt': 'skip', 'parameters': 'skip'},
                'params',
            )
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)
        self.assertIn('prompt', pnginfo.text)
        self.assertIn('parameters', pnginfo.text)
        self.assertIn('extra', pnginfo.text)
        self.assertNotEqual(pnginfo.text.get('prompt'), 'skip')

    def test_default_image_path(self) -> None:
        modules_backup = dict(sys.modules)
        try:
            sys.modules['folder_paths'] = types.SimpleNamespace(get_output_directory=lambda: '/tmp')
            self.assertEqual(node_module._default_image_path(), '/tmp')
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)

    def test_build_overwrite_path_requires_output_dir(self) -> None:
        dummy = DummyImage(64, 64)
        with mock.patch.object(node_module, '_default_image_path', return_value=''):
            with self.assertRaises(ValueError):
                node_module._build_overwrite_path(dummy, {})


if __name__ == '__main__':
    unittest.main()
