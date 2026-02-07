import unittest
from unittest import mock

from a1111_webp_metadata_reader.ui.node import A1111WebpMetadataReader


class TestA1111WebpMetadataReaderUi(unittest.TestCase):
    def test_return_names_use_json_suffix(self) -> None:
        self.assertEqual(
            A1111WebpMetadataReader.RETURN_NAMES,
            (
                'positive_prompt',
                'negative_prompt',
                'model json',
                'loras json',
                'steps',
                'sampler',
                'cfg_scale',
                'seed',
                'size',
                'clip_skip',
                'raw_parameters',
            ),
        )

    def test_read_returns_parsed_values(self) -> None:
        reader = A1111WebpMetadataReader()
        payload = {
            'positive_prompt': 'pos',
            'negative_prompt': 'neg',
            'model': '{"name":"model","hash":"abcd1234","modelVersionId":"12345"}',
            'loras': '[{"name":"a","hash":"ffff0000","modelVersionId":"9876"}]',
            'steps': 20,
            'sampler': 'Euler',
            'cfg_scale': 7.0,
            'seed': 123,
            'size': '512x512',
            'clip_skip': 2,
            'raw_parameters': 'raw',
        }
        with mock.patch('a1111_webp_metadata_reader.ui.node.logic.read_and_parse_metadata', return_value=payload):
            result = reader.read('/tmp/sample.webp')

        self.assertEqual(
            result,
            (
                'pos',
                'neg',
                '{"name":"model","hash":"abcd1234","modelVersionId":"12345"}',
                '[{"name":"a","hash":"ffff0000","modelVersionId":"9876"}]',
                20,
                'Euler',
                7.0,
                123,
                '512x512',
                2,
                'raw',
            ),
        )


if __name__ == '__main__':
    unittest.main()
