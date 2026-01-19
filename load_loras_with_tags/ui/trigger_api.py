import math
import os
import subprocess
import sys
from typing import Any

import server

import folder_paths
from aiohttp import web

from ..logic.trigger_words import (
    extract_lora_trigger_frequencies,
    extract_lora_triggers,
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


@server.PromptServer.instance.routes.post("/my_custom_node/lora_triggers")
async def load_lora_triggers(request: web.Request) -> web.Response:
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        data = {}
    lora_name = data.get("lora_name") if isinstance(data, dict) else ""
    if not lora_name or lora_name == "None":
        return web.json_response({"triggers": []})
    lora_path = folder_paths.get_full_path("loras", lora_name)
    if not lora_path:
        return web.json_response({"triggers": []})
    triggers = extract_lora_triggers(lora_path)
    frequencies = extract_lora_trigger_frequencies(lora_path)
    return web.json_response(
        {
            "triggers": triggers,
            "frequencies": {
                tag: ("Infinity" if isinstance(count, (int, float)) and not math.isfinite(count) else count)
                for tag, count in frequencies
            },
        }
    )


@server.PromptServer.instance.routes.post("/my_custom_node/open_lora_folder")
async def open_lora_folder(request: web.Request) -> web.Response:
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        data = {}
    lora_name = data.get("lora_name") if isinstance(data, dict) else ""
    if not lora_name or lora_name == "None":
        return web.json_response({"ok": False, "error": "invalid_lora"})
    lora_path = folder_paths.get_full_path("loras", lora_name)
    if not lora_path or not os.path.exists(lora_path):
        return web.json_response({"ok": False, "error": "not_found"})
    folder_path = os.path.dirname(lora_path)
    if not os.path.isdir(folder_path):
        return web.json_response({"ok": False, "error": "invalid_path"})
    opened = _open_folder(folder_path)
    return web.json_response({"ok": opened})
