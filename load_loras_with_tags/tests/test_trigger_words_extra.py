import json
import os
import tempfile
import unittest
from unittest import mock

from load_loras_with_tags.logic import trigger_words


class TriggerWordsExtraTest(unittest.TestCase):
    def test_filter_lora_triggers(self) -> None:
        self.assertEqual(trigger_words.filter_lora_triggers([], '[]'), [])
        self.assertEqual(trigger_words.filter_lora_triggers(['a'], ''), ['a'])
        self.assertEqual(trigger_words.filter_lora_triggers(['a'], '{bad'), ['a'])
        self.assertEqual(trigger_words.filter_lora_triggers(['a', 'b'], '["b"]'), ['b'])

    def test_read_safetensors_metadata_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            txt_path = os.path.join(temp_dir, 'demo.txt')
            with open(txt_path, 'wb') as file:
                file.write(b'')
            self.assertEqual(trigger_words._read_safetensors_metadata(txt_path), {})
            bad_path = os.path.join(temp_dir, 'bad.safetensors')
            with open(bad_path, 'wb') as file:
                file.write(b'1234')
            self.assertEqual(trigger_words._read_safetensors_metadata(bad_path), {})
            zero_path = os.path.join(temp_dir, 'zero.safetensors')
            with open(zero_path, 'wb') as file:
                file.write((0).to_bytes(8, 'little'))
            self.assertEqual(trigger_words._read_safetensors_metadata(zero_path), {})

    def test_read_safetensors_metadata_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'bad.safetensors')
            payload = b'{not-json'
            with open(path, 'wb') as file:
                file.write(len(payload).to_bytes(8, 'little'))
                file.write(payload)
            self.assertEqual(trigger_words._read_safetensors_metadata(path), {})

    def test_parse_trained_word_values(self) -> None:
        values = [
            {'word': 'alpha'},
            {'word': 'beta', 'metadata': True},
            'gamma',
            {'metadata': True},
        ]
        self.assertEqual(trigger_words._parse_trained_word_values(values), ['alpha', 'gamma'])
        self.assertEqual(trigger_words._parse_trained_word_values({'metadata': True}), [])
        self.assertEqual(trigger_words._parse_trained_word_values({'word': 123}), [123])
        self.assertEqual(trigger_words._parse_trained_word_values(''), [])

    def test_extract_trained_words_from_json_text_utf16(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'tags.json')
            payload = {'trainedWords': ['alpha']}
            text = json.dumps(payload)
            with open(path, 'wb') as file:
                file.write(text.encode('utf-16'))
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), ['alpha'])

    def test_merge_frequency_lists(self) -> None:
        primary = [('alpha', float('inf'))]
        secondary = [('alpha', 1.0), ('beta', 2.0)]
        merged = trigger_words._merge_frequency_lists(primary, secondary)
        merged_map = {tag: count for tag, count in merged}
        self.assertTrue(merged_map['alpha'] == float('inf'))
        self.assertEqual(merged_map['beta'], 2.0)

    def test_select_model_info_payload_no_match(self) -> None:
        data = {'modelVersions': [{'id': 1, 'files': [{'name': 'x.safetensors'}]}]}
        result = trigger_words._select_model_info_payload('demo.safetensors', data)
        self.assertEqual(result, {})

    def test_has_sidecar_payload(self) -> None:
        payload = {'images': [{'positive': 'alpha'}]}
        self.assertTrue(trigger_words._has_sidecar_payload(payload))
        self.assertFalse(trigger_words._has_sidecar_payload({'images': [{'positive': ''}]}))

    def test_normalize_positive_segment(self) -> None:
        self.assertEqual(
            trigger_words._normalize_positive_segment('(alpha:1.2)'),
            ['alpha'],
        )
        self.assertEqual(
            trigger_words._normalize_positive_segment('{beta|gamma}'),
            ['beta', 'gamma'],
        )
        self.assertEqual(trigger_words._normalize_positive_segment(''), [])

    def test_parse_positive_prompt(self) -> None:
        result = trigger_words._parse_positive_prompt('alpha, {beta|gamma}, (delta:1.1)')
        self.assertEqual(result, ['alpha', 'beta', 'gamma', 'delta'])
        self.assertEqual(trigger_words._parse_positive_prompt(''), [])

    def test_frequency_from_metadata(self) -> None:
        value = {'set1': {'alpha': 2, 'beta': 1}, 'set2': {'alpha': 1}}
        result = trigger_words._frequency_from_metadata(value)
        self.assertEqual(result[0][0], 'alpha')
        self.assertEqual(result[0][1], 3.0)
        json_text = json.dumps(value)
        self.assertEqual(trigger_words._frequency_from_metadata(json_text), result)
        self.assertEqual(trigger_words._frequency_from_metadata('{bad'), [])

    def test_tags_from_frequency_empty(self) -> None:
        self.assertEqual(trigger_words._tags_from_frequency({}), [])

    def test_extract_triggers_from_metadata(self) -> None:
        metadata = {'trigger_words': ['alpha']}
        self.assertEqual(trigger_words._extract_triggers_from_metadata(metadata), ['alpha'])
        metadata = {'trained_words': ['beta']}
        self.assertEqual(trigger_words._extract_triggers_from_metadata(metadata), ['beta'])

    def test_parse_trigger_values(self) -> None:
        self.assertEqual(trigger_words._parse_trigger_values('["alpha", "beta"]'), ['alpha', 'beta'])
        self.assertEqual(trigger_words._parse_trigger_values('alpha, beta'), ['alpha', 'beta'])
        self.assertEqual(trigger_words._parse_trigger_values({'alpha': 1}), ['alpha'])
        self.assertEqual(trigger_words._parse_trigger_values(['alpha']), ['alpha'])

    def test_parse_trigger_values_other_type(self) -> None:
        self.assertEqual(trigger_words._parse_trigger_values(123), [])

    def test_filter_lora_triggers_non_list(self) -> None:
        self.assertEqual(trigger_words.filter_lora_triggers(['a'], '{"a":1}'), ['a'])

    def test_read_safetensors_metadata_non_dict(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'meta.safetensors')
            payload = json.dumps({'__metadata__': 'oops'}).encode('utf-8')
            with open(path, 'wb') as file:
                file.write(len(payload).to_bytes(8, 'little'))
                file.write(payload)
            self.assertEqual(trigger_words._read_safetensors_metadata(path), {})

    def test_extract_trained_words_non_dict(self) -> None:
        self.assertEqual(trigger_words._extract_trained_words(['alpha']), [])

    def test_parse_trained_word_values_more_variants(self) -> None:
        value = [{'word': 1}, {'foo': 'bar'}, 5]
        self.assertEqual(trigger_words._parse_trained_word_values(value), [1, {'foo': 'bar'}, 5])
        self.assertEqual(trigger_words._parse_trained_word_values({'word': 'alpha'}), ['alpha'])

    def test_extract_trained_words_from_json_text_missing_and_empty(self) -> None:
        self.assertEqual(trigger_words._extract_trained_words_from_json_text('/no/such/file.json'), [])
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'empty.json')
            with open(path, 'wb') as file:
                file.write(b'')
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), [])

    def test_extract_trained_words_from_json_text_invalid_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'bad.json')
            with open(path, 'wb') as file:
                file.write(b'\xff\xff')
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), [])

    def test_extract_trained_words_from_json_text_bad_utf16(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'bad_utf16.json')
            with open(path, 'wb') as file:
                file.write(b'\xff\xfe\x00')
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), [])

    def test_extract_trained_words_from_json_text_null_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'null.json')
            with open(path, 'wb') as file:
                file.write(b'a\x00b')
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), [])

    def test_extract_trained_words_from_json_text_malformed_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, 'malformed.json')
            text = '"trainedWords" "oops" "trained_words": [invalid'
            with open(path, 'wb') as file:
                file.write(text.encode('utf-8'))
            self.assertEqual(trigger_words._extract_trained_words_from_json_text(path), [])

    def test_extract_lora_trigger_frequencies_merges(self) -> None:
        with mock.patch.object(
            trigger_words,
            '_extract_sidecar_triggers_and_frequencies',
            return_value=(['alpha'], [('alpha', 1.0)]),
        ), mock.patch.object(
            trigger_words,
            '_read_safetensors_metadata',
            return_value={'meta': True},
        ), mock.patch.object(
            trigger_words,
            '_extract_trigger_frequencies_from_metadata',
            return_value=[('alpha', 2.0), ('beta', 1.0)],
        ):
            result = trigger_words.extract_lora_trigger_frequencies('demo.safetensors')
            self.assertEqual(dict(result), {'alpha': 3.0, 'beta': 1.0})

    def test_merge_frequency_lists_sums(self) -> None:
        merged = trigger_words._merge_frequency_lists([('alpha', 1.0)], [('alpha', 2.0)])
        self.assertEqual(dict(merged), {'alpha': 3.0})

    def test_extract_sidecar_triggers_empty_base_dir(self) -> None:
        self.assertEqual(
            trigger_words._extract_sidecar_triggers_and_frequencies('demo.safetensors'),
            ([], []),
        )

    def test_load_json_payloads_in_directory_errors(self) -> None:
        self.assertEqual(
            trigger_words._load_json_payloads_in_directory('demo.safetensors', '/no/such/dir'),
            [],
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            os.makedirs(os.path.join(temp_dir, 'sub'))
            self.assertEqual(
                trigger_words._load_json_payloads_in_directory(
                    os.path.join(temp_dir, 'demo.safetensors'),
                    temp_dir,
                ),
                [],
            )

    def test_find_model_version_for_file_variants(self) -> None:
        versions = [
            'not-a-dict',
            {'files': 'nope'},
            {'files': ['not-a-dict']},
        ]
        self.assertEqual(trigger_words._find_model_version_for_file(versions, 'demo.safetensors'), {})

    def test_has_sidecar_payload_variants(self) -> None:
        self.assertFalse(trigger_words._has_sidecar_payload(['alpha']))
        self.assertTrue(trigger_words._has_sidecar_payload({'trained_words': ['alpha']}))

    def test_normalize_positive_segment_invalid_weight(self) -> None:
        self.assertEqual(trigger_words._normalize_positive_segment('alpha:bad'), ['alpha:bad'])
        self.assertEqual(trigger_words._normalize_positive_segment('()'), [])

    def test_extract_triggers_from_metadata_variants(self) -> None:
        original = trigger_words.USE_SS_TAG_STRINGS
        try:
            trigger_words.USE_SS_TAG_STRINGS = True
            metadata = {'ss_tag_strings': ['alpha']}
            self.assertEqual(trigger_words._extract_triggers_from_metadata(metadata), ['alpha'])
            self.assertEqual(trigger_words._extract_triggers_from_metadata(['alpha']), [])
        finally:
            trigger_words.USE_SS_TAG_STRINGS = original

    def test_extract_trigger_frequencies_from_metadata_non_dict(self) -> None:
        self.assertEqual(trigger_words._extract_trigger_frequencies_from_metadata(['alpha']), [])

    def test_frequency_from_metadata_invalid_inputs(self) -> None:
        self.assertEqual(trigger_words._frequency_from_metadata(['alpha']), [])
        value = {'set1': ['bad'], 'set2': {' ': 2, 'alpha': 'x'}}
        self.assertEqual(trigger_words._frequency_from_metadata(value), [('alpha', 1.0)])
