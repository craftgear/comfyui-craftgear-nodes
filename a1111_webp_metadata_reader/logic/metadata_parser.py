import json
import os
import re
import struct
from typing import Any

try:
    from PIL import Image
except Exception:
    Image = None

_DEFAULT_PARSED: dict[str, Any] = {
    'positive_prompt': '',
    'negative_prompt': '',
    'model': json.dumps({'name': '', 'hash': '', 'modelVersionId': ''}, ensure_ascii=False),
    'loras': '[]',
    'steps': 0,
    'sampler': '',
    'cfg_scale': 0.0,
    'seed': 0,
    'size': '',
    'clip_skip': 0,
    'raw_parameters': '',
}


# A1111 形式はカンマ区切りで可変長なため、キー名ベースで安全に抽出する
_KEY_PATTERN = {
    'steps': r'(^|[\n,]\s*)Steps:\s*([0-9]+)',
    'sampler': r'(^|[\n,]\s*)Sampler:\s*([^,\n]+)',
    'cfg_scale': r'(^|[\n,]\s*)CFG scale:\s*([0-9]+(?:\.[0-9]+)?)',
    'seed': r'(^|[\n,]\s*)Seed:\s*([0-9]+)',
    'size': r'(^|[\n,]\s*)Size:\s*([0-9]+x[0-9]+)',
    'clip_skip': r'(^|[\n,]\s*)Clip skip:\s*([0-9]+)',
    'model': r'(^|[\n,]\s*)Model:\s*([^,\n]+)',
    'model_hash': r'(^|[\n,]\s*)Model hash:\s*([^,\n]+)',
}


def _safe_int(value: str) -> int:
    try:
        return int(value)
    except Exception:
        return 0


def _safe_float(value: str) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _extract_prompts(parameters: str) -> tuple[str, str]:
    if not parameters:
        return '', ''
    negative_marker = '\nNegative prompt:'
    steps_marker = '\nSteps:'
    negative_prompt = ''

    if negative_marker in parameters:
        positive, rest = parameters.split(negative_marker, 1)
        if steps_marker in rest:
            negative_prompt = rest.split(steps_marker, 1)[0].strip()
        else:
            negative_prompt = rest.strip()
        return positive.strip(), negative_prompt

    if steps_marker in parameters:
        positive = parameters.split(steps_marker, 1)[0].strip()
        return positive, ''
    return parameters.strip(), ''


def _extract_key_value(parameters: str, key: str) -> str:
    pattern = _KEY_PATTERN.get(key)
    if not pattern:
        return ''
    match = re.search(pattern, parameters, flags=re.IGNORECASE)
    if not match:
        return ''
    return str(match.group(2)).strip()


def _extract_civitai_resources(parameters: str) -> list[dict[str, Any]]:
    marker = 'Civitai resources:'
    if marker not in parameters:
        return []
    text = parameters.split(marker, 1)[1].strip()
    start = text.find('[')
    if start < 0:
        return []

    depth = 0
    end = -1
    for index, char in enumerate(text[start:], start=start):
        if char == '[':
            depth += 1
        elif char == ']':
            depth -= 1
            if depth == 0:
                end = index
                break
    if end < 0:
        return []

    payload = text[start : end + 1]
    try:
        decoded = json.loads(payload)
    except Exception:
        return []
    if isinstance(decoded, list):
        return [item for item in decoded if isinstance(item, dict)]
    return []


def _extract_model_name(parameters: str, resources: list[dict[str, Any]]) -> str:
    model_field = _extract_key_value(parameters, 'model')
    if model_field:
        return model_field
    for item in resources:
        if str(item.get('type', '')).lower() != 'checkpoint':
            continue
        model_name = str(item.get('modelName', '')).strip()
        if model_name:
            return model_name
    return ''


def _normalize_model_version_id(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip()


def _extract_resource_model_version_id(item: dict[str, Any]) -> str:
    for key in (
        'modelVersionId',
        'modelVersionID',
        'model_version_id',
        'versionId',
        'versionID',
        'version_id',
    ):
        if key not in item:
            continue
        resolved = _normalize_model_version_id(item.get(key))
        if resolved:
            return resolved
    return ''


def _extract_model_version_id(resources: list[dict[str, Any]]) -> str:
    for item in resources:
        if str(item.get('type', '')).lower() != 'checkpoint':
            continue
        version_id = _extract_resource_model_version_id(item)
        if version_id:
            return version_id
    return ''


def _extract_segment(parameters: str, label: str) -> str:
    known_labels = (
        'Steps',
        'Sampler',
        'CFG scale',
        'Seed',
        'Size',
        'Clip skip',
        'Model',
        'Model hash',
        'Lora hashes',
        'VAE hash',
        'Created Date',
        'Civitai resources',
        'Civitai metadata',
    )
    next_labels = '|'.join(re.escape(item) for item in known_labels if item != label.rstrip(':'))
    pattern = rf'(^|[\n,]\s*){re.escape(label)}\s*(.*?)(?=(?:,\s*(?:{next_labels}):)|$)'
    match = re.search(pattern, parameters, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ''
    return str(match.group(2)).strip()


def _extract_model_hash(parameters: str) -> str:
    value = _extract_key_value(parameters, 'model_hash')
    if value:
        return value
    return ''


def _extract_lora_hash_map(parameters: str) -> dict[str, str]:
    text = _extract_segment(parameters, 'Lora hashes:')
    if not text:
        return {}
    output: dict[str, str] = {}
    parts = [part.strip() for part in text.split(',') if part.strip()]
    for part in parts:
        if ':' not in part:
            continue
        name, hash_value = part.rsplit(':', 1)
        normalized_name = name.strip()
        normalized_hash = hash_value.strip()
        if not normalized_name:
            continue
        output[normalized_name.casefold()] = normalized_hash
    return output


def _extract_loras(parameters: str, resources: list[dict[str, Any]]) -> str:
    hash_map = _extract_lora_hash_map(parameters)
    values: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in resources:
        if str(item.get('type', '')).lower() != 'lora':
            continue
        model_name = str(item.get('modelName', '')).strip()
        if not model_name:
            continue
        key = model_name.casefold()
        if key in seen:
            continue
        seen.add(key)
        values.append(
            {
                'name': model_name,
                'hash': hash_map.get(key, ''),
                'modelVersionId': _extract_resource_model_version_id(item),
            }
        )
    if values:
        return json.dumps(values, ensure_ascii=False)

    for key, hash_value in hash_map.items():
        if key in seen:
            continue
        seen.add(key)
        values.append({'name': key, 'hash': hash_value, 'modelVersionId': ''})
    return json.dumps(values, ensure_ascii=False)


def parse_a1111_parameters(parameters: str) -> dict[str, Any]:
    if not parameters:
        return dict(_DEFAULT_PARSED)

    positive_prompt, negative_prompt = _extract_prompts(parameters)
    resources = _extract_civitai_resources(parameters)

    result = dict(_DEFAULT_PARSED)
    result['positive_prompt'] = positive_prompt
    result['negative_prompt'] = negative_prompt
    result['model'] = json.dumps(
        {
            'name': _extract_model_name(parameters, resources),
            'hash': _extract_model_hash(parameters),
            'modelVersionId': _extract_model_version_id(resources),
        },
        ensure_ascii=False,
    )
    result['loras'] = _extract_loras(parameters, resources)
    result['steps'] = _safe_int(_extract_key_value(parameters, 'steps'))
    result['sampler'] = _extract_key_value(parameters, 'sampler')
    result['cfg_scale'] = _safe_float(_extract_key_value(parameters, 'cfg_scale'))
    result['seed'] = _safe_int(_extract_key_value(parameters, 'seed'))
    result['size'] = _extract_key_value(parameters, 'size')
    result['clip_skip'] = _safe_int(_extract_key_value(parameters, 'clip_skip'))
    result['raw_parameters'] = parameters
    return result


def _decode_user_comment(value: Any) -> str:
    if isinstance(value, bytes):
        exif_decoded = _decode_exif_user_comment(value)
        if exif_decoded:
            return exif_decoded
        try:
            return value.decode('utf-16le').strip('\x00').strip()
        except Exception:
            try:
                return value.decode('utf-8', errors='ignore').strip('\x00').strip()
            except Exception:
                return ''
    if value is None:
        return ''
    return str(value).strip()


def _decode_exif_user_comment(value: bytes) -> str:
    if not value:
        return ''
    if value.startswith(b'ASCII\x00\x00\x00'):
        return value[8:].decode('utf-8', errors='ignore').strip('\x00').strip()
    if value.startswith(b'UNICODE\x00'):
        body = value[8:]
        # 先頭付近のNULL分布から UTF-16 のエンディアンを推定する
        sample = body[:80]
        even_nulls = sum(1 for index in range(0, len(sample), 2) if sample[index:index + 1] == b'\x00')
        odd_nulls = sum(1 for index in range(1, len(sample), 2) if sample[index:index + 1] == b'\x00')
        if even_nulls > odd_nulls:
            candidates = ('utf-16be', 'utf-16le', 'utf-16', 'utf-8')
        else:
            candidates = ('utf-16le', 'utf-16be', 'utf-16', 'utf-8')
        for encoding in candidates:
            try:
                text = body.decode(encoding, errors='ignore').strip('\x00').strip()
                if text:
                    if 'Steps:' in text or 'Negative prompt:' in text:
                        return text
                    if encoding in {'utf-16le', 'utf-16be'}:
                        return text
            except Exception:
                continue
        return ''
    if value.startswith(b'JIS\x00\x00\x00\x00\x00'):
        return value[8:].decode('shift_jis', errors='ignore').strip('\x00').strip()
    for encoding in ('utf-8', 'utf-16le', 'utf-16be', 'latin-1'):
        try:
            text = value.decode(encoding, errors='ignore').strip('\x00').strip()
            if text:
                return text
        except Exception:
            continue
    return ''


def _iter_riff_chunks(data: bytes):
    if len(data) < 12 or data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        return
    offset = 12
    data_length = len(data)
    while offset + 8 <= data_length:
        fourcc = data[offset : offset + 4]
        size = struct.unpack('<I', data[offset + 4 : offset + 8])[0]
        chunk_start = offset + 8
        chunk_end = chunk_start + size
        if chunk_end > data_length:
            return
        yield fourcc, data[chunk_start:chunk_end]
        offset = chunk_end + (size % 2)


def _extract_webp_exif_chunk(data: bytes) -> bytes:
    for fourcc, chunk_data in _iter_riff_chunks(data):
        if fourcc == b'EXIF':
            return chunk_data
    return b''


def _type_size(field_type: int) -> int:
    return {
        1: 1,  # BYTE
        2: 1,  # ASCII
        3: 2,  # SHORT
        4: 4,  # LONG
        5: 8,  # RATIONAL
        7: 1,  # UNDEFINED
        9: 4,  # SLONG
        10: 8,  # SRATIONAL
    }.get(field_type, 0)


def _read_ifd_entries(tiff: bytes, ifd_offset: int, endian: str) -> list[tuple[int, int, int, bytes]]:
    if ifd_offset < 0 or ifd_offset + 2 > len(tiff):
        return []
    try:
        count = struct.unpack(f'{endian}H', tiff[ifd_offset : ifd_offset + 2])[0]
    except Exception:
        return []
    entries: list[tuple[int, int, int, bytes]] = []
    cursor = ifd_offset + 2
    for _ in range(count):
        if cursor + 12 > len(tiff):
            break
        tag, field_type, value_count = struct.unpack(f'{endian}HHI', tiff[cursor : cursor + 8])
        value_or_offset = tiff[cursor + 8 : cursor + 12]
        entries.append((tag, field_type, value_count, value_or_offset))
        cursor += 12
    return entries


def _read_entry_value(
    tiff: bytes,
    field_type: int,
    value_count: int,
    value_or_offset: bytes,
    endian: str,
) -> bytes:
    unit_size = _type_size(field_type)
    if unit_size <= 0:
        return b''
    full_size = unit_size * value_count
    if full_size <= 4:
        return value_or_offset[:full_size]
    try:
        data_offset = struct.unpack(f'{endian}I', value_or_offset)[0]
    except Exception:
        return b''
    if data_offset < 0 or data_offset + full_size > len(tiff):
        return b''
    return tiff[data_offset : data_offset + full_size]


def _extract_user_comment_from_tiff(tiff: bytes) -> str:
    if len(tiff) < 8:
        return ''
    byte_order = tiff[:2]
    if byte_order == b'II':
        endian = '<'
    elif byte_order == b'MM':
        endian = '>'
    else:
        return ''
    try:
        magic = struct.unpack(f'{endian}H', tiff[2:4])[0]
        ifd0_offset = struct.unpack(f'{endian}I', tiff[4:8])[0]
    except Exception:
        return ''
    if magic != 42:
        return ''
    ifd0_entries = _read_ifd_entries(tiff, ifd0_offset, endian)
    exif_ifd_offset = -1
    for tag, field_type, value_count, value_or_offset in ifd0_entries:
        if tag != 0x8769:
            continue
        value = _read_entry_value(tiff, field_type, value_count, value_or_offset, endian)
        if len(value) < 4:
            continue
        exif_ifd_offset = struct.unpack(f'{endian}I', value[:4])[0]
        break
    if exif_ifd_offset < 0:
        return ''
    exif_entries = _read_ifd_entries(tiff, exif_ifd_offset, endian)
    for tag, field_type, value_count, value_or_offset in exif_entries:
        if tag != 0x9286:
            continue
        raw = _read_entry_value(tiff, field_type, value_count, value_or_offset, endian)
        return _decode_exif_user_comment(raw)
    return ''


def _read_webp_user_comment_from_binary(image_path: str) -> str:
    try:
        with open(image_path, 'rb') as file_obj:
            data = file_obj.read()
    except Exception:
        return ''
    exif_chunk = _extract_webp_exif_chunk(data)
    if not exif_chunk:
        return ''
    tiff = exif_chunk[6:] if exif_chunk.startswith(b'Exif\x00\x00') else exif_chunk
    comment = _extract_user_comment_from_tiff(tiff)
    if comment:
        return comment
    # 最後の保険: UTF-16LE 連続文字列として parameters を拾う
    marker = b'S\x00t\x00e\x00p\x00s\x00:\x00'
    if marker in exif_chunk:
        try:
            text = exif_chunk.decode('utf-16le', errors='ignore').replace('\x00', '').strip()
            if 'Steps:' in text:
                return text
        except Exception:
            return ''
    return ''


def read_metadata_text(image_path: str) -> str:
    if not image_path:
        return ''
    normalized = os.path.expanduser(str(image_path).strip())
    if not normalized:
        return ''
    try:
        if os.path.exists(normalized):
            candidate_path = normalized
        else:
            import folder_paths

            input_dir = folder_paths.get_input_directory()
            joined = os.path.join(input_dir, normalized)
            if os.path.exists(joined):
                candidate_path = joined
            else:
                basename_candidate = os.path.join(input_dir, os.path.basename(normalized))
                if os.path.exists(basename_candidate):
                    candidate_path = basename_candidate
                else:
                    candidate_path = normalized
    except Exception:
        candidate_path = normalized

    webp_comment = _read_webp_user_comment_from_binary(candidate_path)
    if webp_comment:
        return webp_comment

    if Image is None:
        return ''
    try:
        with Image.open(candidate_path) as image:
            exif = image.getexif()
            if exif:
                user_comment = _decode_user_comment(exif.get(37510))
                if user_comment:
                    return user_comment
            info = getattr(image, 'info', {}) or {}
            for key in ('parameters', 'Parameters'):
                value = info.get(key)
                if value:
                    return _decode_user_comment(value)
    except Exception:
        return ''
    return ''


def read_and_parse_metadata(image_path: str) -> dict[str, Any]:
    text = read_metadata_text(image_path)
    return parse_a1111_parameters(text)
