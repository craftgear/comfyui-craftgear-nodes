import os
import tempfile
import unittest

from load_loras_with_tags.logic.lora_preview import (
    DEFAULT_IMAGE_EXTENSIONS,
    select_lora_preview_path,
)


class LoraPreviewSelectionTest(unittest.TestCase):
    def _touch(self, path: str) -> None:
        with open(path, "wb") as file:
            file.write(b"")

    def test_returns_none_when_no_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "alpha.safetensors")
            self._touch(lora_path)
            result = select_lora_preview_path(lora_path, DEFAULT_IMAGE_EXTENSIONS)
            self.assertIsNone(result)

    def test_returns_none_when_path_missing(self) -> None:
        self.assertIsNone(select_lora_preview_path('', DEFAULT_IMAGE_EXTENSIONS))

    def test_returns_none_when_base_dir_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "alpha.safetensors")
            self._touch(lora_path)
            original_isdir = os.path.isdir
            try:
                os.path.isdir = lambda _path: False
                self.assertIsNone(select_lora_preview_path(lora_path, DEFAULT_IMAGE_EXTENSIONS))
            finally:
                os.path.isdir = original_isdir

    def test_returns_none_when_base_name_empty(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = f"{temp_dir}{os.sep}"
            self.assertIsNone(select_lora_preview_path(path, DEFAULT_IMAGE_EXTENSIONS))

    def test_prefers_base_match_and_preview_hint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "alpha.safetensors")
            self._touch(lora_path)
            image_a = os.path.join(temp_dir, "alpha.jpg")
            image_b = os.path.join(temp_dir, "alpha_preview.png")
            image_c = os.path.join(temp_dir, "beta.png")
            for path in (image_a, image_b, image_c):
                self._touch(path)
            result = select_lora_preview_path(lora_path, DEFAULT_IMAGE_EXTENSIONS)
            self.assertEqual(result, image_b)

    def test_prefers_base_match_over_non_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "alpha.safetensors")
            self._touch(lora_path)
            image_a = os.path.join(temp_dir, "alpha.webp")
            image_b = os.path.join(temp_dir, "beta_thumb.png")
            for path in (image_a, image_b):
                self._touch(path)
            result = select_lora_preview_path(lora_path, DEFAULT_IMAGE_EXTENSIONS)
            self.assertEqual(result, image_a)

    def test_prefers_preview_hint_when_no_base_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "alpha.safetensors")
            self._touch(lora_path)
            image_a = os.path.join(temp_dir, "beta.png")
            image_b = os.path.join(temp_dir, "gamma_thumb.jpg")
            for path in (image_a, image_b):
                self._touch(path)
            result = select_lora_preview_path(lora_path, DEFAULT_IMAGE_EXTENSIONS)
            self.assertEqual(result, image_b)
