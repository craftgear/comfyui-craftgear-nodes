import os
from typing import Iterable


def collect_checkpoint_names(
    folder_paths: Iterable[str],
    supported_extensions: Iterable[str],
) -> list[str]:
    names: set[str] = set()
    normalized_extensions = {ext.lower() for ext in supported_extensions}
    for folder_path in folder_paths:
        if not os.path.isdir(folder_path):
            continue
        for dirpath, _subdirs, filenames in os.walk(folder_path):
            for filename in filenames:
                _base, ext = os.path.splitext(filename)
                if ext.lower() not in normalized_extensions:
                    continue
                full_path = os.path.join(dirpath, filename)
                if not os.path.isfile(full_path):
                    continue
                relative_path = os.path.relpath(full_path, folder_path)
                names.add(relative_path)
    return sorted(names)
