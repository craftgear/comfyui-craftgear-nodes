from typing import Any

from .camera_shake.camera_shake_node import CameraShakeNode
from .auto_lora_loader.ui import trigger_api
from .auto_lora_loader.ui.nodes.auto_lora_loader import AutoLoraLoader
from .image_batch_loader.ui import select_directory_api
from .image_batch_loader.ui.node import ImageBatchLoader

WEB_DIRECTORY: str = "web"

NODE_CLASS_MAPPINGS: dict[str, Any] = {
    "AutoLoraLoader": AutoLoraLoader,
    "CameraShakeNode": CameraShakeNode,
    "ImageBatchLoader": ImageBatchLoader,
}

NODE_DISPLAY_NAME_MAPPINGS: dict[str, str] = {
    "AutoLoraLoader": "Auto Lora Loader",
    "CameraShakeNode": "Camera Shake",
    "ImageBatchLoader": "Image Batch Loader",
}
