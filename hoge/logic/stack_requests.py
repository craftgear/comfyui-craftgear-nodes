from typing import Any


def build_stack_requests(values: dict[str, Any], max_stack: int) -> list[dict[str, Any]]:
    requests = []
    for index in range(1, max_stack + 1):
        requests.append(
            {
                'name': values.get(f'lora_name_{index}', 'None'),
                'strength': values.get(f'lora_strength_{index}', 1.0),
                'enabled': values.get(f'lora_on_{index}', True),
            }
        )
    return requests


def is_active_request(request: dict[str, Any]) -> bool:
    if not request.get('enabled', True):
        return False
    name = request.get('name')
    if not name or name == 'None':
        return False
    strength = request.get('strength', 0)
    if strength == 0:
        return False
    return True
