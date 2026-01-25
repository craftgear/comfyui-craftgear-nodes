import os
from typing import Iterable

DEFAULT_IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')
_PREVIEW_HINTS = ('preview', 'thumb')
_NAME_SEPARATORS = ('_', '-', '.', ' ')


def select_checkpoint_preview_path(
    checkpoint_path: str,
    supported_extensions: Iterable[str],
) -> str | None:
    if not checkpoint_path or not os.path.exists(checkpoint_path):
        return None
    base_dir = os.path.dirname(checkpoint_path)
    if not os.path.isdir(base_dir):
        return None
    checkpoint_base = os.path.splitext(os.path.basename(checkpoint_path))[0]
    if not checkpoint_base:
        return None
    normalized_extensions = {
        ext.lower() if ext.startswith('.') else f'.{ext.lower()}'
        for ext in supported_extensions
    }
    candidates = [
        name
        for name in os.listdir(base_dir)
        if _is_supported_image(base_dir, name, normalized_extensions)
    ]
    if not candidates:
        return None
    candidates.sort(key=str.lower)
    base_matches = [
        name for name in candidates if _is_base_match(checkpoint_base, name)
    ]
    scoped = base_matches or candidates
    hinted = [name for name in scoped if _has_preview_hint(name)]
    selected = (hinted or scoped)[0] if scoped else None
    if not selected:
        return None
    return os.path.join(base_dir, selected)


def _is_supported_image(
    base_dir: str,
    filename: str,
    normalized_extensions: set[str],
) -> bool:
    full_path = os.path.join(base_dir, filename)
    if not os.path.isfile(full_path):
        return False
    _base, ext = os.path.splitext(filename)
    return ext.lower() in normalized_extensions


def _is_base_match(checkpoint_base: str, filename: str) -> bool:
    base = os.path.splitext(filename)[0]
    if not base:
        return False
    base_lower = base.lower()
    checkpoint_lower = checkpoint_base.lower()
    if base_lower == checkpoint_lower:
        return True
    if not base_lower.startswith(checkpoint_lower):
        return False
    next_index = len(checkpoint_lower)
    if next_index >= len(base_lower):
        return True
    return base_lower[next_index] in _NAME_SEPARATORS


def _has_preview_hint(filename: str) -> bool:
    base = os.path.splitext(os.path.basename(filename))[0]
    base_lower = base.lower()
    return any(hint in base_lower for hint in _PREVIEW_HINTS)
