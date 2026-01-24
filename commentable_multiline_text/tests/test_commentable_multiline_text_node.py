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

    def test_apply_escapes_parentheses(self):
        text = "foo(bar)\n#skip\nbaz\\(qux\\)"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "foo\\(bar\\),baz\\(qux\\)")

    def test_apply_keeps_weighted_parentheses(self):
        text = "(alpha:1.1)\n(beta:0.5)\nfoo(bar)"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "(alpha:1.1),(beta:0.5),foo\\(bar\\)")

    def test_apply_keeps_weighted_parentheses_already_escaped(self):
        text = "\\(alpha:1.1\\)\n(beta:0.5)\n\\(foo:0.8\\)"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "(alpha:1.1),(beta:0.5),(foo:0.8)")

    def test_apply_keeps_weighted_parentheses_with_space(self):
        text = "(best quality:1.2)\nfoo(bar)"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "(best quality:1.2),foo\\(bar\\)")

    def test_apply_does_not_double_separator_when_line_has_trailing_separator(self):
        text = "alpha,\nbeta"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "alpha,beta")

    def test_apply_does_not_double_separator_when_line_starts_with_separator(self):
        text = "alpha\n, beta"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(output, "alpha,beta")

    def test_apply_weighted_tags_on_same_line(self):
        text = "(best quality:1.2),(character (series):1.15),character (series), good quality"
        node = commentable_multiline_text_node.CommentableMultilineTextNode()
        (output,) = node.apply(text, ",")
        self.assertEqual(
            output,
            "(best quality:1.2),(character \\(series\\):1.15),character \\(series\\),good quality",
        )


if __name__ == "__main__":
    unittest.main()
