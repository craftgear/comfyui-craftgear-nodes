import math
import sys
import types
import unittest
from unittest import mock


class FakeTensor:
    def __init__(self, data=None, shape=None, device='cpu', dtype='float') -> None:
        self.data = data
        self.device = device
        self.dtype = dtype
        if shape is None:
            self.shape = self._infer_shape(data)
        else:
            self.shape = tuple(shape)

    @staticmethod
    def _infer_shape(data):
        if data is None:
            return ()
        if isinstance(data, list):
            if not data:
                return (0,)
            if isinstance(data[0], list):
                return (len(data),) + FakeTensor._infer_shape(data[0])
            return (len(data),)
        return ()

    def dim(self):
        return len(self.shape)

    def size(self):
        return self.shape

    def permute(self, *dims):
        new_shape = tuple(self.shape[index] for index in dims)
        return FakeTensor(shape=new_shape, device=self.device, dtype=self.dtype)

    def mean(self):
        if not isinstance(self.data, list) or not self.data:
            return 0.0
        return sum(self.data) / len(self.data)

    def abs(self):
        if not isinstance(self.data, list):
            return FakeTensor(data=[], device=self.device, dtype=self.dtype)
        return FakeTensor(data=[abs(value) for value in self.data], device=self.device, dtype=self.dtype)

    def max(self):
        if not isinstance(self.data, list) or not self.data:
            return 0.0
        return max(self.data)

    def _apply_op(self, other, op):
        if isinstance(other, FakeTensor):
            data = [op(a, b) for a, b in zip(self.data, other.data)]
        else:
            data = [op(a, other) for a in self.data]
        return FakeTensor(data=data, device=self.device, dtype=self.dtype)

    def __add__(self, other):
        return self._apply_op(other, lambda a, b: a + b)

    def __radd__(self, other):
        return self.__add__(other)

    def __sub__(self, other):
        return self._apply_op(other, lambda a, b: a - b)

    def __rsub__(self, other):
        if isinstance(other, FakeTensor):
            return other.__sub__(self)
        data = [other - value for value in self.data]
        return FakeTensor(data=data, device=self.device, dtype=self.dtype)

    def __mul__(self, other):
        return self._apply_op(other, lambda a, b: a * b)

    def __rmul__(self, other):
        return self.__mul__(other)

    def __neg__(self):
        return FakeTensor(data=[-value for value in self.data], device=self.device, dtype=self.dtype)

    def __truediv__(self, other):
        return self._apply_op(other, lambda a, b: a / b)

    def __getitem__(self, key):
        if isinstance(key, tuple):
            new_shape = []
            for index, item in enumerate(key):
                size = self.shape[index]
                if isinstance(item, slice):
                    start, stop, step = item.indices(size)
                    new_shape.append(len(range(start, stop, step)))
                elif isinstance(item, int):
                    continue
            if len(key) < len(self.shape):
                new_shape.extend(self.shape[len(key):])
            return FakeTensor(shape=tuple(new_shape), device=self.device, dtype=self.dtype)
        if isinstance(self.data, list):
            return self.data[key]
        raise TypeError('Invalid index')

    def __setitem__(self, key, value):
        if isinstance(key, int):
            self.data[key] = value
            return
        if isinstance(key, tuple) and len(key) == 3:
            batch = self.shape[0]
            row = key[1]
            col = key[2]
            values = value.data if isinstance(value, FakeTensor) else [value] * batch
            for index in range(batch):
                self.data[index][row][col] = values[index]
            return
        raise TypeError('Invalid index')


class FakeTorchModule(types.SimpleNamespace):
    def __init__(self) -> None:
        super().__init__()
        self.device = object
        self.dtype = object

    @staticmethod
    def randn(length, device=None):
        return FakeTensor(data=[0.0] * length, device=device)

    @staticmethod
    def zeros_like(tensor):
        return FakeTensor(data=[0.0] * len(tensor.data), device=tensor.device, dtype=tensor.dtype)

    @staticmethod
    def zeros(shape, device=None, dtype=None):
        def build(level):
            if level == len(shape) - 1:
                return [0.0] * shape[level]
            return [build(level + 1) for _ in range(shape[level])]

        return FakeTensor(data=build(0), shape=shape, device=device, dtype=dtype)

    @staticmethod
    def cos(tensor):
        return FakeTensor(data=[math.cos(value) for value in tensor.data], device=tensor.device, dtype=tensor.dtype)

    @staticmethod
    def sin(tensor):
        return FakeTensor(data=[math.sin(value) for value in tensor.data], device=tensor.device, dtype=tensor.dtype)


class FakeFunctional(types.SimpleNamespace):
    @staticmethod
    def interpolate(tensor, size, mode='bilinear', align_corners=False):
        batch, channels, _height, _width = tensor.shape
        return FakeTensor(shape=(batch, channels, size[0], size[1]), device=tensor.device, dtype=tensor.dtype)

    @staticmethod
    def pad(tensor, pad, mode='replicate'):
        left, right, top, bottom = pad
        batch, channels, height, width = tensor.shape
        return FakeTensor(
            shape=(batch, channels, height + top + bottom, width + left + right),
            device=tensor.device,
            dtype=tensor.dtype,
        )

    @staticmethod
    def affine_grid(theta, size, align_corners=False):
        _ = theta
        return FakeTensor(shape=size, device=None, dtype=None)

    @staticmethod
    def grid_sample(input_tensor, grid, mode='bilinear', padding_mode='zeros', align_corners=False):
        _ = grid
        _ = mode
        _ = padding_mode
        _ = align_corners
        return input_tensor


class CameraShakeNodeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.modules_backup = dict(sys.modules)
        fake_torch = FakeTorchModule()
        fake_f = FakeFunctional()
        torch_nn = types.ModuleType('torch.nn')
        torch_nn.functional = fake_f
        fake_torch.nn = torch_nn
        sys.modules['torch'] = fake_torch
        sys.modules['torch.nn'] = torch_nn
        sys.modules['torch.nn.functional'] = fake_f
        sys.modules.pop('camera_shake.camera_shake_node', None)
        from camera_shake import camera_shake_node

        self.node_module = camera_shake_node
        self.fake_torch = fake_torch
        self.fake_f = fake_f

    def tearDown(self) -> None:
        sys.modules.clear()
        sys.modules.update(self.modules_backup)

    def _make_images(self, batch=2, height=8, width=6, channels=3):
        return FakeTensor(shape=(batch, height, width, channels), device='cpu', dtype='float')

    def test_generate_smooth_series_normalized(self) -> None:
        self.node_module.torch.randn = lambda length, device=None: FakeTensor(
            data=[1.0, -1.0, 0.5],
            device=device,
        )
        result = self.node_module.generate_smooth_series(3, device='cpu')
        max_abs = max(abs(value) for value in result.data)
        mean = sum(result.data) / len(result.data)
        self.assertAlmostEqual(max_abs, 1.0)
        self.assertAlmostEqual(mean, 0.0)

    def test_generate_smooth_series_zero(self) -> None:
        self.node_module.torch.randn = lambda length, device=None: FakeTensor(
            data=[0.0] * length,
            device=device,
        )
        result = self.node_module.generate_smooth_series(2, device='cpu')
        self.assertEqual(result.data, [0.0, 0.0])

    def test_build_transform_theta(self) -> None:
        self.node_module.torch.randn = lambda length, device=None: FakeTensor(
            data=[0.0] * length,
            device=device,
        )
        theta = self.node_module.build_transform(
            batch=2,
            width=4,
            height=4,
            strength=1.0,
            rot_base=10.0,
            move_x=1.0,
            move_y=1.0,
            scale=1.0,
            device='cpu',
            dtype='float',
        )
        self.assertAlmostEqual(theta.data[0][0][0], 1.0)
        self.assertAlmostEqual(theta.data[0][0][1], 0.0)
        self.assertAlmostEqual(theta.data[0][1][0], 0.0)
        self.assertAlmostEqual(theta.data[0][1][1], 1.0)
        self.assertAlmostEqual(theta.data[0][0][2], 0.0)
        self.assertAlmostEqual(theta.data[0][1][2], 0.0)

    def test_crop_and_resize_returns_input(self) -> None:
        images = FakeTensor(shape=(1, 3, 4, 4), device='cpu', dtype='float')
        self.assertIs(self.node_module.crop_and_resize(images, 0, 4, 4), images)
        self.assertIs(self.node_module.crop_and_resize(images, 3, 4, 4), images)

    def test_crop_and_resize_resizes(self) -> None:
        images = FakeTensor(shape=(1, 3, 6, 6), device='cpu', dtype='float')
        result = self.node_module.crop_and_resize(images, 1, 4, 4)
        self.assertEqual(result.shape, (1, 3, 4, 4))

    def test_pad_images_returns_input(self) -> None:
        images = FakeTensor(shape=(1, 3, 4, 4), device='cpu', dtype='float')
        self.assertIs(self.node_module.pad_images(images, 0), images)

    def test_pad_images_adds_padding(self) -> None:
        images = FakeTensor(shape=(1, 3, 4, 4), device='cpu', dtype='float')
        result = self.node_module.pad_images(images, 2)
        self.assertEqual(result.shape, (1, 3, 8, 8))

    def test_apply_invalid_dim(self) -> None:
        images = FakeTensor(shape=(1, 3, 4), device='cpu', dtype='float')
        with self.assertRaises(ValueError):
            self.node_module.CameraShakeNode().apply(images, 1.0, '1_scale')

    def test_apply_strength_zero(self) -> None:
        images = self._make_images()
        output = self.node_module.CameraShakeNode().apply(images, 0.0, '1_scale')
        self.assertIs(output[0], images)

    def test_apply_batch_zero(self) -> None:
        images = self._make_images(batch=0)
        output = self.node_module.CameraShakeNode().apply(images, 1.0, '1_scale')
        self.assertIs(output[0], images)

    def test_apply_prepad_branch(self) -> None:
        images = self._make_images(batch=1, height=5, width=4, channels=3)
        plan = {
            'rot_base': 0.0,
            'move_x': 0.0,
            'move_y': 0.0,
            'margin_px': 1,
            'use_prepad': True,
            'scale': 1.0,
            'padding_mode': 'zeros',
            'use_crop': False,
        }
        with mock.patch.object(self.node_module, 'build_transform_plan', return_value=plan):
            output = self.node_module.CameraShakeNode().apply(images, 1.0, '3_prepad')
        self.assertEqual(output[0].shape, images.shape)

    def test_apply_crop_branch(self) -> None:
        images = self._make_images(batch=1, height=6, width=4, channels=3)
        plan = {
            'rot_base': 0.0,
            'move_x': 0.0,
            'move_y': 0.0,
            'margin_px': 1,
            'use_prepad': False,
            'scale': 1.0,
            'padding_mode': 'zeros',
            'use_crop': True,
        }
        with mock.patch.object(self.node_module, 'build_transform_plan', return_value=plan):
            output = self.node_module.CameraShakeNode().apply(images, 1.0, '2_crop')
        self.assertEqual(output[0].shape, images.shape)
