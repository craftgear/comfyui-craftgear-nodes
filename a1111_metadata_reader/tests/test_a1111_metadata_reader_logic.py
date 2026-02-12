import json
import struct
import tempfile
import unittest
import zlib

from a1111_metadata_reader.logic import metadata_parser as logic

try:
    from PIL import Image
    from PIL import PngImagePlugin
except Exception:
    Image = None
    PngImagePlugin = None


class TestA1111WebpMetadataReaderLogic(unittest.TestCase):
    def test_read_metadata_text_extracts_webp_user_comment(self) -> None:
        parameters = (
            'best quality, 1girl\n'
            'Negative prompt: low quality\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 123, Size: 512x768, Clip skip: 2'
        )
        data = _build_webp_with_user_comment(parameters)
        with tempfile.NamedTemporaryFile(suffix='.webp') as tmp:
            tmp.write(data)
            tmp.flush()
            text = logic.read_metadata_text(tmp.name)
        self.assertIn('Negative prompt:', text)
        self.assertIn('Steps:', text)

    def test_read_metadata_text_extracts_png_parameters(self) -> None:
        if Image is None or PngImagePlugin is None:
            self.skipTest('Pillow is required')
        parameters = (
            'best quality, 1girl\n'
            'Negative prompt: low quality\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 123, Size: 512x768, Clip skip: 2'
        )
        pnginfo = PngImagePlugin.PngInfo()
        pnginfo.add_text('parameters', parameters)

        with tempfile.NamedTemporaryFile(suffix='.png') as tmp:
            image = Image.new('RGB', (1, 1), (255, 255, 255))
            image.save(tmp.name, pnginfo=pnginfo)
            text = logic.read_metadata_text(tmp.name)

        self.assertEqual(text, parameters)

    def test_read_metadata_text_extracts_png_extparameters(self) -> None:
        if Image is None or PngImagePlugin is None:
            self.skipTest('Pillow is required')
        parameters = (
            'best quality, 1girl, <lora:foo:1>\n'
            'Negative prompt: low quality\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 123, Size: 512x768, Clip skip: 2'
        )
        pnginfo = PngImagePlugin.PngInfo()
        pnginfo.add_text('Extparameters', parameters)

        with tempfile.NamedTemporaryFile(suffix='.png') as tmp:
            image = Image.new('RGB', (1, 1), (255, 255, 255))
            image.save(tmp.name, pnginfo=pnginfo)
            text = logic.read_metadata_text(tmp.name)

        self.assertEqual(text, parameters)

    def test_read_metadata_text_extracts_jpg_exif_user_comment(self) -> None:
        if Image is None:
            self.skipTest('Pillow is required')
        parameters = (
            'best quality, 1girl\n'
            'Negative prompt: low quality\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 123, Size: 512x768, Clip skip: 2'
        )
        user_comment = b'ASCII\x00\x00\x00' + parameters.encode('utf-8')
        exif = Image.Exif()
        exif[37510] = user_comment

        with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
            image = Image.new('RGB', (1, 1), (255, 255, 255))
            image.save(tmp.name, exif=exif)
            text = logic.read_metadata_text(tmp.name)

        self.assertEqual(text, parameters)

    def test_read_metadata_text_extracts_png_parameters_without_pillow(self) -> None:
        parameters = (
            'best quality, 1girl, <lora:test:1>\n'
            'Negative prompt: low quality\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 123, Size: 512x768, Clip skip: 2'
        )
        original_image = logic.Image
        logic.Image = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.png') as tmp:
                tmp.write(_build_png_with_text_chunk('parameters', parameters))
                tmp.flush()
                text = logic.read_metadata_text(tmp.name)
        finally:
            logic.Image = original_image

        self.assertEqual(text, parameters)

    def test_read_metadata_text_extracts_jpg_exif_without_pillow(self) -> None:
        parameters = (
            'best quality, 1girl\n'
            'Negative prompt: low quality\n'
            'Steps: 28, Sampler: Euler, CFG scale: 6, Seed: 999, Size: 512x512, Clip skip: 2'
        )
        user_comment = b'ASCII\x00\x00\x00' + parameters.encode('utf-8')
        original_image = logic.Image
        logic.Image = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.jpg') as tmp:
                tmp.write(_build_jpeg_with_exif_user_comment(user_comment))
                tmp.flush()
                text = logic.read_metadata_text(tmp.name)
        finally:
            logic.Image = original_image

        self.assertEqual(text, parameters)

    def test_parse_parameters_extracts_target_fields(self) -> None:
        resources = [
            {'type': 'checkpoint', 'modelName': 'XAVIER', 'modelVersionId': 98765},
            {'type': 'lora', 'modelName': 'Real Skin Slider', 'modelVersionId': 11111},
            {'type': 'lora', 'modelName': 'Better Faces LoRA', 'modelVersionId': 22222},
        ]
        parameters = (
            'best quality, 1girl\n'
            'Negative prompt: low quality\n'
            f'Steps: 29, Sampler: DPM++ 2M Karras, CFG scale: 3.5, Seed: 1434303310, Model hash: abcdef12, '
            f'Lora hashes: Real Skin Slider: 11223344, Better Faces LoRA: deadbeef, '
            f'Size: 832x1216, Clip skip: 2, Civitai resources: {json.dumps(resources)}'
        )

        parsed = logic.parse_a1111_parameters(parameters)

        self.assertEqual(parsed['positive_prompt'], 'best quality, 1girl')
        self.assertEqual(parsed['negative_prompt'], 'low quality')
        self.assertEqual(
            parsed['model'],
            json.dumps({'name': 'XAVIER', 'hash': 'abcdef12', 'modelVersionId': '98765'}),
        )
        self.assertEqual(
            parsed['loras'],
            json.dumps(
                [
                    {'name': 'Real Skin Slider', 'hash': '11223344', 'modelVersionId': '11111'},
                    {'name': 'Better Faces LoRA', 'hash': 'deadbeef', 'modelVersionId': '22222'},
                ]
            ),
        )
        self.assertEqual(parsed['steps'], 29)
        self.assertEqual(parsed['sampler'], 'DPM++ 2M Karras')
        self.assertEqual(parsed['cfg_scale'], 3.5)
        self.assertEqual(parsed['seed'], 1434303310)
        self.assertEqual(parsed['size'], '832x1216')
        self.assertEqual(parsed['clip_skip'], 2)
        self.assertEqual(parsed['raw_parameters'], parameters)

    def test_parse_parameters_prefers_model_field(self) -> None:
        parameters = (
            'p\n'
            'Negative prompt: n\n'
            'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 1, Size: 512x512, Model: myModel, Model hash: ff00aa11'
        )
        parsed = logic.parse_a1111_parameters(parameters)
        self.assertEqual(
            parsed['model'],
            json.dumps({'name': 'myModel', 'hash': 'ff00aa11', 'modelVersionId': ''}),
        )

    def test_parse_parameters_handles_empty_text(self) -> None:
        parsed = logic.parse_a1111_parameters('')

        self.assertEqual(parsed['positive_prompt'], '')
        self.assertEqual(parsed['negative_prompt'], '')
        self.assertEqual(parsed['model'], json.dumps({'name': '', 'hash': '', 'modelVersionId': ''}))
        self.assertEqual(parsed['loras'], '[]')
        self.assertEqual(parsed['steps'], 0)
        self.assertEqual(parsed['sampler'], '')
        self.assertEqual(parsed['cfg_scale'], 0.0)
        self.assertEqual(parsed['seed'], 0)
        self.assertEqual(parsed['size'], '')
        self.assertEqual(parsed['clip_skip'], 0)
        self.assertEqual(parsed['raw_parameters'], '')

    def test_parse_parameters_handles_missing_lora_hashes(self) -> None:
        resources = [
            {'type': 'lora', 'modelName': 'Only Name LoRA', 'modelVersionID': 33333},
        ]
        parameters = (
            'p\n'
            'Negative prompt: n\n'
            f'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 1, Size: 512x512, Civitai resources: {json.dumps(resources)}'
        )
        parsed = logic.parse_a1111_parameters(parameters)
        self.assertEqual(
            parsed['loras'],
            json.dumps([{'name': 'Only Name LoRA', 'hash': '', 'modelVersionId': '33333'}]),
        )

    def test_parse_parameters_extracts_loras_from_tags_and_hashes(self) -> None:
        parameters = (
            'best quality, 1girl, <lora:foo-bar:1>, <lora:baz_qux:0.6>\n'
            'Negative prompt: low quality\n'
            'Steps: 24, Sampler: Euler a SDE, CFG scale: 6, Seed: 511288647974664, Size: 640x1024, '
            'Scheduler: beta, Hashes: {"lora:foo-bar": "aabbccdd", "lora:baz_qux": "eeff0011"}'
        )
        parsed = logic.parse_a1111_parameters(parameters)
        self.assertEqual(
            parsed['loras'],
            json.dumps(
                [
                    {'name': 'foo-bar', 'hash': 'aabbccdd', 'modelVersionId': ''},
                    {'name': 'baz_qux', 'hash': 'eeff0011', 'modelVersionId': ''},
                ]
            ),
        )


if __name__ == '__main__':
    unittest.main()


def _build_webp_with_user_comment(user_comment_text: str) -> bytes:
    comment_payload = b'UNICODE\x00' + user_comment_text.encode('utf-16le')
    tiff = _build_tiff_with_user_comment(comment_payload)
    exif_chunk = _riff_chunk(b'EXIF', tiff)
    vp8x_payload = bytearray(10)
    vp8x_payload[0] = 0b00001000
    vp8x_payload[4:7] = (1).to_bytes(3, 'little')
    vp8x_payload[7:10] = (1).to_bytes(3, 'little')
    vp8x_chunk = _riff_chunk(b'VP8X', bytes(vp8x_payload))
    riff_size = 4 + len(vp8x_chunk) + len(exif_chunk)
    return b'RIFF' + struct.pack('<I', riff_size) + b'WEBP' + vp8x_chunk + exif_chunk


def _build_tiff_with_user_comment(comment_payload: bytes) -> bytes:
    # IFD0: ExifIFDPointer(0x8769) only
    ifd0_offset = 8
    ifd0_size = 2 + 12 + 4
    exif_ifd_offset = ifd0_offset + ifd0_size
    exif_ifd_size = 2 + 12 + 4
    data_offset = exif_ifd_offset + exif_ifd_size

    out = bytearray()
    out.extend(b'II')
    out.extend(struct.pack('<H', 42))
    out.extend(struct.pack('<I', ifd0_offset))

    out.extend(struct.pack('<H', 1))
    out.extend(struct.pack('<H', 0x8769))
    out.extend(struct.pack('<H', 4))
    out.extend(struct.pack('<I', 1))
    out.extend(struct.pack('<I', exif_ifd_offset))
    out.extend(struct.pack('<I', 0))

    out.extend(struct.pack('<H', 1))
    out.extend(struct.pack('<H', 0x9286))
    out.extend(struct.pack('<H', 7))
    out.extend(struct.pack('<I', len(comment_payload)))
    out.extend(struct.pack('<I', data_offset))
    out.extend(struct.pack('<I', 0))

    out.extend(comment_payload)
    return bytes(out)


def _riff_chunk(fourcc: bytes, payload: bytes) -> bytes:
    chunk = bytearray()
    chunk.extend(fourcc)
    chunk.extend(struct.pack('<I', len(payload)))
    chunk.extend(payload)
    if len(payload) % 2 == 1:
        chunk.extend(b'\x00')
    return bytes(chunk)


def _build_png_with_text_chunk(keyword: str, text: str) -> bytes:
    signature = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b'\x00\x00\x00\x00')
    text_payload = keyword.encode('latin-1') + b'\x00' + text.encode('utf-8')
    chunks = (
        _png_chunk(b'IHDR', ihdr),
        _png_chunk(b'tEXt', text_payload),
        _png_chunk(b'IDAT', idat),
        _png_chunk(b'IEND', b''),
    )
    return signature + b''.join(chunks)


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack('>I', len(data))
        + chunk_type
        + data
        + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def _build_jpeg_with_exif_user_comment(comment_payload: bytes) -> bytes:
    tiff = _build_tiff_with_user_comment(comment_payload)
    exif_payload = b'Exif\x00\x00' + tiff
    app1_length = len(exif_payload) + 2
    return b'\xFF\xD8' + b'\xFF\xE1' + struct.pack('>H', app1_length) + exif_payload + b'\xFF\xD9'
