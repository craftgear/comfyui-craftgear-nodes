from typing import Any, ClassVar

import comfy.sd
import comfy.utils
import folder_paths

from ...logic.main import collect_lora_names
from ...logic.trigger_words import extract_lora_triggers, filter_lora_triggers


class AutoLoraLoader:
    def __init__(self) -> None:
        self.loaded_lora: tuple[str, Any] | None = None

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths("loras"),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ["None"] + lora_choices
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
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

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = (
        "model",
        "clip",
        "selected triggers",
    )
    FUNCTION: ClassVar[str] = "select_lora"
    CATEGORY: ClassVar[str] = "craftgear/loras"

    def select_lora(
        self,
        model: Any,
        clip: Any,
        lora_name: str,
        lora_strength: float,
        trigger_selection: str,
    ) -> tuple[Any, Any, str]:
        if lora_name == "None":
            return (model, clip, "")
        lora_path = folder_paths.get_full_path("loras", lora_name)
        if not lora_path:
            return (model, clip, "")
        triggers = extract_lora_triggers(lora_path)
        selected_triggers = filter_lora_triggers(triggers, trigger_selection)
        trigger_words = ",".join(selected_triggers)
        if lora_strength == 0:
            return (model, clip, trigger_words)

        lora = None
        if self.loaded_lora is not None:
            if self.loaded_lora[0] == lora_path:
                lora = self.loaded_lora[1]
            else:
                self.loaded_lora = None

        if lora is None:
            lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_lora = (lora_path, lora)

        model_lora, clip_lora = comfy.sd.load_lora_for_models(
            model, clip, lora, lora_strength, lora_strength
        )
        return (model_lora, clip_lora, trigger_words)
