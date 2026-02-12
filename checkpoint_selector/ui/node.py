import json
import os
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


def _normalize_checkpoint_basename(value: Any) -> str:
    text = "" if value is None else str(value).strip()
    if not text:
        return ""
    normalized = text.replace("\\", "/")
    return os.path.basename(normalized).strip()


def _normalize_checkpoint_stem(value: Any) -> str:
    basename = _normalize_checkpoint_basename(value)
    if not basename:
        return ""
    stem, _ext = os.path.splitext(basename)
    return (stem or basename).casefold()


def _parse_model_json_name(value: Any) -> str:
    if value is None:
        return ""
    queue: list[Any] = [value]
    while queue:
        item = queue.pop(0)
        if item is None:
            continue
        if isinstance(item, list):
            queue[0:0] = item
            continue
        if isinstance(item, str):
            text = item.strip()
            if not text:
                continue
            if text.startswith("{") or text.startswith("["):
                try:
                    decoded = json.loads(text)
                except json.JSONDecodeError:
                    return text
                if isinstance(decoded, list):
                    queue[0:0] = decoded
                else:
                    queue.insert(0, decoded)
                continue
            return text
        if isinstance(item, dict):
            for key in ("name", "modelName", "model", "checkpoint", "ckpt_name"):
                raw = item.get(key)
                if raw is None:
                    continue
                text = str(raw).strip()
                if text:
                    return text
            nested = item.get("model")
            if isinstance(nested, (dict, list)):
                queue.insert(0, nested)
            continue
        text = str(item).strip()
        if text:
            return text
    return ""


def _resolve_checkpoint_from_model_json(value: Any, options: list[str]) -> str:
    raw_name = _parse_model_json_name(value)
    if not raw_name:
        return ""
    if raw_name in options:
        return raw_name

    target_basename = _normalize_checkpoint_basename(raw_name).casefold()
    target_stem = _normalize_checkpoint_stem(raw_name)
    if not target_basename:
        return ""

    for option in options:
        if not option:
            continue
        if _normalize_checkpoint_basename(option).casefold() == target_basename:
            return option

    for option in options:
        if not option:
            continue
        if _normalize_checkpoint_stem(option) == target_stem:
            return option
    return ""


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
        optional: dict[str, Any] = {
            "model_json": ("STRING", {"default": "{}", "forceInput": True}),
        }
        return {"required": required, "optional": optional}

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = ("model", "clip", "vae")
    FUNCTION: ClassVar[str] = "load_checkpoint"
    CATEGORY: ClassVar[str] = "craftgear/checkpoints"

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs: Any) -> bool | str:
        base_options = folder_paths.get_filename_list("checkpoints")
        options = [""] + base_options
        resolved_from_model_json = _resolve_checkpoint_from_model_json(
            kwargs.get("model_json", ""),
            options,
        )
        if resolved_from_model_json:
            resolved = resolved_from_model_json
        else:
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
        resolved_from_model_json = _resolve_checkpoint_from_model_json(
            kwargs.get("model_json", ""),
            options,
        )
        if resolved_from_model_json:
            ckpt_name = resolved_from_model_json
        else:
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
