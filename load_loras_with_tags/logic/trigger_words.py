import json
import os
from typing import Any

USE_SS_TAG_FREQUENCY = True
USE_TRAINED_WORDS = True
USE_TRIGGER_WORDS = True
USE_SS_TAG_STRINGS = False


def extract_lora_triggers(lora_path: str) -> list[str]:
    sidecar_trained = _read_sidecar_trained_words(lora_path)
    if sidecar_trained:
        return sidecar_trained
    metadata = _read_safetensors_metadata(lora_path)
    if not metadata:
        return []
    return _extract_triggers_from_metadata(metadata)


def extract_lora_trigger_frequencies(lora_path: str) -> list[tuple[str, float]]:
    sidecar_trained = _read_sidecar_trained_words(lora_path)
    if sidecar_trained:
        return [(tag, float("inf")) for tag in sidecar_trained]
    metadata = _read_safetensors_metadata(lora_path)
    if not metadata:
        return []
    return _extract_trigger_frequencies_from_metadata(metadata)


def filter_lora_triggers(triggers: list[str], selection_text: str) -> list[str]:
    if not triggers:
        return []
    if not selection_text:
        return triggers
    try:
        parsed = json.loads(selection_text)
    except json.JSONDecodeError:
        return triggers
    if not isinstance(parsed, list):
        return triggers
    selected = {str(item) for item in parsed}
    return [trigger for trigger in triggers if trigger in selected]


def _read_safetensors_metadata(lora_path: str) -> dict[str, Any]:
    if os.path.splitext(lora_path)[1].lower() != ".safetensors":
        return {}
    try:
        with open(lora_path, "rb") as file:
            header_size_bytes = file.read(8)
            if len(header_size_bytes) != 8:
                return {}
            header_size = int.from_bytes(header_size_bytes, "little", signed=False)
            if header_size <= 0:
                return {}
            header = file.read(header_size)
        header_json = json.loads(header)
    except (OSError, ValueError, json.JSONDecodeError):
        return {}
    metadata = header_json.get("__metadata__")
    if isinstance(metadata, dict):
        return metadata
    return {}


def _read_sidecar_trained_words(lora_path: str) -> list[str]:
    if os.path.splitext(lora_path)[1].lower() != ".safetensors":
        return []
    base_dir = os.path.dirname(lora_path)
    if not base_dir:
        return []
    candidates = [
        os.path.join(base_dir, "model_info.json"),
        f"{lora_path}.rgthree-info.json",
    ]
    for path in candidates:
        trained_words = _read_trained_words_from_json(path)
        if trained_words:
            return trained_words
    return []


def _read_trained_words_from_json(path: str) -> list[str]:
    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []
    return _extract_trained_words(data)


def _extract_trained_words(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return []
    trained_words = data.get("trainedWords")
    if trained_words is None:
        trained_words = data.get("trained_words")
    return _normalize_trigger_list(_parse_trained_word_values(trained_words))


def _parse_trained_word_values(value: Any) -> list[Any]:
    if isinstance(value, (list, tuple)):
        output: list[Any] = []
        for item in value:
            if isinstance(item, dict) and "word" in item:
                output.append(item["word"])
            else:
                output.append(item)
        return output
    if isinstance(value, dict) and "word" in value:
        return [value["word"]]
    if isinstance(value, str):
        return [value]
    return []


def _extract_triggers_from_metadata(metadata: dict[str, Any]) -> list[str]:
    if not isinstance(metadata, dict):
        return []
    if USE_SS_TAG_FREQUENCY and "ss_tag_frequency" in metadata:
        tags = _tags_from_frequency(metadata["ss_tag_frequency"])
        if tags:
            return tags
    if USE_TRAINED_WORDS and "trained_words" in metadata:
        tags = _normalize_trigger_list(_parse_trigger_values(metadata["trained_words"]))
        if tags:
            return tags
    if USE_TRIGGER_WORDS and "trigger_words" in metadata:
        tags = _normalize_trigger_list(_parse_trigger_values(metadata["trigger_words"]))
        if tags:
            return tags
    if USE_SS_TAG_STRINGS and "ss_tag_strings" in metadata:
        tags = _normalize_trigger_list(_parse_trigger_values(metadata["ss_tag_strings"]))
        if tags:
            return tags
    return []


def _extract_trigger_frequencies_from_metadata(
    metadata: dict[str, Any],
) -> list[tuple[str, float]]:
    if not isinstance(metadata, dict):
        return []
    if USE_SS_TAG_FREQUENCY and "ss_tag_frequency" in metadata:
        return _frequency_from_metadata(metadata["ss_tag_frequency"])
    return []


def _frequency_from_metadata(value: Any) -> list[tuple[str, float]]:
    parsed = value
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError:
            return []
    if not isinstance(parsed, dict):
        return []
    counts: dict[str, float] = {}
    for dataset in parsed.values():
        if not isinstance(dataset, dict):
            continue
        for tag, count in dataset.items():
            tag_text = str(tag).strip()
            if not tag_text:
                continue
            try:
                count_value = float(count)
            except (TypeError, ValueError):
                count_value = 1.0
            counts[tag_text] = counts.get(tag_text, 0.0) + count_value
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return ordered


def _tags_from_frequency(value: Any) -> list[str]:
    ordered = _frequency_from_metadata(value)
    if not ordered:
        return []
    return [tag for tag, _count in ordered]


def _parse_trigger_values(value: Any) -> list[str]:
    parsed = value
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError:
            parsed = [part.strip() for part in parsed.split(",")]
    if isinstance(parsed, dict):
        return list(parsed.keys())
    if isinstance(parsed, (list, tuple)):
        return list(parsed)
    return []


def _normalize_trigger_list(values: list[Any]) -> list[str]:
    output = []
    seen = set()
    for value in values:
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
    return output
