from typing import ClassVar

from ..logic.image_loader import (
    build_image_batch,
    list_image_files,
    load_images,
    select_same_size_images,
)


class ImageBatchLoader:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, tuple[str, dict[str, str]]]]:
        return {
            'required': {
                'directory': ('STRING', {'default': ''}),
                'filter': ('STRING', {'default': ''}),
            },
        }

    RETURN_TYPES: ClassVar[tuple[str]] = ('IMAGE',)
    RETURN_NAMES: ClassVar[tuple[str]] = ('batch',)
    FUNCTION: ClassVar[str] = 'load'
    CATEGORY: ClassVar[str] = 'craftgear/image'

    def load(self, directory: str, filter: str) -> tuple['torch.Tensor']:
        paths = list_image_files(directory, filter_pattern=filter)
        images = load_images(paths)
        batch_images = select_same_size_images(images)
        batch = build_image_batch(batch_images)
        return (batch,)
