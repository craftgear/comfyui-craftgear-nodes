import json
from typing import Any, ClassVar


def split_tags(value: Any) -> list[str]:
    if value is None:
        return []
    text = value if isinstance(value, str) else str(value)
    if text == "":
        return []
    parts = []
    for part in text.split(","):
        stripped = part.strip()
        if stripped == "":
            continue
        parts.append(stripped)
    return parts


def parse_excluded_tags(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip() for item in value if str(item).strip()}
    text = value if isinstance(value, str) else str(value)
    stripped = text.strip()
    if stripped == "":
        return set()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            return {str(item).strip() for item in parsed if str(item).strip()}
    except json.JSONDecodeError:
        pass
    return {part.strip() for part in stripped.split(",") if part.strip()}


def escape_parentheses(text: str) -> str:
    normalized = text.replace("\\(", "(").replace("\\)", ")")
    if _is_weighted_tag(normalized, normalized=True):
        return _escape_weighted_tag(normalized)
    placeholder_left = "__BS_LP__"
    placeholder_right = "__BS_RP__"
    temp = text.replace("\\(", placeholder_left).replace("\\)", placeholder_right)
    temp = temp.replace("(", "\\(").replace(")", "\\)")
    return temp.replace(placeholder_left, "\\(").replace(placeholder_right, "\\)")


def escape_tags(tags: list[str]) -> list[str]:
    return [escape_parentheses(tag) for tag in tags]


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


def _escape_weighted_tag(text: str) -> str:
    stripped = text.strip()[1:-1]
    name, weight = stripped.split(":", 1)
    name_normalized = name.replace("\\(", "(").replace("\\)", ")").strip()
    escaped_name = name_normalized.replace("(", "\\(").replace(")", "\\)")
    return f"({escaped_name}:{weight.strip()})"


class TagToggleTextNode:
    OUTPUT_NODE: ClassVar[bool] = True
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "forceInput": True}),
                "excluded_tags": ("STRING", {"default": "[]", "socketless": True}),
            }
        }

    RETURN_TYPES: ClassVar[tuple[str]] = ("STRING",)
    RETURN_NAMES: ClassVar[tuple[str]] = ("text",)
    FUNCTION: ClassVar[str] = "apply"
    CATEGORY: ClassVar[str] = "craftgear/text"

    def apply(self, text: Any, excluded_tags: Any):
        raw_text = "" if text is None else str(text)
        tags = split_tags(raw_text)
        excluded = parse_excluded_tags(excluded_tags)
        kept = [tag for tag in tags if tag not in excluded]
        escaped = escape_tags(kept)
        return {"ui": {"input_text": (raw_text,)}, "result": (", ".join(escaped),)}
