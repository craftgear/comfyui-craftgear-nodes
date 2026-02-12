from typing import Any

import server
from aiohttp import web

from ..logic import metadata_parser as logic

_EMPTY_MODEL_JSON = '{"name":"","hash":"","modelVersionId":""}'
_EMPTY_LORAS_JSON = '[]'


def _resolve_empty_payload() -> dict[str, str]:
    return {
        'model_json': _EMPTY_MODEL_JSON,
        'loras_json': _EMPTY_LORAS_JSON,
    }


@server.PromptServer.instance.routes.post('/my_custom_node/a1111_reader_metadata')
async def read_metadata_preview(request: web.Request) -> web.Response:
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        data = {}

    image_path = str(data.get('image_path', '') if isinstance(data, dict) else '').strip()
    if not image_path:
        return web.json_response(_resolve_empty_payload())

    try:
        parsed = logic.read_and_parse_metadata(image_path)
    except Exception:
        return web.json_response(_resolve_empty_payload())

    return web.json_response(
        {
            'model_json': str(parsed.get('model', _EMPTY_MODEL_JSON)),
            'loras_json': str(parsed.get('loras', _EMPTY_LORAS_JSON)),
        }
    )
