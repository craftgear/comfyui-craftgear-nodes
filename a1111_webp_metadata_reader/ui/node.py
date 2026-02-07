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

    def read(self, image_path: str) -> dict[str, Any]:
        parsed = logic.read_and_parse_metadata(image_path)
        positive_prompt = str(parsed.get('positive_prompt', ''))
        negative_prompt = str(parsed.get('negative_prompt', ''))
        model_json = str(parsed.get('model', '{"name":"","hash":"","modelVersionId":""}'))
        loras_json = str(parsed.get('loras', '[]'))
        steps = int(parsed.get('steps', 0) or 0)
        sampler = str(parsed.get('sampler', ''))
        cfg_scale = float(parsed.get('cfg_scale', 0.0) or 0.0)
        seed = int(parsed.get('seed', 0) or 0)
        size = str(parsed.get('size', ''))
        clip_skip = int(parsed.get('clip_skip', 0) or 0)
        raw_parameters = str(parsed.get('raw_parameters', ''))
        return {
            'ui': {
                'model_json': [model_json],
                'loras_json': [loras_json],
            },
            'result': (
                positive_prompt,
                negative_prompt,
                model_json,
                loras_json,
                steps,
                sampler,
                cfg_scale,
                seed,
                size,
                clip_skip,
                raw_parameters,
            ),
        }
