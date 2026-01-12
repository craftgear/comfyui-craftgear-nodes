from typing import Any, ClassVar

import folder_paths

from ...logic.main import collect_lora_names
from ...logic.trigger_words import extract_lora_triggers, filter_lora_triggers


class AutoLoraLoader:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths("loras"),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ["None"] + lora_choices
        return {
            "required": {
                "lora_name": (lora_choices,),
                "lora_strength": (
                    "FLOAT",
                    {
                        "default": 1.0,
                        "min": -2.0,
                        "max": 2.0,
                        "step": 0.1,
                        "display": "slider",
                    },
                ),
                "trigger_selection": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ("STRING", "FLOAT", "LIST")
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = (
        "lora_name",
        "lora_strength",
        "lora_triggers",
    )
    FUNCTION: ClassVar[str] = "select_lora"
    CATEGORY: ClassVar[str] = "craftgear/loras"

    def select_lora(
        self, lora_name: str, lora_strength: float, trigger_selection: str
    ) -> tuple[str, float, list[str]]:
        if lora_name == "None":
            return ("", lora_strength, [])
        lora_path = folder_paths.get_full_path("loras", lora_name)
        if not lora_path:
            return (lora_name, lora_strength, [])
        triggers = extract_lora_triggers(lora_path)
        selected_triggers = filter_lora_triggers(triggers, trigger_selection)
        return (lora_name, lora_strength, selected_triggers)
