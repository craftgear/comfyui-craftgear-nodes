import json
import os
import tempfile
import unittest

from load_lora_with_triggers.logic import trigger_words as logic_triggers


def write_safetensors_with_metadata(path: str, metadata: dict[str, object]) -> None:
    header = json.dumps({"__metadata__": metadata}).encode("utf-8")
    with open(path, "wb") as file:
        file.write(len(header).to_bytes(8, "little"))
        file.write(header)


class LoraTriggerExtractionTest(unittest.TestCase):
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

    def test_extracts_top_count_from_ss_tag_frequency(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            lora_path = os.path.join(temp_dir, "test.safetensors")
            tags = {f"tag{i}": i for i in range(30)}
            meta_value = json.dumps({"set": tags})
            write_safetensors_with_metadata(lora_path, {"ss_tag_frequency": meta_value})
            triggers = logic_triggers.extract_lora_triggers(lora_path)
            self.assertEqual(len(triggers), 20)
            self.assertEqual(triggers[0], "tag29")

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
