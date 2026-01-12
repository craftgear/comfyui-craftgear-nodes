from typing import Any, ClassVar

import comfy.sd
import comfy.utils
import folder_paths

from ...logic.main import collect_lora_names
from ...logic.trigger_words import extract_lora_triggers, filter_lora_triggers

MAX_LORA_STACK = 10
DEFAULT_LORA_STACK = 1


class LoadLoraWithTriggersStack:
    def __init__(self) -> None:
        self.loaded_loras: dict[str, Any] = {}

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths("loras"),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ["None"] + lora_choices
        required: dict[str, Any] = {
            "model": ("MODEL",),
            "clip": ("CLIP",),
        }
        # TODO: power_lora_loader のように optional 入力で動的に管理すると保存復元のズレを減らせるため検討する
        for index in range(1, MAX_LORA_STACK + 1):
            required[f"lora_name_{index}"] = (lora_choices,)
            required[f"lora_strength_{index}"] = (
                "FLOAT",
                {
                    "default": 1.0,
                    "min": -2.0,
                    "max": 2.0,
                    "step": 0.1,
                    "display": "slider",
                },
            )
            required[f"trigger_selection_{index}"] = ("STRING", {"default": ""})
        return {"required": required}

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = (
        "model",
        "clip",
        "selected triggers",
    )
    FUNCTION: ClassVar[str] = "select_lora"
    CATEGORY: ClassVar[str] = "craftgear/loras"

    def select_lora(self, model: Any, clip: Any, **kwargs: Any) -> tuple[Any, Any, str]:
        current_model = model
        current_clip = clip
        all_triggers: list[str] = []

        for index in range(1, MAX_LORA_STACK + 1):
            lora_name = kwargs.get(f"lora_name_{index}", "None")
            lora_strength = kwargs.get(f"lora_strength_{index}", 1.0)
            trigger_selection = kwargs.get(f"trigger_selection_{index}", "")
            if not lora_name or lora_name == "None":
                continue
            lora_path = folder_paths.get_full_path("loras", lora_name)
            if not lora_path:
                continue
            triggers = extract_lora_triggers(lora_path)
            selected_triggers = filter_lora_triggers(triggers, trigger_selection)
            all_triggers.extend(selected_triggers)
            if lora_strength == 0:
                continue
            lora = self.loaded_loras.get(lora_path)
            if lora is None:
                lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
                self.loaded_loras[lora_path] = lora
            current_model, current_clip = comfy.sd.load_lora_for_models(
                current_model, current_clip, lora, lora_strength, lora_strength
            )

        return (current_model, current_clip, ",".join(all_triggers))
