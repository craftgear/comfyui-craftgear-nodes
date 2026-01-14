from typing import Any

from .camera_shake.camera_shake_node import CameraShakeNode
from .commentable_multiline_text.commentable_multiline_text_node import (
    CommentableMultilineTextNode,
)
from .hoge.ui.nodes.hoge import Hoge
from .join_text_node.join_text_node import JoinTextNode
from .load_lora_with_triggers.ui import trigger_api
from .load_lora_with_triggers.ui.nodes.load_lora_with_triggers import (
    LoadLoraWithTriggers,
)
from .load_lora_with_triggers.ui.nodes.load_lora_with_triggers_stack import (
    LoadLoraWithTriggersStack,
)
from .image_batch_loader.ui import select_directory_api
from .image_batch_loader.ui.node import ImageBatchLoader

WEB_DIRECTORY: str = "web"

NODE_CLASS_MAPPINGS: dict[str, Any] = {
    "LoadLoraWithTriggers": LoadLoraWithTriggers,
    "LoadLoraWithTriggersStack": LoadLoraWithTriggersStack,
    "CameraShakeNode": CameraShakeNode,
    "CommentableMultilineTextNode": CommentableMultilineTextNode,
    "Hoge": Hoge,
    "ImageBatchLoader": ImageBatchLoader,
    "JoinTextNode": JoinTextNode,
}

NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {
    "LoadLoraWithTriggers": "Load Lora With Triggers",
    "LoadLoraWithTriggersStack": "Load Lora With Triggers Stack",
    "CameraShakeNode": "Camera Shake",
    "CommentableMultilineTextNode": "Commentable Multiline Text",
    "Hoge": "hoge",
    "ImageBatchLoader": "Image Batch Loader",
    "JoinTextNode": "join_text_node",
}
