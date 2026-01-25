from typing import Any

SELECTED_SLOT_PROPERTY = 'checkpointSelectorSelectedSlot'


def resolve_selected_slot_index(
    extra_pnginfo: Any,
    unique_id: Any,
    slot_values: list[str] | None,
    max_slots: int = 20,
) -> int:
    selected = _read_selected_slot(extra_pnginfo, unique_id)
    index = _normalize_index(selected, max_slots)
    if index is not None:
        return index
    fallback = _find_first_filled_slot(slot_values)
    return fallback or 1


def _read_selected_slot(extra_pnginfo: Any, unique_id: Any) -> Any:
    if not unique_id:
        return None
    if not isinstance(extra_pnginfo, dict):
        return None
    workflow = extra_pnginfo.get('workflow')
    if not isinstance(workflow, dict):
        return None
    nodes = workflow.get('nodes')
    if not isinstance(nodes, list):
        return None
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if str(node.get('id')) != str(unique_id):
            continue
        properties = node.get('properties')
        if isinstance(properties, dict):
            return properties.get(SELECTED_SLOT_PROPERTY)
    return None


def _normalize_index(value: Any, max_slots: int) -> int | None:
    if value is None:
        return None
    try:
        index = int(value)
    except (TypeError, ValueError):
        return None
    if index < 1 or index > max_slots:
        return None
    return index


def _find_first_filled_slot(slot_values: list[str] | None) -> int | None:
    if not slot_values:
        return None
    for idx, value in enumerate(slot_values, start=1):
        if _is_filled_name(value):
            return idx
    return None


def _is_filled_name(value: Any) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if not text:
        return False
    return text != 'None'
