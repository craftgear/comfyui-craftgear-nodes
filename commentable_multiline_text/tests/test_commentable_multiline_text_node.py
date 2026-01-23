import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from commentable_multiline_text import commentable_multiline_text_node


class TestCommentableMultilineTextNode(unittest.TestCase):
    def test_apply_excludes_comment_and_blank_lines(self):
        text = "alpha\n#skip\n//omit\n  #skip2\n \n beta  "
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, "|")
        self.assertEqual(output, "alpha|beta")

    def test_apply_uses_separator(self):
        text = "a\nb\nc"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "a,b,c")

    def test_apply_empty_separator(self):
        text = "a\nb\nc"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, "")
        self.assertEqual(output, "a,b,c")

    def test_apply_trims_separator(self):
        text = "a\nb\nc"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, " , ")
        self.assertEqual(output, "a,b,c")


if __name__ == "__main__":
    unittest.main()
