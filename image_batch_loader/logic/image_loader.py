import os
import re
from typing import Iterable, TYPE_CHECKING

if TYPE_CHECKING:
    import torch

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}


def _compile_filter(pattern: str) -> re.Pattern | None:
    if not pattern:
        return None
    try:
        return re.compile(pattern, re.IGNORECASE)
    except re.error:
        return None


def list_image_files(
    directory: str,
    extensions: Iterable[str] = ALLOWED_EXTENSIONS,
    filter_pattern: str = '',
) -> list[str]:
    if not os.path.isdir(directory):
        return []
    normalized = {ext.lower() for ext in extensions}
    name_filter = _compile_filter(filter_pattern)
    files = []
    for name in sorted(os.listdir(directory)):
        full_path = os.path.join(directory, name)
        if not os.path.isfile(full_path):
            continue
        _, ext = os.path.splitext(name)
        if ext.lower() not in normalized:
            continue
        if name_filter and not name_filter.search(name):
            continue
        files.append(full_path)
    return files


def load_images(paths: Iterable[str]) -> list['torch.Tensor']:
    import node_helpers
    import numpy as np
    import torch
    from PIL import Image, ImageOps

    images: list[torch.Tensor] = []
    for path in paths:
        try:
            img = node_helpers.pillow(Image.open, path)
            img = node_helpers.pillow(ImageOps.exif_transpose, img)
            if img.mode == 'I':
                img = img.point(lambda value: value * (1 / 255))
            image = img.convert('RGB')
            array = np.array(image).astype(np.float32) / 255.0
            tensor = torch.from_numpy(array)[None,]
            images.append(tensor)
        except Exception:
            continue
    return images


def select_same_size_images(images: list['torch.Tensor']) -> list['torch.Tensor']:
    if not images:
        return []
    base_shape = images[0].shape
    return [image for image in images if image.shape == base_shape]


def build_image_batch(images: list['torch.Tensor']) -> 'torch.Tensor':
    import torch

    if not images:
        return torch.zeros((0, 0, 0, 3), dtype=torch.float32)
    return torch.cat(images, dim=0)
