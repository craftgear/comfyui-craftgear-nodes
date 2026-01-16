import json
import math
import os
import tempfile
import unittest

from load_loras_with_tags.logic import trigger_words as logic_triggers


def write_safetensors_with_metadata(path: str, metadata: dict[str, object]) -> None:
    header = json.dumps({"__metadata__": metadata}).encode("utf-8")
    with open(path, "wb") as file:
        file.write(len(header).to_bytes(8, "little"))
        file.write(header)


class LoraTriggerExtractionTest(unittest.TestCase):
    def test_extracts_triggers_from_model_info_version_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump(
                    {
                        "modelVersions": [
                            {
                                "id": 1,
                                "files": [{"name": "other.safetensors"}],
                                "images": [{"positive": "ignore"}],
                            },
                            {
                                "id": 2,
                                "files": [{"name": "test.safetensors"}],
                                "images": [{"positive": "alpha, beta"}],
                            },
                        ]
                    },
                    file,
                )
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "meta"])

    def test_falls_back_to_rgthree_when_model_info_has_no_tags(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump({"modelVersions": []}, file)
            rgthree_path = f"{lora_path}.rgthree-info.json"
            with open(rgthree_path, "w", encoding="utf-8") as file:
                json.dump({"images": [{"positive": "alpha, beta"}]}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "meta"])

    def test_extracts_triggers_from_model_info_positive_prompts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump(
                    {
                        "images": [
                            {"positive": "alpha, beta, (gamma:1.2)"},
                            {"positive": "beta, {delta|epsilon}, alpha"},
                        ]
                    },
                    file,
                )
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "gamma", "delta", "epsilon", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual(
                frequencies,
                [
                    ("alpha", 2.0),
                    ("beta", 2.0),
                    ("gamma", 1.0),
                    ("delta", 1.0),
                    ("epsilon", 1.0),
                ],
            )

    def test_trained_words_override_positive_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump(
                    {
                        "trainedWords": ["beta"],
                        "images": [{"positive": "alpha, beta"}],
                    },
                    file,
                )
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["beta", "alpha", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            freq_map = {tag: count for tag, count in frequencies}
            self.assertTrue(math.isinf(freq_map["beta"]))
            self.assertEqual(freq_map["alpha"], 1.0)

    def test_extracts_triggers_from_model_info_trained_words(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump({"trainedWords": ["alpha", "beta"]}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual([tag for tag, _count in frequencies], ["alpha", "beta"])
            self.assertTrue(all(math.isinf(count) for _tag, count in frequencies))

    def test_splits_trained_words_string_by_comma(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            model_info_path = os.path.join(temp_dir, "model_info.json")
            with open(model_info_path, "w", encoding="utf-8") as file:
                json.dump({"trainedWords": "alpha, beta"}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual([tag for tag, _count in frequencies], ["alpha", "beta"])
            self.assertTrue(all(math.isinf(count) for _tag, count in frequencies))

    def test_extracts_trained_words_from_any_json_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            extra_path = os.path.join(temp_dir, "custom_tags.json")
            with open(extra_path, "w", encoding="utf-8") as file:
                json.dump({"trainedWords": ["alpha", "beta"]}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha", "beta", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual([tag for tag, _count in frequencies], ["alpha", "beta"])
            self.assertTrue(all(math.isinf(count) for _tag, count in frequencies))

    def test_dedupes_triggers_case_insensitive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["Alpha"]})
            extra_path = os.path.join(temp_dir, "extra.json")
            with open(extra_path, "w", encoding="utf-8") as file:
                json.dump({"trainedWords": ["alpha"]}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["alpha"])

    def test_extracts_triggers_from_rgthree_trained_words(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trigger_words": ["meta"]})
            sidecar_path = f"{lora_path}.rgthree-info.json"
            with open(sidecar_path, "w", encoding="utf-8") as file:
                json.dump({"trainedWords": [{"word": "gamma"}, {"word": "delta"}]}, file)
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["gamma", "delta", "meta"])
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual([tag for tag, _count in frequencies], ["gamma", "delta"])
            self.assertTrue(all(math.isinf(count) for _tag, count in frequencies))

    def test_extracts_triggers_from_trained_words_list(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            write_safetensors_with_metadata(lora_path, {"trained_words": ["foo", "bar", "foo"]})
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["foo", "bar"])

    def test_extracts_triggers_from_ss_tag_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            meta_value = json.dumps({"set": {"tag1": 5, "tag2": 1}, "set2": {"tag2": 2}})
            write_safetensors_with_metadata(lora_path, {"ss_tag_frequency": meta_value})
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, ["tag1", "tag2"])

    def test_extracts_all_from_ss_tag_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            tags = {f"tag{i}": i for i in range(30)}
            meta_value = json.dumps({"set": tags})
            write_safetensors_with_metadata(lora_path, {"ss_tag_frequency": meta_value})
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(len(triggers), 30)
            self.assertEqual(triggers[0], "tag29")

    def test_extracts_frequencies_from_ss_tag_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            meta_value = json.dumps({"set": {"tag1": 5, "tag2": 1}, "set2": {"tag2": 2}})
            write_safetensors_with_metadata(lora_path, {"ss_tag_frequency": meta_value})
            frequencies = logic_triggers.extract_lora_trigger_frequencies(lora_path)
            self.assertEqual(frequencies, [("tag1", 5.0), ("tag2", 3.0)])

    def test_returns_empty_for_non_safetensors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.pt")
            with open(lora_path, "wb") as file:
                file.write(b"dummy")
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(triggers, [])

    def test_filters_triggers_by_selection(self) -> None:
        triggers = ["alpha", "beta", "gamma"]
        selection = json.dumps(["gamma", "alpha"])
        filtered = logic_triggers.filter_lora_triggers(triggers, selection)
        self.assertEqual(filtered, ["alpha", "gamma"])

    def test_filter_returns_all_when_selection_empty(self) -> None:
        triggers = ["alpha", "beta"]
        filtered = logic_triggers.filter_lora_triggers(triggers, "")
        self.assertEqual(filtered, ["alpha", "beta"])

    def test_filter_returns_all_when_selection_invalid(self) -> None:
        triggers = ["alpha"]
        filtered = logic_triggers.filter_lora_triggers(triggers, "[invalid")
        self.assertEqual(filtered, ["alpha"])

    def test_filter_returns_empty_when_selection_empty_list(self) -> None:
        triggers = ["alpha", "beta"]
        filtered = logic_triggers.filter_lora_triggers(triggers, "[]")
        self.assertEqual(filtered, [])


if __name__ == "__main__":
    unittest.main()
