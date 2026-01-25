import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from load_loras_with_tags.logic.lora_catalog import collect_lora_names


class LoraCatalogTest(unittest.TestCase):
    def test_collect_lora_names_filters_and_recursive(self) -> None:
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / 'a.safetensors').write_text('x')
            (base / 'b.txt').write_text('x')
            sub = base / 'sub'
            sub.mkdir()
            (sub / 'c.safetensors').write_text('x')

            result = collect_lora_names([str(base)], {'.safetensors', '.pt'})

            self.assertEqual(
                result,
                ['a.safetensors', os.path.join('sub', 'c.safetensors')],
            )

    def test_collect_lora_names_merges_dirs_and_dedupes(self) -> None:
        with TemporaryDirectory() as tmp1, TemporaryDirectory() as tmp2:
            base1 = Path(tmp1)
            base2 = Path(tmp2)
            (base1 / 'a.safetensors').write_text('x')
            (base2 / 'a.safetensors').write_text('x')
            (base2 / 'b.pt').write_text('x')

            result = collect_lora_names([str(base1), str(base2)], {'.safetensors', '.pt'})

            self.assertEqual(result, ['a.safetensors', 'b.pt'])

    def test_collect_lora_names_skips_non_dirs(self) -> None:
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            file_path = base / 'file.txt'
            file_path.write_text('x')
            result = collect_lora_names([str(file_path)], {'.safetensors'})
            self.assertEqual(result, [])

    def test_collect_lora_names_skips_non_files(self) -> None:
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / 'a.safetensors').write_text('x')
            original_isfile = os.path.isfile
            try:
                os.path.isfile = lambda _path: False
                result = collect_lora_names([str(base)], {'.safetensors'})
                self.assertEqual(result, [])
            finally:
                os.path.isfile = original_isfile
