from typing import Any, ClassVar

import comfy.sd
import folder_paths

from ..logic.checkpoint_catalog import collect_checkpoint_names
from ..logic.selection import resolve_selected_slot_index

MAX_CHECKPOINT_STACK = 20


def collect_checkpoint_choices() -> list[str]:
    if hasattr(folder_paths, 'get_filename_list'):
        names = folder_paths.get_filename_list('checkpoints')
    else:
        names = collect_checkpoint_names(
            folder_paths.get_folder_paths('checkpoints'),
            folder_paths.supported_pt_extensions,
        )
    names = [name for name in names if name]
    return ['None'] + names


def resolve_checkpoint_name(value: Any, choices: list[str]) -> str:
    resolved = value
    if isinstance(resolved, dict):
        if 'value' in resolved:
            resolved = resolved['value']
        elif 'name' in resolved:
            resolved = resolved['name']
    if isinstance(resolved, int):
        if 0 <= resolved < len(choices):
            return choices[resolved]
        return 'None'
    if isinstance(resolved, str):
        text = resolved.strip()
        if text.isdigit():
            index = int(text)
            if 0 <= index < len(choices):
                return choices[index]
            return 'None'
        return text
    return 'None'


def resolve_slot_values(kwargs: dict[str, Any], choices: list[str]) -> list[str]:
    values: list[str] = []
    for index in range(1, MAX_CHECKPOINT_STACK + 1):
        raw = kwargs.get(f'ckpt_name_{index}', 'None')
        values.append(resolve_checkpoint_name(raw, choices))
    return values


def load_checkpoint(path: str) -> tuple[Any, Any, Any]:
    embedding_paths = []
    if hasattr(folder_paths, 'get_folder_paths'):
        embedding_paths = folder_paths.get_folder_paths('embeddings')
    return comfy.sd.load_checkpoint_guess_config(
        path,
        output_vae=True,
        output_clip=True,
        embedding_directory=embedding_paths,
    )


class CheckpointSelector:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        choices = collect_checkpoint_choices()
        required: dict[str, Any] = {}
        for index in range(1, MAX_CHECKPOINT_STACK + 1):
            required[f'ckpt_name_{index}'] = (choices,)
        hidden = {
            'unique_id': 'UNIQUE_ID',
            'extra_pnginfo': 'EXTRA_PNGINFO',
        }
        return {'required': required, 'hidden': hidden}

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ('MODEL', 'CLIP', 'VAE')
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = ('model', 'clip', 'vae')
    FUNCTION: ClassVar[str] = 'load'
    CATEGORY: ClassVar[str] = 'craftgear/loaders'

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs: Any) -> bool | str:
        choices = collect_checkpoint_choices()
        slot_values = resolve_slot_values(kwargs, choices)
        selected_index = resolve_selected_slot_index(
            kwargs.get('extra_pnginfo'),
            kwargs.get('unique_id'),
            slot_values,
            MAX_CHECKPOINT_STACK,
        )
        if selected_index < 1 or selected_index > len(slot_values):
            return 'Checkpoint selection is invalid.'
        selected = slot_values[selected_index - 1]
        if not selected or selected == 'None':
            return 'Checkpoint is not selected.'
        if selected not in choices:
            return f'Checkpoint not found: {selected}'
        return True

    def load(self, **kwargs: Any) -> tuple[Any, Any, Any]:
        choices = collect_checkpoint_choices()
        slot_values = resolve_slot_values(kwargs, choices)
        selected_index = resolve_selected_slot_index(
            kwargs.get('extra_pnginfo'),
            kwargs.get('unique_id'),
            slot_values,
            MAX_CHECKPOINT_STACK,
        )
        if selected_index < 1 or selected_index > len(slot_values):
            raise ValueError('Checkpoint selection is invalid.')
        selected = slot_values[selected_index - 1]
        if not selected or selected == 'None':
            raise ValueError('Checkpoint is not selected.')
        ckpt_path = folder_paths.get_full_path('checkpoints', selected)
        if not ckpt_path:
            raise ValueError(f'Checkpoint not found: {selected}')
        return load_checkpoint(ckpt_path)
