from typing import ClassVar


def extract_text_inputs(text_1: str, **kwargs) -> list[str]:
    inputs = {"text_1": text_1}
    for key, value in kwargs.items():
        if key.startswith("text_"):
            inputs[key] = value

    def key_index(name: str) -> int:
        try:
            return int(name.split("_", 1)[1])
        except (IndexError, ValueError):
            return 10**9

    ordered = []
    for key in sorted(inputs.keys(), key=key_index):
        value = inputs[key]
        if value is None:
            continue
        for line in str(value).splitlines():
            if line.strip() == "":
                continue
            ordered.append(line)
    return ordered


def join_parts_without_duplicate_separator(parts: list[str], separator: str) -> str:
    if not parts:
        return ""
    if separator == "":
        return "".join(parts)
    result = parts[0]
    for part in parts[1:]:
        if result.endswith(separator) and part.startswith(separator):
            result += part[len(separator) :]
        elif result.endswith(separator) or part.startswith(separator):
            result += part
        else:
            result += separator + part
    return result


class JoinTextNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_1": (
                    "STRING",
                    {"default": "", "multiline": True, "forceInput": True},
                ),
                "separator": ("STRING", {"default": ",", "socketless": True}),
            }
        }

    RETURN_TYPES: ClassVar[tuple[str]] = ("STRING",)
    RETURN_NAMES: ClassVar[tuple[str]] = ("text",)
    FUNCTION: ClassVar[str] = "apply"
    CATEGORY: ClassVar[str] = "craftgear/text"

    def apply(self, text_1: str, separator: str, **kwargs):
        parts = extract_text_inputs(text_1, **kwargs)
        separator_text = str(separator)
        return (join_parts_without_duplicate_separator(parts, separator_text),)
