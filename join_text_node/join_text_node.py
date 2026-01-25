from typing import ClassVar


def extract_text_inputs(text_1: str | None, **kwargs) -> list[str]:
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
        try:
            text_value = str(value)
        except Exception:
            # 入力が未接続などで不正値の場合は無視する
            continue
        for line in text_value.splitlines():
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
                "separator": ("STRING", {"default": ",", "socketless": True}),
            },
            "optional": {
                "text_1": (
                    "STRING",
                    {"default": "", "multiline": True, "forceInput": True},
                )
            },
        }

    RETURN_TYPES: ClassVar[tuple[str]] = ("STRING",)
    RETURN_NAMES: ClassVar[tuple[str]] = ("text",)
    FUNCTION: ClassVar[str] = "apply"
    CATEGORY: ClassVar[str] = "craftgear/text"

    def apply(self, separator: str, **kwargs):
        text_1 = kwargs.pop("text_1", None)
        parts = extract_text_inputs(text_1, **kwargs)
        separator_text = str(separator)
        return (join_parts_without_duplicate_separator(parts, separator_text),)
