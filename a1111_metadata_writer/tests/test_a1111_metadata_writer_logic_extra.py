import json
import os
import tempfile
import unittest
from unittest import mock

from a1111_metadata_writer.logic import a1111_metadata as logic
from a1111_metadata_writer.tests.test_a1111_metadata_writer import BASE_PNG


class A1111MetadataWriterLogicExtraTest(unittest.TestCase):
    def _build_png(self, chunks):
        output = bytearray(logic.PNG_SIGNATURE)
        for chunk_type, data in chunks:
            output.extend(logic._build_chunk(chunk_type, data))
        return bytes(output)

    def test_read_png_text_invalid_signature(self) -> None:
        self.assertEqual(logic.read_png_text(b'notpng'), {})

    def test_read_png_text_itxt_and_ztxt(self) -> None:
        itxt_data = b'prompt\x00\x00\x00\x00\x00text'
        ztxt_data = b'prompt\x00\x00' + b'invalid'
        png = self._build_png(
            [
                (b'iTXt', itxt_data),
                (b'zTXt', ztxt_data),
                (b'IEND', b''),
            ]
        )
        text_map = logic.read_png_text(png)
        self.assertIn('prompt', text_map)

    def test_set_png_text_value_replaces_existing(self) -> None:
        first = logic.set_png_text_value(BASE_PNG, 'prompt', 'first')
        updated = logic.set_png_text_value(first, 'prompt', 'second')
        text_map = logic.read_png_text(updated)
        self.assertEqual(text_map.get('prompt'), 'second')

    def test_set_png_text_value_invalid_signature(self) -> None:
        data = b'notpng'
        self.assertEqual(logic.set_png_text_value(data, 'prompt', 'x'), data)

    def test_set_png_text_value_inserts_before_iend(self) -> None:
        png = self._build_png([(b'IEND', b'')])
        updated = logic.set_png_text_value(png, 'prompt', 'x')
        text_map = logic.read_png_text(updated)
        self.assertEqual(text_map.get('prompt'), 'x')

    def test_build_text_chunk_itxt(self) -> None:
        chunk = logic._build_text_chunk('prompt', 'あ')
        self.assertEqual(chunk[4:8], b'iTXt')

    def test_parse_text_chunk_invalid(self) -> None:
        self.assertEqual(logic._parse_text_chunk(b'no-null'), ('', ''))

    def test_parse_itxt_chunk_short_and_invalid_utf8(self) -> None:
        self.assertEqual(logic._parse_itxt_chunk(b'prompt\x00'), ('', ''))
        data = b'prompt\x00\x00\x00\x00\x00\xff'
        key, text = logic._parse_itxt_chunk(data)
        self.assertEqual(key, 'prompt')
        self.assertEqual(text, '\xff')

    def test_parse_itxt_chunk_invalid_compression(self) -> None:
        data = b'key\x00\x01\x00\x00\x00\x00bad'
        key, text = logic._parse_itxt_chunk(data)
        self.assertEqual(key, 'key')
        self.assertEqual(text, '')

    def test_parse_ztxt_chunk_invalid_compression(self) -> None:
        data = b'key\x00\x00bad'
        key, text = logic._parse_ztxt_chunk(data)
        self.assertEqual(key, 'key')
        self.assertEqual(text, '')

    def test_parse_ztxt_chunk_invalid_data(self) -> None:
        self.assertEqual(logic._parse_ztxt_chunk(b'no-null'), ('', ''))
        self.assertEqual(logic._parse_ztxt_chunk(b'key\x00'), ('', ''))

    def test_build_a1111_parameters_from_png_invalid_json(self) -> None:
        png = logic.set_png_text_value(BASE_PNG, 'prompt', '{broken')
        self.assertEqual(logic.build_a1111_parameters_from_png(png), '')

    def test_build_a1111_parameters_from_png_missing_prompt(self) -> None:
        self.assertEqual(logic.build_a1111_parameters_from_png(BASE_PNG), '')

    def test_build_a1111_parameters_from_prompt_invalid(self) -> None:
        self.assertEqual(logic.build_a1111_parameters_from_prompt({}), '')
        self.assertEqual(logic.build_a1111_parameters_from_prompt('bad'), '')

    def test_apply_commentable_join_and_toggle(self) -> None:
        prompt = {
            '1': {
                'class_type': 'CommentableMultilineTextNode',
                'inputs': {'text': 'alpha\n#skip\nbeta', 'separator': ','},
            },
            '2': {
                'class_type': 'JoinTextNode',
                'inputs': {'text_1': ['1', 0], 'text_2': ',gamma', 'separator': ','},
            },
            '3': {
                'class_type': 'TagToggleTextNode',
                'inputs': {'text': ['2', 0], 'excluded_tags': '["beta"]'},
            },
        }
        cache: dict[str, str] = {}
        result = logic._resolve_string(['3', 0], prompt, cache)
        self.assertEqual(result, 'alpha, gamma')

    def test_resolve_node_output_handles_missing(self) -> None:
        cache: dict[str, str] = {}
        self.assertEqual(logic._resolve_node_output('missing', {}, cache), '')
        self.assertEqual(cache.get('missing'), '')

    def test_resolve_string_numbers(self) -> None:
        self.assertEqual(logic._resolve_string(1, {}, {}), '1')
        self.assertEqual(logic._resolve_string(None, {}, {}), '')

    def test_apply_load_loras_with_tags(self) -> None:
        inputs = {
            'tags': 'alpha, beta',
            'lora_on_1': True,
            'lora_name_1': 'demo.safetensors',
            'tag_selection_1': '["gamma"]',
        }
        result = logic._apply_load_loras_with_tags(inputs, inputs['tags'])
        self.assertEqual(result, 'alpha, beta, gamma')

    def test_apply_load_loras_with_tags_skips(self) -> None:
        inputs = {
            'tags': '',
            'lora_on_1': False,
            'lora_name_1': 'None',
            'tag_selection_1': 'bad',
        }
        self.assertEqual(logic._apply_load_loras_with_tags(inputs, ''), '')

    def test_parse_tag_selection(self) -> None:
        self.assertEqual(logic._parse_tag_selection(['a', 'b']), ['a', 'b'])
        self.assertEqual(logic._parse_tag_selection('["a", "b"]'), ['a', 'b'])
        self.assertEqual(logic._parse_tag_selection('a, b'), ['a', 'b'])

    def test_dedupe_tags_casefold(self) -> None:
        self.assertEqual(logic._dedupe_tags(['Alpha', 'alpha', 'beta']), ['Alpha', 'beta'])

    def test_append_lora_tags_variants(self) -> None:
        tags = ['<lora:demo:1>']
        self.assertEqual(logic._append_lora_tags('', tags), '<lora:demo:1>')
        self.assertEqual(logic._append_lora_tags('alpha,', tags), 'alpha, <lora:demo:1>')
        self.assertEqual(logic._append_lora_tags('alpha, ', tags), 'alpha, <lora:demo:1>')

    def test_normalize_lora_name_and_enabled(self) -> None:
        self.assertEqual(logic._normalize_lora_name('demo.safetensors'), 'demo')
        self.assertEqual(logic._normalize_lora_name({'name': 'demo.pt'}), 'demo')
        self.assertEqual(logic._normalize_lora_name({'value': 'demo.ckpt'}), 'demo')
        self.assertFalse(logic._is_lora_enabled('false'))
        self.assertTrue(logic._is_lora_enabled('true'))
        self.assertTrue(logic._is_lora_enabled(1))
        self.assertFalse(logic._is_lora_enabled(0))

    def test_map_sampler_name_and_format_number(self) -> None:
        self.assertEqual(logic._map_sampler_name('euler_a'), 'Euler a')
        self.assertEqual(logic._format_number(1.230000), '1.23')
        self.assertEqual(logic._map_sampler_name('unknown'), 'unknown')

    def test_resolve_model_name_and_latent_size(self) -> None:
        prompt = {
            '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': 'models/base.safetensors'}},
            '2': {'class_type': 'LoraLoader', 'inputs': {'model': ['1', 0], 'lora_name': 'demo.safetensors', 'strength_model': 1.0}},
            '3': {'class_type': 'EmptyLatentImage', 'inputs': {'width': 512, 'height': 768}},
        }
        model_name = logic._resolve_model_name(['2', 0], prompt)
        self.assertEqual(model_name, 'base')
        size = logic._resolve_latent_size(['3', 0], prompt)
        self.assertEqual(size, (512, 768))
        self.assertEqual(logic._resolve_model_name(None, prompt), '')
        self.assertEqual(logic._resolve_latent_size(None, prompt), (None, None))

    def test_resolve_model_file_path_uses_folder_paths(self) -> None:
        with mock.patch.dict('sys.modules', {'folder_paths': mock.Mock()}):
            import folder_paths

            folder_paths.get_full_path = lambda *_args, **_kwargs: '/tmp/demo.safetensors'
            with tempfile.TemporaryDirectory() as temp_dir:
                path = os.path.join(temp_dir, 'demo.safetensors')
                with open(path, 'wb') as file:
                    file.write(b'')
                folder_paths.get_full_path = lambda *_args, **_kwargs: path
                resolved = logic._resolve_model_file_path('demo.safetensors', 'loras')
                self.assertEqual(resolved, path)

    def test_resolve_lora_path_variants(self) -> None:
        self.assertEqual(logic._resolve_lora_path(None), '')
        self.assertEqual(logic._resolve_lora_path('None'), '')


if __name__ == '__main__':
    unittest.main()
