import os
import subprocess
import sys
from typing import Any

import server

import folder_paths
from aiohttp import web

from ..logic.checkpoint_preview import (
    DEFAULT_IMAGE_EXTENSIONS,
    select_checkpoint_preview_path,
)


def _open_folder(path: str) -> bool:
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
            return True
        if sys.platform == "darwin":
            subprocess.Popen(["open", path])
            return True
        subprocess.Popen(["xdg-open", path])
        return True
    except Exception:
        return False


@server.PromptServer.instance.routes.post("/my_custom_node/open_checkpoint_folder")
async def open_checkpoint_folder(request: web.Request) -> web.Response:
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        data = {}
    checkpoint_name = (
        data.get("checkpoint_name") if isinstance(data, dict) else ""
    )
    if not checkpoint_name or checkpoint_name == "None":
        return web.json_response(
            {"ok": False, "error": "invalid_checkpoint"}
        )
    ckpt_path = folder_paths.get_full_path("checkpoints", checkpoint_name)
    if not ckpt_path or not os.path.exists(ckpt_path):
        return web.json_response({"ok": False, "error": "not_found"})
    folder_path = os.path.dirname(ckpt_path)
    if not os.path.isdir(folder_path):
        return web.json_response({"ok": False, "error": "invalid_path"})
    opened = _open_folder(folder_path)
    return web.json_response({"ok": opened})


@server.PromptServer.instance.routes.post("/my_custom_node/checkpoint_preview")
async def load_checkpoint_preview(request: web.Request) -> web.StreamResponse:
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        data = {}
    checkpoint_name = (
        data.get("checkpoint_name") if isinstance(data, dict) else ""
    )
    if not checkpoint_name or checkpoint_name == "None":
        return web.json_response(
            {"ok": False, "error": "invalid_checkpoint"}, status=400
        )
    ckpt_path = folder_paths.get_full_path("checkpoints", checkpoint_name)
    if not ckpt_path or not os.path.exists(ckpt_path):
        return web.json_response({"ok": False, "error": "not_found"}, status=404)
    preview_path = select_checkpoint_preview_path(
        ckpt_path, DEFAULT_IMAGE_EXTENSIONS
    )
    if not preview_path:
        return web.json_response({"ok": False, "error": "no_preview"}, status=404)
    return web.FileResponse(preview_path)
