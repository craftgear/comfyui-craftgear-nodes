import os
import tempfile
import unittest

from image_batch_loader.logic.image_loader import list_image_files


class ImageListPathTest(unittest.TestCase):
    def test_lists_supported_files_in_name_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            paths = [
                os.path.join(temp_dir, 'b.jpg'),
                os.path.join(temp_dir, 'a.png'),
                os.path.join(temp_dir, 'c.webp'),
                os.path.join(temp_dir, 'skip.txt'),
            ]
            for path in paths:
                with open(path, 'wb') as handle:
                    handle.write(b'data')

            nested_dir = os.path.join(temp_dir, 'nested')
            os.makedirs(nested_dir, exist_ok=True)
            nested_path = os.path.join(nested_dir, 'nested.png')
            with open(nested_path, 'wb') as handle:
                handle.write(b'data')

            result = list_image_files(temp_dir)

            expected = [
                os.path.join(temp_dir, 'a.png'),
                os.path.join(temp_dir, 'b.jpg'),
                os.path.join(temp_dir, 'c.webp'),
            ]
            self.assertEqual(result, expected)

    def test_filters_by_regex_case_insensitive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            paths = [
                os.path.join(temp_dir, 'cat.png'),
                os.path.join(temp_dir, 'CAT.jpg'),
                os.path.join(temp_dir, 'dog.webp'),
            ]
            for path in paths:
                with open(path, 'wb') as handle:
                    handle.write(b'data')

            result = list_image_files(temp_dir, filter_pattern='cat')

            expected = [
                os.path.join(temp_dir, 'CAT.jpg'),
                os.path.join(temp_dir, 'cat.png'),
            ]
            self.assertEqual(result, expected)

    def test_invalid_regex_returns_all(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            paths = [
                os.path.join(temp_dir, 'a.png'),
                os.path.join(temp_dir, 'b.jpg'),
            ]
            for path in paths:
                with open(path, 'wb') as handle:
                    handle.write(b'data')

            result = list_image_files(temp_dir, filter_pattern='[')

            expected = [
                os.path.join(temp_dir, 'a.png'),
                os.path.join(temp_dir, 'b.jpg'),
            ]
            self.assertEqual(result, expected)

    def test_returns_empty_for_missing_dir(self) -> None:
        result = list_image_files('/missing/dir/for/tests')
        self.assertEqual(result, [])


if __name__ == '__main__':
    unittest.main()
