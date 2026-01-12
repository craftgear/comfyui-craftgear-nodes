import unittest

from image_batch_loader.ui.node import ImageBatchLoader


class ImageBatchLoaderOutputsTest(unittest.TestCase):
    def test_returns_single_batch_output(self) -> None:
        self.assertEqual(ImageBatchLoader.RETURN_TYPES, ('IMAGE',))
        self.assertEqual(ImageBatchLoader.RETURN_NAMES, ('batch',))


if __name__ == '__main__':
    unittest.main()
