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

    def test_apply_escapes_parentheses(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="foo(bar), baz( qux )", excluded_tags="[]")
        self.assertEqual(result["result"][0], "foo\\(bar\\), baz\\( qux \\)")
        self.assertEqual(result["ui"]["input_text"][0], "foo(bar), baz( qux )")

    def test_apply_does_not_double_escape(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="foo\\(bar\\), baz", excluded_tags="[]")
        self.assertEqual(result["result"][0], "foo\\(bar\\), baz")

    def test_apply_keeps_weighted_parentheses(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="foo(bar), (baz:1.2)", excluded_tags="[]")
        self.assertEqual(result["result"][0], "foo\\(bar\\), (baz:1.2)")

    def test_apply_keeps_weighted_parentheses_already_escaped(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(text="foo\\(bar\\), \\(baz:1.2\\)", excluded_tags="[]")
        self.assertEqual(result["result"][0], "foo\\(bar\\), (baz:1.2)")

    def test_apply_escapes_parentheses_inside_weighted_name(self):
        node = tag_toggle_text_node.TagToggleTextNode()
        result = node.apply(
            text="(best quality:1.2),(character (series):1.15),character (series), good quality",
            excluded_tags="[]",
        )
        self.assertEqual(
            result["result"][0],
            "(best quality:1.2),(character \\(series\\):1.15),character \\(series\\), good quality",
        )


if __name__ == "__main__":
    unittest.main()
