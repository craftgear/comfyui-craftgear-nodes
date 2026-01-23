import json
import math
import os
from typing import Any

USE_SS_TAG_FREQUENCY = True
USE_TRAINED_WORDS = True
USE_TRIGGER_WORDS = True
USE_SS_TAG_STRINGS = False


def extract_lora_triggers(lora_path: str) -> list[str]:
    sidecar_triggers, _frequencies = _extract_sidecar_triggers_and_frequencies(lora_path)
    metadata = _read_safetensors_metadata(lora_path)
    metadata_triggers = _extract_triggers_from_metadata(metadata) if metadata else []
    return _merge_trigger_lists(sidecar_triggers, metadata_triggers)


def extract_lora_trigger_frequencies(lora_path: str) -> list[tuple[str, float]]:
    sidecar_triggers, sidecar_frequencies = _extract_sidecar_triggers_and_frequencies(lora_path)
    metadata = _read_safetensors_metadata(lora_path)
    metadata_frequencies = _extract_trigger_frequencies_from_metadata(metadata) if metadata else []
    if not sidecar_triggers:
        return metadata_frequencies
    if not metadata_frequencies:
        return sidecar_frequencies
    return _merge_frequency_lists(sidecar_frequencies, metadata_frequencies)


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


def _read_json_if_dict(path: str) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _extract_trained_words(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return []
    trained_words = data.get("trainedWords")
    if trained_words is None:
        trained_words = data.get("trained_words")
    return _normalize_trigger_list(_parse_trained_word_values(trained_words))


def _parse_trained_word_values(value: Any) -> list[Any]:
    def split_text(text: str) -> list[str]:
        if not text:
            return []
        trimmed = text.strip()
        return [trimmed] if trimmed else []

    if isinstance(value, (list, tuple)):
        output: list[Any] = []
        for item in value:
            if isinstance(item, dict):
                if item.get("metadata"):
                    continue
                if "word" in item:
                    word = item["word"]
                    if isinstance(word, str):
                        output.extend(split_text(word))
                    else:
                        output.append(word)
                else:
                    output.append(item)
                continue
            if isinstance(item, str):
                output.extend(split_text(item))
            else:
                output.append(item)
        return output
    if isinstance(value, dict):
        if value.get("metadata"):
            return []
        if "word" in value:
            word = value["word"]
            if isinstance(word, str):
                return split_text(word)
            return [word]
        return []
    if isinstance(value, str):
        return split_text(value)
    return []


def _extract_trained_words_from_json_text(path: str) -> list[str]:
    try:
        with open(path, "rb") as file:
            raw = file.read()
    except OSError:
        return []
    if not raw:
        return []
    text = ""
    used_utf16 = False
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        try:
            text = raw.decode("utf-16")
            used_utf16 = True
        except UnicodeDecodeError:
            text = ""
    if not text:
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="ignore")
    if not used_utf16 and "\x00" in text:
        try:
            text = raw.decode("utf-16")
        except UnicodeDecodeError:
            pass
    if not text:
        return []
    decoder = json.JSONDecoder()
    results: list[Any] = []
    for key in ('"trainedWords"', '"trained_words"'):
        start = 0
        while True:
            index = text.find(key, start)
            if index < 0:
                break
            colon_index = text.find(":", index + len(key))
            if colon_index < 0:
                start = index + len(key)
                continue
            value_start = colon_index + 1
            while value_start < len(text) and text[value_start].isspace():
                value_start += 1
            try:
                value, end = decoder.raw_decode(text, value_start)
            except json.JSONDecodeError:
                start = value_start + 1
                continue
            results.extend(_parse_trained_word_values(value))
            start = end
    return _normalize_trigger_list(results)


def _merge_trigger_lists(primary: list[str], secondary: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in primary + secondary:
        text = str(value).strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def _merge_frequency_lists(
    primary: list[tuple[str, float]],
    secondary: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    counts: dict[str, float] = {}
    order: list[str] = []

    def add(tag: str, count: float) -> None:
        if tag not in counts:
            order.append(tag)
            counts[tag] = count
            return
        current = counts[tag]
        if math.isinf(current) or math.isinf(count):
            counts[tag] = float("inf")
            return
        counts[tag] = current + count

    for tag, count in primary:
        add(tag, count)
    for tag, count in secondary:
        add(tag, count)

    return [(tag, counts[tag]) for tag in order]


def _extract_sidecar_triggers_and_frequencies(
    lora_path: str,
) -> tuple[list[str], list[tuple[str, float]]]:
    if os.path.splitext(lora_path)[1].lower() != ".safetensors":
        return ([], [])
    base_dir = os.path.dirname(lora_path)
    if not base_dir:
        return ([], [])
    payloads = _load_json_payloads_in_directory(lora_path, base_dir)
    model_info_path = os.path.join(base_dir, "model_info.json")
    rgthree_path = f"{lora_path}.rgthree-info.json"
    model_info_data = _read_json_if_dict(model_info_path)
    model_info_payload = _select_model_info_payload(lora_path, model_info_data)
    rgthree_data = _read_json_if_dict(rgthree_path)
    model_counts, model_order = _extract_positive_tag_counts(model_info_payload)
    rgthree_counts, rgthree_order = _extract_positive_tag_counts(rgthree_data)
    counts = model_counts if model_counts else rgthree_counts
    order = model_order if model_counts else rgthree_order
    trained_words: list[str] = []
    for payload in payloads:
        trained_words = _merge_trigger_lists(trained_words, _extract_trained_words(payload))
    for tag in trained_words:
        if tag not in order:
            order[tag] = len(order)
        counts[tag] = float("inf")
    if not counts:
        return ([], [])
    ordered = sorted(counts.items(), key=lambda item: (-item[1], order[item[0]]))
    triggers = [tag for tag, _count in ordered]
    return (triggers, ordered)


def _load_json_payloads_in_directory(lora_path: str, base_dir: str) -> list[dict[str, Any]]:
    try:
        entries = sorted(os.scandir(base_dir), key=lambda entry: entry.name)
    except OSError:
        return []
    payloads: list[dict[str, Any]] = []
    for entry in entries:
        if not entry.is_file():
            continue
        if not entry.name.lower().endswith(".json"):
            continue
        text_trained_words = _extract_trained_words_from_json_text(entry.path)
        data = _read_json_if_dict(entry.path)
        payload = _select_model_info_payload(lora_path, data) if data else {}
        if payload:
            payloads.append(payload)
        if text_trained_words and not _extract_trained_words(payload):
            payloads.append({"trainedWords": text_trained_words})
    return payloads


def _select_model_info_payload(lora_path: str, data: dict[str, Any]) -> dict[str, Any]:
    if not data:
        return {}
    versions = data.get("modelVersions")
    if not isinstance(versions, list) or not versions:
        return data
    file_name = os.path.basename(lora_path)
    matched = _find_model_version_for_file(versions, file_name)
    if matched:
        return matched
    for version in versions:
        if _has_sidecar_payload(version):
            return version
    return {}


def _find_model_version_for_file(versions: list[Any], file_name: str) -> dict[str, Any]:
    for version in versions:
        if not isinstance(version, dict):
            continue
        files = version.get("files")
        if not isinstance(files, list):
            continue
        for file_entry in files:
            if not isinstance(file_entry, dict):
                continue
            if str(file_entry.get("name", "")) == file_name:
                return version
    return {}


def _has_sidecar_payload(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    if _extract_trained_words(data):
        return True
    images = data.get("images")
    if isinstance(images, list):
        for image in images:
            if isinstance(image, dict) and isinstance(image.get("positive"), str):
                if image["positive"].strip():
                    return True
    return False




def _extract_positive_tag_counts(data: dict[str, Any]) -> tuple[dict[str, float], dict[str, int]]:
    counts: dict[str, float] = {}
    order: dict[str, int] = {}
    images = data.get("images")
    if not isinstance(images, list):
        return (counts, order)
    for image in images:
        if not isinstance(image, dict):
            continue
        positive = image.get("positive")
        if not isinstance(positive, str):
            continue
        tags = _parse_positive_prompt(positive)
        for tag in tags:
            if tag not in order:
                order[tag] = len(order)
            counts[tag] = counts.get(tag, 0.0) + 1.0
    return (counts, order)


def _parse_positive_prompt(value: str) -> list[str]:
    if not value:
        return []
    output: list[str] = []
    for part in value.split(","):
        output.extend(_normalize_positive_segment(part))
    return output


def _normalize_positive_segment(segment: str) -> list[str]:
    text = segment.strip()
    if not text:
        return []
    while len(text) >= 2 and (text[0], text[-1]) in (("(", ")"), ("{", "}"), ("[", "]")):
        text = text[1:-1].strip()
    if ":" in text:
        head, tail = text.rsplit(":", 1)
        try:
            float(tail)
            text = head.strip()
        except (TypeError, ValueError):
            pass
    for char in "(){}[]":
        text = text.replace(char, "")
    text = text.strip()
    if not text:
        return []
    if "|" in text:
        return [part.strip() for part in text.split("|") if part.strip()]
    return [text]


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
    seen: set[str] = set()
    for value in values:
        text = str(value).strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output
