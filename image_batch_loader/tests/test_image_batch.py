import sys
import types
import unittest

try:
    import torch
except ModuleNotFoundError:
    torch = None

if torch is None:
    class _FakeTensor:
        def __init__(self, shape: tuple[int, int, int, int]) -> None:
            self.shape = shape

    def _fake_zeros(shape, dtype=None):
        _ = dtype
        return _FakeTensor(tuple(shape))

    def _fake_cat(tensors, dim=0):
        base_shape = list(tensors[0].shape)
        base_shape[dim] = sum(tensor.shape[dim] for tensor in tensors)
        return _FakeTensor(tuple(base_shape))

    torch = types.SimpleNamespace(float32='float32', zeros=_fake_zeros, cat=_fake_cat)
    sys.modules['torch'] = torch

from image_batch_loader.logic.image_loader import build_image_batch, select_same_size_images


class ImageBatchTest(unittest.TestCase):
    def test_select_same_size_images_uses_first_image(self) -> None:
        first = torch.zeros((1, 64, 64, 3))
        same = torch.zeros((1, 64, 64, 3))
        other = torch.zeros((1, 32, 32, 3))

        result = select_same_size_images([first, same, other])

        self.assertEqual(result, [first, same])

    def test_build_image_batch_returns_empty_for_no_images(self) -> None:
        result = build_image_batch([])

        self.assertEqual(tuple(result.shape), (0, 0, 0, 3))

    def test_build_image_batch_concats_same_size(self) -> None:
        first = torch.zeros((1, 64, 64, 3))
        same = torch.zeros((1, 64, 64, 3))

        result = build_image_batch([first, same])

        self.assertEqual(tuple(result.shape), (2, 64, 64, 3))


if __name__ == '__main__':
    unittest.main()
