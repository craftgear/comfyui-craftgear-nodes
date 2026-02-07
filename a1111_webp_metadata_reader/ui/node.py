from typing import Any, ClassVar

from ..logic import metadata_parser as logic


class A1111WebpMetadataReader:
    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, tuple[str, dict[str, str]]]]:
        return {
            'required': {
                'image_path': ('STRING', {'default': ''}),
            },
        }

    RETURN_TYPES: ClassVar[tuple[str, ...]] = (
        'STRING',
        'STRING',
        'STRING',
        'STRING',
        'INT',
        'STRING',
        'FLOAT',
        'INT',
        'STRING',
        'INT',
        'STRING',
    )
    RETURN_NAMES: ClassVar[tuple[str, ...]] = (
        'positive_prompt',
        'negative_prompt',
        'model json',
        'loras json',
        'steps',
        'sampler',
        'cfg_scale',
        'seed',
        'size',
        'clip_skip',
        'raw_parameters',
    )
    FUNCTION: ClassVar[str] = 'read'
    CATEGORY: ClassVar[str] = 'craftgear/image'

    def read(self, image_path: str) -> tuple[Any, ...]:
        parsed = logic.read_and_parse_metadata(image_path)
        return (
            str(parsed.get('positive_prompt', '')),
            str(parsed.get('negative_prompt', '')),
            str(parsed.get('model', '{"name":"","hash":"","modelVersionId":""}')),
            str(parsed.get('loras', '[]')),
            int(parsed.get('steps', 0) or 0),
            str(parsed.get('sampler', '')),
            float(parsed.get('cfg_scale', 0.0) or 0.0),
            int(parsed.get('seed', 0) or 0),
            str(parsed.get('size', '')),
            int(parsed.get('clip_skip', 0) or 0),
            str(parsed.get('raw_parameters', '')),
        )
