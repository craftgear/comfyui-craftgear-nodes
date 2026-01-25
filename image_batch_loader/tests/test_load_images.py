import importlib
import os
import sys
import tempfile
import types
import unittest


class _FakeArray:
    def astype(self, _dtype):
        return self

    def __truediv__(self, _value):
        return self


class _FakeNumpy(types.SimpleNamespace):
    float32 = 'float32'

    @staticmethod
    def array(_value):
        return _FakeArray()


class _FakeTensor:
    def __init__(self, source) -> None:
        self.source = source

    def __getitem__(self, _key):
        return self


class _FakeTorch(types.SimpleNamespace):
    @staticmethod
    def from_numpy(array):
        return _FakeTensor(array)


class _FakeImage:
    def __init__(self, mode: str) -> None:
        self.mode = mode
        self.point_called = False

    def point(self, _fn):
        self.point_called = True
        return self

    def convert(self, _mode: str):
        self.mode = _mode
        return self


class _FakeImageModule(types.SimpleNamespace):
    @staticmethod
    def open(path: str):
        if path.endswith('bad.png'):
            raise OSError('bad file')
        if path.endswith('int.png'):
            return _FakeImage('I')
        return _FakeImage('RGB')


class _FakeImageOps(types.SimpleNamespace):
    @staticmethod
    def exif_transpose(image):
        return image


class _FakeNodeHelpers(types.SimpleNamespace):
    @staticmethod
    def pillow(fn, *args):
        return fn(*args)


class LoadImagesTest(unittest.TestCase):
    def test_load_images_with_mocks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            paths = [
                os.path.join(temp_dir, 'good.png'),
                os.path.join(temp_dir, 'int.png'),
                os.path.join(temp_dir, 'bad.png'),
            ]
            for path in paths:
                with open(path, 'wb') as file:
                    file.write(b'')

            modules_backup = dict(sys.modules)
            try:
                sys.modules['node_helpers'] = _FakeNodeHelpers()
                sys.modules['numpy'] = _FakeNumpy()
                sys.modules['torch'] = _FakeTorch()
                pil_module = types.SimpleNamespace(
                    Image=_FakeImageModule(),
                    ImageOps=_FakeImageOps(),
                )
                sys.modules['PIL'] = pil_module
                sys.modules['PIL.Image'] = pil_module.Image
                sys.modules['PIL.ImageOps'] = pil_module.ImageOps
                if 'image_batch_loader.logic.image_loader' in sys.modules:
                    del sys.modules['image_batch_loader.logic.image_loader']
                image_loader = importlib.import_module('image_batch_loader.logic.image_loader')

                images = image_loader.load_images(paths)

                self.assertEqual(len(images), 2)
                self.assertTrue(all(isinstance(image, _FakeTensor) for image in images))
            finally:
                sys.modules.clear()
                sys.modules.update(modules_backup)


if __name__ == '__main__':
    unittest.main()
