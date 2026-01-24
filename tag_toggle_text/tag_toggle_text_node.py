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
    placeholder_left = "__BS_LP__"
    placeholder_right = "__BS_RP__"
    temp = text.replace("\\(", placeholder_left).replace("\\)", placeholder_right)
    temp = temp.replace("(", "\\(").replace(")", "\\)")
    return temp.replace(placeholder_left, "\\(").replace(placeholder_right, "\\)")


def escape_tags(tags: list[str]) -> list[str]:
    return [escape_parentheses(tag) for tag in tags]


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
