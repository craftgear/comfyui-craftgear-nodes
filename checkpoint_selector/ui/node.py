from typing import Any, ClassVar

import comfy.sd
import folder_paths

MAX_CHECKPOINT_STACK = 20


def _normalize_checkpoint_name(value: Any) -> str:
    if isinstance(value, dict):
        if "value" in value:
            return str(value["value"])
        if "name" in value:
            return str(value["name"])
    if value is None:
        return ""
    return str(value)


def _resolve_checkpoint(value: Any, options: list[str]) -> str:
    normalized = _normalize_checkpoint_name(value)
    if not normalized:
        return options[0] if options else ""
    if normalized.isdigit():
        index = int(normalized)
        if 0 <= index < len(options):
            return options[index]
    if normalized in options:
        return normalized
    return options[0] if options else normalized


def _resolve_active_slot(kwargs: dict[str, Any]) -> int:
    for index in range(1, MAX_CHECKPOINT_STACK + 1):
        if kwargs.get(f"slot_active_{index}", False):
            return index
    return 1


class CheckpointSelector:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        base_options = folder_paths.get_filename_list("checkpoints")
        options = [""] + base_options
        required: dict[str, Any] = {}
        for index in range(1, MAX_CHECKPOINT_STACK + 1):
            required[f"ckpt_name_{index}"] = (
                options,
                {"default": ""},
            )
            required[f"slot_active_{index}"] = ("BOOLEAN", {"default": index == 1})
        return {"required": required}

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = ("model", "clip", "vae")
    FUNCTION: ClassVar[str] = "load_checkpoint"
    CATEGORY: ClassVar[str] = "craftgear/checkpoints"

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs: Any) -> bool | str:
        base_options = folder_paths.get_filename_list("checkpoints")
        options = [""] + base_options
        active_index = _resolve_active_slot(kwargs)
        value = kwargs.get(f"ckpt_name_{active_index}", "")
        resolved = _resolve_checkpoint(value, options)
        if not resolved:
            return "Checkpoint not selected"
        if options and resolved not in options:
            return f"Checkpoint not found: {resolved}"
        ckpt_path = folder_paths.get_full_path("checkpoints", resolved)
        if not ckpt_path:
            return f"Checkpoint not found: {resolved}"
        return True

    def load_checkpoint(self, **kwargs: Any) -> tuple[Any, Any, Any]:
        base_options = folder_paths.get_filename_list("checkpoints")
        options = [""] + base_options
        active_index = _resolve_active_slot(kwargs)
        value = kwargs.get(f"ckpt_name_{active_index}", "")
        ckpt_name = _resolve_checkpoint(value, options)
        if not ckpt_name:
            raise ValueError("Checkpoint not selected")
        ckpt_path = folder_paths.get_full_path("checkpoints", ckpt_name)
        if not ckpt_path:
            # パス解決できないと ComfyUI 側で None が渡り例外になるため
            raise ValueError(f"Checkpoint not found: {ckpt_name}")
        # ComfyUI の標準ローダーと同じ解決方法に合わせる
        result = comfy.sd.load_checkpoint_guess_config(
            ckpt_path,
            output_vae=True,
            output_clip=True,
            embedding_directory=folder_paths.get_folder_paths("embeddings"),
        )
        return result[:3]
