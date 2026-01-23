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
            kept.append(stripped)
        return (separator.join(kept),)
