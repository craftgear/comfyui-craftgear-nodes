from typing import ClassVar


class CommentableMultilineTextNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True}),
                "separator": ("STRING", {"default": ","}),
            }
        }

    RETURN_TYPES: ClassVar[tuple[str]] = ("STRING",)
    RETURN_NAMES: ClassVar[tuple[str]] = ("text",)
    FUNCTION: ClassVar[str] = "apply"
    CATEGORY: ClassVar[str] = "craftgear/text"

    @staticmethod
    def _escape_parentheses(text: str) -> str:
        normalized = text.replace("\\(", "(").replace("\\)", ")")
        if CommentableMultilineTextNode._is_weighted_tag(normalized, normalized=True):
            return CommentableMultilineTextNode._escape_weighted_tag(normalized)
        placeholder_left = "__BS_LP__"
        placeholder_right = "__BS_RP__"
        temp = text.replace("\\(", placeholder_left).replace("\\)", placeholder_right)
        temp = temp.replace("(", "\\(").replace(")", "\\)")
        return temp.replace(placeholder_left, "\\(").replace(placeholder_right, "\\)")

    @staticmethod
    def _is_weighted_tag(text: str, normalized: bool = False) -> bool:
        normalized_text = text if normalized else text.replace("\\(", "(").replace("\\)", ")")
        stripped = normalized_text.strip()
        if len(stripped) < 4 or not stripped.startswith("(") or not stripped.endswith(")"):
            return False
        inner = stripped[1:-1]
        if ":" not in inner:
            return False
        name, weight = inner.split(":", 1)
        if not name.strip():
            return False
        try:
            float(weight.strip())
        except (TypeError, ValueError):
            return False
        return True

    @staticmethod
    def _join_without_duplicate_separator(parts: list[str], separator: str) -> str:
        result = ""
        for part in parts:
            if not result:
                result = part
                continue
            # 連結直前に重複セパレータを避ける
            if result.endswith(separator) or part.startswith(separator):
                result += part
            else:
                result += separator + part
        return result

    @staticmethod
    def _escape_weighted_tag(text: str) -> str:
        stripped = text.strip()[1:-1]  # drop outer parentheses
        name, weight = stripped.split(":", 1)
        name_normalized = name.replace("\\(", "(").replace("\\)", ")").strip()
        escaped_name = (
            name_normalized.replace("(", "\\(").replace(")", "\\)")
        )
        return f"({escaped_name}:{weight.strip()})"

    def apply(self, text: str, separator: str):
        separator = separator.strip()
        if separator == "":
            separator = ","
        lines = text.split("\n")
        kept = []
        for line in lines:
            stripped_leading = line.lstrip()
            if stripped_leading.startswith("#") or stripped_leading.startswith("//"):
                continue
            stripped = line.strip()
            if stripped == "":
                # 空行を含めると区切り記号だけが増えてしまうため除外
                continue
            for chunk in stripped.split(separator):
                part = chunk.strip()
                if part == "":
                    continue
                kept.append(self._escape_parentheses(part))
        return (self._join_without_duplicate_separator(kept, separator),)
