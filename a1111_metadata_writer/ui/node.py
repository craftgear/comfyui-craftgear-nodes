import json
import os
import re
from typing import Any, ClassVar

from ..logic import a1111_metadata as logic


def _default_image_path() -> str:
    try:
        import folder_paths

        return folder_paths.get_output_directory()
    except Exception:
        return ''


class A1111MetadataWriter:
    OUTPUT_NODE: ClassVar[bool] = True

    @classmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, tuple]]:
        return {
            'required': {
                'image': ('IMAGE',),
                'overwrite': ('BOOLEAN', {'default': False}),
                'suffix': ('STRING', {'default': '_a1111'}),
                'format': (['png', 'webp'], {'default': 'png'}),
            },
            'hidden': {
                'prompt': 'PROMPT',
                'extra_pnginfo': 'EXTRA_PNGINFO',
            },
        }

    RETURN_TYPES: ClassVar[tuple[str, str]] = ('STRING', 'STRING')
    RETURN_NAMES: ClassVar[tuple[str, str]] = ('parameters', 'path')
    FUNCTION: ClassVar[str] = 'apply'
    CATEGORY: ClassVar[str] = 'craftgear/image'

    def apply(
        self,
        image: Any,
        overwrite: bool,
        suffix: str,
        format: str = 'png',
        prompt: dict[str, Any] | None = None,
        extra_pnginfo: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if prompt is None:
            return _build_result('', '', None)
        parameters = logic.build_a1111_parameters_from_prompt(prompt)
        if not parameters:
            return _build_result('', '', None)
        pil_image = _image_to_pil(image)
        output_format = _normalize_output_format(format)
        if overwrite:
            output_path = _build_overwrite_path(pil_image, prompt, output_format)
        else:
            output_path = _build_output_path(pil_image, suffix, output_format)
        if output_format == 'webp':
            exif = _build_webp_exif(parameters)
            pil_image.save(output_path, exif=exif)
        else:
            pnginfo = _build_pnginfo(prompt, extra_pnginfo, parameters)
            pil_image.save(output_path, pnginfo=pnginfo)
        preview = _build_preview_payload(output_path)
        return _build_result(parameters, output_path, preview)


def _build_output_path(pil_image: Any, suffix: str, output_format: str = 'png') -> str:
    output_dir = _default_image_path()
    if not output_dir:
        raise ValueError('Output directory is not available')
    extension = _normalize_output_format(output_format)
    filename_prefix = _build_filename_prefix(suffix)
    width, height = pil_image.size
    full_output_folder, filename, counter, _subfolder, _prefix = _get_save_image_path(
        filename_prefix,
        output_dir,
        width,
        height,
    )
    filename_with_batch_num = filename.replace('%batch_num%', '0')
    file = f'{filename_with_batch_num}_{counter:05}_.{extension}'
    return os.path.join(full_output_folder, file)


def _build_overwrite_path(
    pil_image: Any, prompt: dict[str, Any], output_format: str = 'png'
) -> str:
    output_dir = _default_image_path()
    if not output_dir:
        raise ValueError('Output directory is not available')
    extension = _normalize_output_format(output_format)
    filename_prefix = _resolve_overwrite_prefix(prompt)
    width, height = pil_image.size
    full_output_folder, filename, counter, _subfolder, _prefix = _get_save_image_path(
        filename_prefix,
        output_dir,
        width,
        height,
    )
    os.makedirs(full_output_folder, exist_ok=True)
    filename_with_batch_num = filename.replace('%batch_num%', '0')
    latest = _find_latest_output_path(full_output_folder, filename_with_batch_num, extension)
    if latest:
        return latest
    file = f'{filename_with_batch_num}_{counter:05}_.{extension}'
    return os.path.join(full_output_folder, file)


def _build_filename_prefix(suffix: Any) -> str:
    normalized = _normalize_suffix(suffix)
    safe_suffix = normalized if normalized else '_a1111'
    return f'ComfyUI{safe_suffix}'


def _normalize_suffix(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, bool):
        return ''
    text = str(value).strip()
    if text == '':
        return ''
    if text.lower() in {'true', 'false', 'none'}:
        return ''
    return text


def _normalize_output_format(value: Any) -> str:
    if value is None:
        return 'png'
    text = str(value).strip().lower()
    if text == 'webp':
        return 'webp'
    return 'png'


def _resolve_overwrite_prefix(prompt: dict[str, Any]) -> str:
    if isinstance(prompt, dict):
        for node in prompt.values():
            if not isinstance(node, dict):
                continue
            if node.get('class_type') != 'SaveImage':
                continue
            inputs = node.get('inputs', {})
            prefix = inputs.get('filename_prefix')
            if prefix:
                return str(prefix)
    return 'ComfyUI'


def _find_latest_output_path(
    folder: str, filename_with_batch_num: str, output_format: str = 'png'
) -> str:
    if not os.path.isdir(folder):
        return ''
    extension = _normalize_output_format(output_format)
    pattern = re.compile(
        rf'^{re.escape(filename_with_batch_num)}_(\d+)_\.{re.escape(extension)}$',
        re.IGNORECASE,
    )
    latest_name = ''
    latest_counter = -1
    for name in os.listdir(folder):
        match = pattern.match(name)
        if not match:
            continue
        try:
            counter = int(match.group(1))
        except ValueError:
            continue
        if counter > latest_counter:
            latest_counter = counter
            latest_name = name
    if not latest_name:
        return ''
    return os.path.join(folder, latest_name)


def _get_save_image_path(
    filename_prefix: str,
    output_dir: str,
    width: int,
    height: int,
) -> tuple[str, str, int, str, str]:
    import folder_paths

    return folder_paths.get_save_image_path(
        filename_prefix,
        output_dir,
        width,
        height,
    )


def _build_pnginfo(
    prompt: dict[str, Any],
    extra_pnginfo: dict[str, Any] | None,
    parameters: str,
):
    from PIL.PngImagePlugin import PngInfo

    pnginfo = PngInfo()
    pnginfo.add_text('prompt', json.dumps(prompt))
    if extra_pnginfo:
        for key, value in extra_pnginfo.items():
            if key in {'prompt', 'parameters'}:
                continue
            pnginfo.add_text(str(key), json.dumps(value))
    pnginfo.add_text('parameters', parameters)
    return pnginfo


def _build_webp_exif(parameters: str) -> bytes:
    from PIL import Image

    exif = Image.Exif()
    exif[37510] = b'ASCII\x00\x00\x00' + parameters.encode('utf-8')
    return exif.tobytes()


def _build_preview_payload(output_path: str) -> dict[str, str] | None:
    if not output_path:
        return None
    output_dir = _default_image_path()
    if not output_dir:
        return None
    output_dir_abs = os.path.abspath(output_dir)
    output_path_abs = os.path.abspath(output_path)
    try:
        common_path = os.path.commonpath([output_dir_abs, output_path_abs])
    except ValueError:
        return None
    if common_path != output_dir_abs:
        return None
    relative_path = os.path.relpath(output_path_abs, output_dir_abs)
    if relative_path.startswith(os.pardir):
        return None
    relative_path = relative_path.replace(os.path.sep, '/')
    subfolder, filename = os.path.split(relative_path)
    if not filename:
        return None
    payload: dict[str, str] = {'filename': filename, 'type': 'output'}
    if subfolder and subfolder != '.':
        payload['subfolder'] = subfolder
    return payload


def _build_result(
    parameters: str,
    output_path: str,
    preview: dict[str, str] | None,
):
    ui_images = [preview] if preview else []
    return {'ui': {'images': ui_images}, 'result': (parameters, output_path)}


def _image_to_pil(image: Any):
    import numpy as np
    from PIL import Image

    data = image
    if hasattr(data, 'detach'):
        data = data.detach()
    if hasattr(data, 'cpu'):
        data = data.cpu()
    if hasattr(data, 'numpy'):
        data = data.numpy()
    if isinstance(data, list):
        data = np.array(data, dtype=np.float32)
    if data is None:
        raise ValueError('Invalid image input')
    if data.ndim == 4:
        data = data[0]
    if data.ndim != 3:
        raise ValueError('Invalid image shape')
    if data.shape[2] > 3:
        data = data[:, :, :3]
    array = np.clip(data * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(array)
