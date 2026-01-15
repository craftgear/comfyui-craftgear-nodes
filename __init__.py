from typing import Any

from .camera_shake.camera_shake_node import CameraShakeNode
from .commentable_multiline_text.commentable_multiline_text_node import (
    CommentableMultilineTextNode,
)
from .load_loras_with_tags.ui.nodes.load_loras_with_tags import LoadLorasWithTags
from .join_text_node.join_text_node import JoinTextNode
from .load_loras_with_tags.ui import trigger_api
from .image_batch_loader.ui import select_directory_api
from .image_batch_loader.ui.node import ImageBatchLoader

WEB_DIRECTORY: str = "web"

NODE_CLASS_MAPPINGS: dict[str, Any] = {
    "CameraShakeNode": CameraShakeNode,
    "CommentableMultilineTextNode": CommentableMultilineTextNode,
    "LoadLorasWithTags": LoadLorasWithTags,
    "ImageBatchLoader": ImageBatchLoader,
    "JoinTextNode": JoinTextNode,
}

NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {
    "CameraShakeNode": "Camera Shake",
    "CommentableMultilineTextNode": "Commentable Multiline Text",
    "LoadLorasWithTags": "Load LoRAs With Tags",
    "ImageBatchLoader": "Image Batch Loader",
    "JoinTextNode": "Join Texts",
}
