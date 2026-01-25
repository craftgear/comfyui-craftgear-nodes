import struct
import unittest
import zlib

from a1111_metadata_writer.logic import a1111_metadata as logic
from a1111_metadata_writer.tests.test_a1111_metadata_writer import build_prompt


class A1111MetadataWriterLogicMoreTest(unittest.TestCase):
    def test_iter_png_chunks_truncated(self) -> None:
        data = logic.PNG_SIGNATURE + struct.pack('>I', 10) + b'IHDR' + b'1234'
        self.assertEqual(logic._iter_png_chunks(data), [])

    def test_read_chunk_key_variants(self) -> None:
        self.assertEqual(logic._read_chunk_key(b'tEXt', b'key\x00value'), 'key')
        itxt = b'key\x00' + b'\x00\x00\x00\x00\x00' + b'text'
        self.assertEqual(logic._read_chunk_key(b'iTXt', itxt), 'key')
        ztxt = b'key\x00\x00' + zlib.compress(b'text')
        self.assertEqual(logic._read_chunk_key(b'zTXt', ztxt), 'key')
        self.assertEqual(logic._read_chunk_key(b'IHDR', b''), '')

    def test_resolve_node_output_uses_cache(self) -> None:
        cache = {'1': 'cached'}
        self.assertEqual(logic._resolve_node_output('1', {}, cache), 'cached')

    def test_build_parameters_with_invalid_denoise(self) -> None:
        prompt = build_prompt()
        prompt['5']['inputs']['denoise'] = 'bad'
        text = logic.build_a1111_parameters_from_prompt(prompt)
        self.assertNotIn('Denoising strength', text)
