import unittest
from unittest.mock import patch

from image_batch_loader.ui.node import ImageBatchLoader


class ImageBatchLoaderLoadTest(unittest.TestCase):
    def test_load_builds_batch(self) -> None:
        node = ImageBatchLoader()
        with patch('image_batch_loader.ui.node.list_image_files', return_value=['a', 'b']) as list_files, patch(
            'image_batch_loader.ui.node.load_images',
            return_value=['img1', 'img2'],
        ) as load_images, patch(
            'image_batch_loader.ui.node.select_same_size_images',
            return_value=['img1'],
        ) as select_same, patch(
            'image_batch_loader.ui.node.build_image_batch',
            return_value='batch',
        ) as build_batch:
            (batch,) = node.load('dir', 'filter')

        self.assertEqual(batch, 'batch')
        list_files.assert_called_once()
        load_images.assert_called_once()
        select_same.assert_called_once()
        build_batch.assert_called_once()


if __name__ == '__main__':
    unittest.main()
