import unittest
from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[1]


def load_display_name_mapping(file_path: Path) -> dict[str, str]:
    tree = ast.parse(file_path.read_text())
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id != "NODE_DISPLAY_NAME_MAPPINGS":
                continue
            return _parse_dict_literal(node.value)
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "NODE_DISPLAY_NAME_MAPPINGS":
                    return _parse_dict_literal(node.value)
    return {}


def _parse_dict_literal(node: ast.AST) -> dict[str, str]:
    if not isinstance(node, ast.Dict):
        return {}
    mapping: dict[str, str] = {}
    for key, value in zip(node.keys, node.values):
        if isinstance(key, ast.Constant) and isinstance(value, ast.Constant):
            if isinstance(key.value, str) and isinstance(value.value, str):
                mapping[key.value] = value.value
    return mapping


class TestNodeDisplayNames(unittest.TestCase):
    def test_tag_toggle_text_display_name(self):
        module_path = ROOT / "__init__.py"
        mapping = load_display_name_mapping(module_path)
        self.assertEqual(
            mapping["TagToggleTextNode"],
            "Toggle Tags",
        )

    def test_a1111_metadata_reader_display_name(self):
        module_path = ROOT / "__init__.py"
        mapping = load_display_name_mapping(module_path)
        self.assertEqual(
            mapping["A1111WebpMetadataReader"],
            "A1111 Metadata Reader",
        )


if __name__ == "__main__":
    unittest.main()
