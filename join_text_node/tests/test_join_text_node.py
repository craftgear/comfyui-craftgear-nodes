import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from join_text_node import join_text_node


class TestJoinTextNode(unittest.TestCase):
    def test_input_types_force_input(self):
        inputs = join_text_node.JoinTextNode.INPUT_TYPES()
        text_1 = inputs["required"]["text_1"]
        self.assertEqual(text_1[1].get("forceInput"), True)
        separator = inputs["required"]["separator"]
        self.assertEqual(separator[1].get("socketless"), True)

    def test_join_text_skips_empty_lines(self):
        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="a\n\nb", separator=",")
        self.assertEqual(output, "a,b")

    def test_join_text_multiple_inputs(self):
        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="a", text_2="b\nc", separator="|")
        self.assertEqual(output, "a|b|c")

    def test_join_text_ignores_empty_inputs(self):
        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="", text_2="", text_3="x", separator=",")
        self.assertEqual(output, "x")

    def test_join_text_avoids_duplicate_separator(self):
        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="a,", text_2=",b", separator=",")
        self.assertEqual(output, "a,b")

    def test_join_text_keeps_single_separator_when_suffix_exists(self):
        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="a,", text_2="b", separator=",")
        self.assertEqual(output, "a,b")

    def test_join_text_ignores_missing_handle_value(self):
        class Missing:
            def __str__(self):
                raise RuntimeError("missing")

        node = join_text_node.JoinTextNode()
        (output,) = node.apply(text_1="a", text_2=Missing(), separator=",")
        self.assertEqual(output, "a")


if __name__ == "__main__":
    unittest.main()
