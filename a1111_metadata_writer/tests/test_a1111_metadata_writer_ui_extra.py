import os
import sys
import tempfile
import types
import unittest
from unittest import mock

from a1111_metadata_writer.ui import node as node_module


class _FakeArray:
    def __init__(self, shape) -> None:
        self.shape = tuple(shape)

    @property
    def ndim(self) -> int:
        return len(self.shape)

    def __getitem__(self, key):
        if isinstance(key, int):
            return _FakeArray(self.shape[1:])
        if isinstance(key, tuple):
            new_shape = []
            for index, part in enumerate(key):
                size = self.shape[index]
                if isinstance(part, slice):
                    start, stop, step = part.indices(size)
                    new_shape.append(len(range(start, stop, step)))
                elif isinstance(part, int):
                    continue
            if len(key) < len(self.shape):
                new_shape.extend(self.shape[len(key) :])
            return _FakeArray(new_shape)
        return _FakeArray(self.shape)

    def __mul__(self, _value):
        return self

    def __rmul__(self, _value):
        return self

    def astype(self, _dtype):
        return self


class _FakeNumpy(types.SimpleNamespace):
    float32 = 'float32'
    uint8 = 'uint8'

    @staticmethod
    def _infer_shape(value):
        if isinstance(value, list):
            if not value:
                return (0,)
            if isinstance(value[0], list):
                return (len(value),) + _FakeNumpy._infer_shape(value[0])
            return (len(value),)
        return ()

    @staticmethod
    def array(value, dtype=None):
        _ = dtype
        return _FakeArray(_FakeNumpy._infer_shape(value))

    @staticmethod
    def clip(array, _min_value, _max_value):
        return array


class _TensorLike:
    def __init__(self, data) -> None:
        self.data = data
        self.called = {'detach': False, 'cpu': False, 'numpy': False}

    def detach(self):
        self.called['detach'] = True
        return self

    def cpu(self):
        self.called['cpu'] = True
        return self

    def numpy(self):
        self.called['numpy'] = True
        return self.data


class _DummyPilImage:
    def __init__(self) -> None:
        self.size = (32, 32)
        self.saved = None

    def save(self, path, pnginfo=None):
        self.saved = (path, pnginfo)


class A1111MetadataWriterUiExtraTest(unittest.TestCase):
    def test_default_image_path_exception(self) -> None:
        modules_backup = dict(sys.modules)
        try:
            sys.modules['folder_paths'] = types.SimpleNamespace(
                get_output_directory=mock.Mock(side_effect=RuntimeError('boom'))
            )
            self.assertEqual(node_module._default_image_path(), '')
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)

    def test_build_preview_payload_commonpath_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module.os.path,
                'commonpath',
                side_effect=ValueError('bad'),
            ):
                self.assertIsNone(node_module._build_preview_payload(output_path))

    def test_build_preview_payload_parent_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module.os.path,
                'relpath',
                return_value=os.path.join('..', 'image.png'),
            ):
                self.assertIsNone(node_module._build_preview_payload(output_path))

    def test_build_preview_payload_missing_filename(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, 'image.png')
            with open(output_path, 'wb') as file:
                file.write(b'')
            with mock.patch.object(node_module, '_default_image_path', return_value=temp_dir), mock.patch.object(
                node_module.os.path,
                'split',
                return_value=('nested', ''),
            ):
                self.assertIsNone(node_module._build_preview_payload(output_path))

    def test_build_preview_payload_empty_path(self) -> None:
        self.assertIsNone(node_module._build_preview_payload(''))

    def test_resolve_overwrite_prefix_without_prefix(self) -> None:
        prompt = {
            '1': 'not-a-dict',
            '2': {'class_type': 'SaveImage', 'inputs': {}},
        }
        self.assertEqual(node_module._resolve_overwrite_prefix(prompt), 'ComfyUI')

    def test_find_latest_output_path_not_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, 'file.txt')
            with open(file_path, 'wb') as file:
                file.write(b'')
            self.assertEqual(node_module._find_latest_output_path(file_path, 'ComfyUI'), '')

    def test_find_latest_output_path_invalid_counter(self) -> None:
        class DummyMatch:
            def group(self, _index):
                return 'bad'

        class DummyPattern:
            def match(self, _name):
                return DummyMatch()

        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(node_module.os.path, 'isdir', return_value=True), mock.patch.object(
                node_module.os,
                'listdir',
                return_value=['ComfyUI_abc_.png'],
            ), mock.patch.object(node_module.re, 'compile', return_value=DummyPattern()):
                self.assertEqual(node_module._find_latest_output_path(temp_dir, 'ComfyUI'), '')

    def test_get_save_image_path_uses_folder_paths(self) -> None:
        modules_backup = dict(sys.modules)
        try:
            sys.modules['folder_paths'] = types.SimpleNamespace(
                get_save_image_path=lambda *_args, **_kwargs: ('/tmp', 'file', 1, '', 'prefix')
            )
            result = node_module._get_save_image_path('prefix', '/tmp', 1, 2)
            self.assertEqual(result, ('/tmp', 'file', 1, '', 'prefix'))
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)

    def test_image_to_pil_uses_tensor_methods(self) -> None:
        captured = {}

        class FakeImageModule(types.SimpleNamespace):
            @staticmethod
            def fromarray(array):
                captured['array'] = array
                return 'pil-image'

        modules_backup = dict(sys.modules)
        try:
            sys.modules['numpy'] = _FakeNumpy()
            pil_module = types.SimpleNamespace(Image=FakeImageModule())
            sys.modules['PIL'] = pil_module
            sys.modules['PIL.Image'] = pil_module.Image
            data = [[[[0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0]]]]
            tensor = _TensorLike(data)
            result = node_module._image_to_pil(tensor)
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)
        self.assertEqual(result, 'pil-image')
        self.assertEqual(captured['array'].shape, (2, 2, 3))
        self.assertTrue(tensor.called['detach'])
        self.assertTrue(tensor.called['cpu'])
        self.assertTrue(tensor.called['numpy'])

    def test_image_to_pil_invalid_input(self) -> None:
        modules_backup = dict(sys.modules)
        try:
            sys.modules['numpy'] = _FakeNumpy()
            pil_module = types.SimpleNamespace(Image=types.SimpleNamespace(fromarray=lambda _array: 'pil'))
            sys.modules['PIL'] = pil_module
            sys.modules['PIL.Image'] = pil_module.Image
            with self.assertRaises(ValueError):
                node_module._image_to_pil(None)
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)

    def test_image_to_pil_invalid_shape(self) -> None:
        modules_backup = dict(sys.modules)
        try:
            sys.modules['numpy'] = _FakeNumpy()
            pil_module = types.SimpleNamespace(Image=types.SimpleNamespace(fromarray=lambda _array: 'pil'))
            sys.modules['PIL'] = pil_module
            sys.modules['PIL.Image'] = pil_module.Image
            with self.assertRaises(ValueError):
                node_module._image_to_pil([[1, 2], [3, 4]])
        finally:
            sys.modules.clear()
            sys.modules.update(modules_backup)

    def test_apply_returns_empty_when_prompt_missing(self) -> None:
        writer = node_module.A1111MetadataWriter()
        with mock.patch.object(node_module, '_image_to_pil') as image_to_pil:
            result = writer.apply('image', False, '_demo', prompt=None)
        self.assertEqual(result['result'], ('', ''))
        self.assertEqual(result['ui']['images'], [])
        image_to_pil.assert_not_called()

    def test_apply_returns_empty_when_no_parameters(self) -> None:
        writer = node_module.A1111MetadataWriter()
        with mock.patch.object(
            node_module.logic, 'build_a1111_parameters_from_prompt', return_value=''
        ), mock.patch.object(node_module, '_image_to_pil') as image_to_pil:
            result = writer.apply('image', False, '_demo', prompt={'1': {'class_type': 'KSampler'}})
        self.assertEqual(result['result'], ('', ''))
        self.assertEqual(result['ui']['images'], [])
        image_to_pil.assert_not_called()

    def test_apply_uses_output_path_when_not_overwrite(self) -> None:
        writer = node_module.A1111MetadataWriter()
        dummy_image = _DummyPilImage()
        preview = {'filename': 'out.png', 'type': 'output'}
        with mock.patch.object(
            node_module.logic, 'build_a1111_parameters_from_prompt', return_value='params'
        ), mock.patch.object(node_module, '_image_to_pil', return_value=dummy_image), mock.patch.object(
            node_module, '_build_output_path', return_value='/tmp/out.png'
        ) as build_output, mock.patch.object(
            node_module, '_build_overwrite_path'
        ) as build_overwrite, mock.patch.object(
            node_module, '_build_pnginfo', return_value='pnginfo'
        ), mock.patch.object(
            node_module, '_build_preview_payload', return_value=preview
        ):
            result = writer.apply(
                'image',
                False,
                '_demo',
                prompt={'1': {'class_type': 'KSampler', 'inputs': {}}},
            )
        build_output.assert_called_once()
        build_overwrite.assert_not_called()
        self.assertEqual(dummy_image.saved, ('/tmp/out.png', 'pnginfo'))
        self.assertEqual(result['result'], ('params', '/tmp/out.png'))
        self.assertEqual(result['ui']['images'], [preview])

    def test_apply_uses_overwrite_path(self) -> None:
        writer = node_module.A1111MetadataWriter()
        dummy_image = _DummyPilImage()
        preview = {'filename': 'out.png', 'type': 'output'}
        with mock.patch.object(
            node_module.logic, 'build_a1111_parameters_from_prompt', return_value='params'
        ), mock.patch.object(node_module, '_image_to_pil', return_value=dummy_image), mock.patch.object(
            node_module, '_build_output_path'
        ) as build_output, mock.patch.object(
            node_module, '_build_overwrite_path', return_value='/tmp/out.png'
        ) as build_overwrite, mock.patch.object(
            node_module, '_build_pnginfo', return_value='pnginfo'
        ), mock.patch.object(
            node_module, '_build_preview_payload', return_value=preview
        ):
            result = writer.apply(
                'image',
                True,
                '_demo',
                prompt={'1': {'class_type': 'KSampler', 'inputs': {}}},
            )
        build_overwrite.assert_called_once()
        build_output.assert_not_called()
        self.assertEqual(dummy_image.saved, ('/tmp/out.png', 'pnginfo'))
        self.assertEqual(result['result'], ('params', '/tmp/out.png'))
        self.assertEqual(result['ui']['images'], [preview])
