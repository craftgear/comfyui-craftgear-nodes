import server
from typing import Any

import folder_paths
from aiohttp import web

from ..logic.trigger_words import extract_lora_triggers


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
    return web.json_response({"triggers": triggers})
