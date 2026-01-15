import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from tag_toggle_text import tag_toggle_text_node


class TestTagToggleTextNode(unittest.TestCase):
    def test_input_types(self):
        inputs = tag_toggle_text_node.TagToggleTextNode.INPUT_TYPES()
        text_input = inputs["required"]["text"]
        self.assertEqual(text_input[1].get("forceInput"), True)
        excluded_input = inputs["required"]["excluded_tags"]
        self.assertEqual(excluded_input[1].get("socketless"), True)

    def test_split_tags(self):
        self.assertEqual(tag_toggle_text_node.split_tags(" a, b , , c "), ["a", "b", "c"])

    def test_parse_excluded_tags_json(self):
        result = tag_toggle_text_node.parse_excluded_tags('["a", "b"]')
        self.assertEqual(result, {"a", "b"})

    def test_apply_excludes_duplicates(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="a, b, a, c", excluded_tags='["a"]')
        self.assertEqual(result["result"][0], "b, c")
        self.assertEqual(result["ui"]["input_text"][0], "a, b, a, c")

    def test_apply_fallback_comma(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="x, y, z", excluded_tags="y")
        self.assertEqual(result["result"][0], "x, z")


if __name__ == "__main__":
    unittest.main()
