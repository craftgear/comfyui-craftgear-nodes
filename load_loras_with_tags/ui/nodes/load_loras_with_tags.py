from typing import Any, ClassVar

import comfy.sd
import comfy.utils
import folder_paths

from ...logic.lora_catalog import collect_lora_names
from ...logic.trigger_words import (
    extract_lora_triggers,
    filter_lora_triggers,
)

MAX_LORA_STACK = 20


def resolve_lora_name(value: Any, choices: list[str]) -> str:
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


def split_tags(value: Any) -> list[str]:
    if value is None:
        return []
    text = value if isinstance(value, str) else str(value)
    if not text:
        return []
    return [part.strip() for part in text.split(',') if part.strip()]


def dedupe_tags(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = value if isinstance(value, str) else str(value)
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def escape_parentheses(text: str) -> str:
    normalized = text.replace('\\(', '(').replace('\\)', ')')
    if _is_weighted_tag(normalized, normalized=True):
        return _escape_weighted_tag(normalized)
    placeholder_left = '__BS_LP__'
    placeholder_right = '__BS_RP__'
    # 既存のバックスラッシュエスケープを守る
    temp = text.replace('\\(', placeholder_left).replace('\\)', placeholder_right)
    temp = temp.replace('(', '\\(').replace(')', '\\)')
    return temp.replace(placeholder_left, '\\(').replace(placeholder_right, '\\)')


def escape_tags(tags: list[str]) -> list[str]:
    return [escape_parentheses(tag) for tag in tags]


def _is_weighted_tag(text: str, normalized: bool = False) -> bool:
    normalized_text = text if normalized else text.replace('\\(', '(').replace('\\)', ')')
    stripped = normalized_text.strip()
    if len(stripped) < 4 or not (stripped.startswith('(') and stripped.endswith(')')):
        return False
    inner = stripped[1:-1]
    if ':' not in inner:
        return False
    name, weight = inner.split(':', 1)
    if not name.strip():
        return False
    try:
        float(weight.strip())
    except (TypeError, ValueError):
        return False
    return True


def _escape_weighted_tag(text: str) -> str:
    stripped = text.strip()[1:-1]
    name, weight = stripped.split(':', 1)
    name_normalized = name.replace('\\(', '(').replace('\\)', ')').strip()
    escaped_name = name_normalized.replace('(', '\\(').replace(')', '\\)')
    return f'({escaped_name}:{weight.strip()})'


class LoadLorasWithTags:
    def __init__(self) -> None:
        self.loaded_loras: dict[str, Any] = {}

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, Any]]:
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths('loras'),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ['None'] + lora_choices
        required: dict[str, Any] = {
            'model': ('MODEL',),
            'clip': ('CLIP',),
        }
        optional: dict[str, Any] = {
            'tags': ('STRING', {'default': '', 'forceInput': True}),
        }
        for index in range(1, MAX_LORA_STACK + 1):
            required[f'lora_name_{index}'] = (lora_choices,)
            required[f'lora_strength_{index}'] = (
                'FLOAT',
                {
                    'default': 1.0,
                    'min': -2.0,
                    'max': 2.0,
                    'step': 0.1,
                    'display': 'slider',
                },
            )
            required[f'lora_on_{index}'] = ('BOOLEAN', {'default': True})
            required[f'tag_selection_{index}'] = ('STRING', {'default': ''})
        return {'required': required, 'optional': optional}

    RETURN_TYPES: ClassVar[tuple[str, str, str]] = ('MODEL', 'CLIP', 'STRING')
    RETURN_NAMES: ClassVar[tuple[str, str, str]] = ('model', 'clip', 'tags')
    FUNCTION: ClassVar[str] = 'apply'
    CATEGORY: ClassVar[str] = 'craftgear/loras'

    @classmethod
    def VALIDATE_INPUTS(
        cls,
        lora_name_1: Any = None,
        lora_on_1: bool = True,
        lora_name_2: Any = None,
        lora_on_2: bool = True,
        lora_name_3: Any = None,
        lora_on_3: bool = True,
        lora_name_4: Any = None,
        lora_on_4: bool = True,
        lora_name_5: Any = None,
        lora_on_5: bool = True,
        lora_name_6: Any = None,
        lora_on_6: bool = True,
        lora_name_7: Any = None,
        lora_on_7: bool = True,
        lora_name_8: Any = None,
        lora_on_8: bool = True,
        lora_name_9: Any = None,
        lora_on_9: bool = True,
        lora_name_10: Any = None,
        lora_on_10: bool = True,
    ) -> bool | str:
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths('loras'),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ['None'] + lora_choices
        raw_names = [
            lora_name_1,
            lora_name_2,
            lora_name_3,
            lora_name_4,
            lora_name_5,
            lora_name_6,
            lora_name_7,
            lora_name_8,
            lora_name_9,
            lora_name_10,
        ]
        toggles = [
            lora_on_1,
            lora_on_2,
            lora_on_3,
            lora_on_4,
            lora_on_5,
            lora_on_6,
            lora_on_7,
            lora_on_8,
            lora_on_9,
            lora_on_10,
        ]
        for raw_name, is_on in zip(raw_names, toggles):
            if not is_on:
                continue
            resolved = resolve_lora_name(raw_name, lora_choices)
            if not resolved or resolved == 'None':
                continue
            if resolved not in lora_choices:
                return f'LoRA not found: {resolved}'
        return True

    def apply(self, model: Any, clip: Any, **kwargs: Any) -> tuple[Any, Any, str]:
        current_model = model
        current_clip = clip
        all_triggers: list[str] = []
        input_tags = split_tags(kwargs.get('tags', ''))
        lora_choices = collect_lora_names(
            folder_paths.get_folder_paths('loras'),
            folder_paths.supported_pt_extensions,
        )
        lora_choices = ['None'] + lora_choices

        for index in range(1, MAX_LORA_STACK + 1):
            raw_lora_name = kwargs.get(f'lora_name_{index}', 'None')
            lora_name = resolve_lora_name(raw_lora_name, lora_choices)
            lora_strength = kwargs.get(f'lora_strength_{index}', 1.0)
            lora_on = kwargs.get(f'lora_on_{index}', True)
            tag_selection = kwargs.get(f'tag_selection_{index}', '')
            if not lora_on:
                continue
            if not lora_name or lora_name == 'None':
                continue
            lora_path = folder_paths.get_full_path('loras', lora_name)
            if not lora_path:
                continue
            triggers = extract_lora_triggers(lora_path)
            selected_triggers = filter_lora_triggers(triggers, tag_selection)
            all_triggers.extend(selected_triggers)
            if lora_strength == 0:
                continue
            lora = self.loaded_loras.get(lora_path)
            if lora is None:
                lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
                self.loaded_loras[lora_path] = lora
            current_model, current_clip = comfy.sd.load_lora_for_models(
            current_model,
            current_clip,
            lora,
            lora_strength,
            lora_strength,
        )

        escaped_input_tags = escape_tags(input_tags)
        escaped_triggers = escape_tags(dedupe_tags(all_triggers))
        return (current_model, current_clip, ','.join(escaped_input_tags + escaped_triggers))
