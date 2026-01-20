import hashlib
import json
import os
import struct
import zlib
from pathlib import Path
from typing import Any

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
TEXT_CHUNK_TYPES = {b'tEXt', b'iTXt', b'zTXt'}

SAMPLER_NAME_MAP = {
    'euler': 'Euler',
    'euler_a': 'Euler a',
    'euler_ancestral': 'Euler a',
    'heun': 'Heun',
    'dpm_2': 'DPM2',
    'dpm_2_a': 'DPM2 a',
    'dpmpp_2s_a': 'DPM++ 2S a',
    'dpmpp_2m': 'DPM++ 2M',
    'dpmpp_2m_sde': 'DPM++ 2M SDE',
    'dpmpp_sde': 'DPM++ SDE',
    'dpmpp_3m_sde': 'DPM++ 3M SDE',
    'dpmpp_3m': 'DPM++ 3M',
    'dpm_fast': 'DPM fast',
    'dpm_adaptive': 'DPM adaptive',
    'ddim': 'DDIM',
    'uni_pc': 'UniPC',
    'lcm': 'LCM',
    'er_sde': 'Euler a SDE',
}

_HASH_CACHE: dict[str, tuple[int, int, str]] = {}
_HASH_CACHE_LOADED = False


def read_png_text(png_bytes: bytes) -> dict[str, str]:
    if not png_bytes.startswith(PNG_SIGNATURE):
        return {}
    output: dict[str, str] = {}
    for chunk_type, data, _chunk_bytes in _iter_png_chunks(png_bytes):
        if chunk_type == b'tEXt':
            key, text = _parse_text_chunk(data)
        elif chunk_type == b'iTXt':
            key, text = _parse_itxt_chunk(data)
        elif chunk_type == b'zTXt':
            key, text = _parse_ztxt_chunk(data)
        else:
            continue
        if key:
            output[key] = text
    return output


def set_png_text_value(png_bytes: bytes, key: str, value: str) -> bytes:
    if not png_bytes.startswith(PNG_SIGNATURE):
        return png_bytes
    normalized_key = key.lower()
    output = bytearray()
    output.extend(PNG_SIGNATURE)
    inserted = False
    for chunk_type, data, chunk_bytes in _iter_png_chunks(png_bytes):
        if chunk_type in TEXT_CHUNK_TYPES:
            chunk_key = _read_chunk_key(chunk_type, data)
            if chunk_key and chunk_key.lower() == normalized_key:
                continue
        if not inserted and chunk_type == b'IHDR':
            output.extend(chunk_bytes)
            output.extend(_build_text_chunk(key, value))
            inserted = True
            continue
        if chunk_type == b'IEND' and not inserted:
            output.extend(_build_text_chunk(key, value))
            inserted = True
        output.extend(chunk_bytes)
    if not inserted:
        output.extend(_build_text_chunk(key, value))
    return bytes(output)


def build_a1111_parameters_from_png(png_bytes: bytes) -> str:
    text_map = read_png_text(png_bytes)
    prompt_text = None
    for key, value in text_map.items():
        if key.lower() == 'prompt':
            prompt_text = value
            break
    if not prompt_text:
        return ''
    try:
        prompt = json.loads(prompt_text)
    except json.JSONDecodeError:
        return ''
    return build_a1111_parameters_from_prompt(prompt)


def build_a1111_parameters_from_prompt(prompt: dict[str, Any]) -> str:
    if not isinstance(prompt, dict):
        return ''
    ksampler = _find_node_by_class(prompt, 'KSampler')
    if not ksampler:
        return ''
    inputs = ksampler.get('inputs', {})
    cache: dict[str, str] = {}
    positive = _resolve_string(inputs.get('positive'), prompt, cache).strip()
    negative = _resolve_string(inputs.get('negative'), prompt, cache).strip()
    lora_tags = _collect_lora_tags(prompt, inputs)
    if lora_tags:
        positive = _append_lora_tags(positive, lora_tags)
    width, height = _resolve_latent_size(inputs.get('latent_image'), prompt)
    model = _resolve_model_name(inputs.get('model'), prompt)
    sampler_name = _map_sampler_name(inputs.get('sampler_name'))
    scheduler = inputs.get('scheduler')
    steps = inputs.get('steps')
    cfg = inputs.get('cfg')
    seed = inputs.get('seed')
    denoise = inputs.get('denoise')

    lines = []
    if positive:
        lines.append(positive)
    if negative:
        lines.append(f'Negative prompt: {negative}')

    params = []
    if steps is not None:
        params.append(f'Steps: {_format_number(steps)}')
    if sampler_name:
        params.append(f'Sampler: {sampler_name}')
    if cfg is not None:
        params.append(f'CFG scale: {_format_number(cfg)}')
    if seed is not None:
        params.append(f'Seed: {_format_number(seed)}')
    if width and height:
        params.append(f'Size: {width}x{height}')
    if model:
        params.append(f'Model: {model}')
    if scheduler:
        params.append(f'Scheduler: {scheduler}')
    if denoise is not None:
        try:
            denoise_value = float(denoise)
        except (TypeError, ValueError):
            denoise_value = None
        if denoise_value is not None and denoise_value < 1.0:
            params.append(f'Denoising strength: {_format_number(denoise_value)}')
    hashes_text = _build_hashes_text(prompt, inputs)
    if hashes_text:
        params.append(f'Hashes: {hashes_text}')
    if params:
        lines.append(', '.join(params))
    return '\n'.join(lines)


def _iter_png_chunks(png_bytes: bytes) -> list[tuple[bytes, bytes, bytes]]:
    chunks = []
    offset = len(PNG_SIGNATURE)
    length = len(png_bytes)
    while offset + 8 <= length:
        data_length = struct.unpack('>I', png_bytes[offset : offset + 4])[0]
        chunk_type = png_bytes[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + data_length
        crc_end = data_end + 4
        if crc_end > length:
            break
        chunk_bytes = png_bytes[offset:crc_end]
        data = png_bytes[data_start:data_end]
        chunks.append((chunk_type, data, chunk_bytes))
        offset = crc_end
        if chunk_type == b'IEND':
            break
    return chunks


def _parse_text_chunk(data: bytes) -> tuple[str, str]:
    if b'\x00' not in data:
        return '', ''
    key, text = data.split(b'\x00', 1)
    return key.decode('latin-1', errors='replace'), text.decode('latin-1', errors='replace')


def _parse_itxt_chunk(data: bytes) -> tuple[str, str]:
    parts = data.split(b'\x00', 5)
    if len(parts) < 6:
        return '', ''
    key = parts[0].decode('latin-1', errors='replace')
    comp_flag = parts[1][:1]
    text_bytes = parts[5]
    if comp_flag in {b'1', b'\x01'}:
        try:
            text_bytes = zlib.decompress(text_bytes)
        except zlib.error:
            text_bytes = b''
    try:
        text = text_bytes.decode('utf-8')
    except UnicodeDecodeError:
        text = text_bytes.decode('latin-1', errors='replace')
    return key, text


def _parse_ztxt_chunk(data: bytes) -> tuple[str, str]:
    if b'\x00' not in data:
        return '', ''
    key, rest = data.split(b'\x00', 1)
    if not rest:
        return '', ''
    text_bytes = rest[1:]
    try:
        text_bytes = zlib.decompress(text_bytes)
    except zlib.error:
        text_bytes = b''
    return key.decode('latin-1', errors='replace'), text_bytes.decode('latin-1', errors='replace')


def _read_chunk_key(chunk_type: bytes, data: bytes) -> str:
    if chunk_type == b'tEXt':
        key, _ = _parse_text_chunk(data)
        return key
    if chunk_type == b'iTXt':
        key, _ = _parse_itxt_chunk(data)
        return key
    if chunk_type == b'zTXt':
        key, _ = _parse_ztxt_chunk(data)
        return key
    return ''


def _build_text_chunk(key: str, value: str) -> bytes:
    key_bytes = key.encode('latin-1', errors='replace')
    try:
        value_bytes = value.encode('latin-1')
        chunk_type = b'tEXt'
        data = key_bytes + b'\x00' + value_bytes
    except UnicodeEncodeError:
        chunk_type = b'iTXt'
        text_bytes = value.encode('utf-8')
        data = (
            key_bytes
            + b'\x00'
            + b'\x00'
            + b'\x00'
            + b'\x00'
            + b'\x00'
            + text_bytes
        )
    return _build_chunk(chunk_type, data)


def _build_chunk(chunk_type: bytes, data: bytes) -> bytes:
    length = struct.pack('>I', len(data))
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    crc_bytes = struct.pack('>I', crc)
    return length + chunk_type + data + crc_bytes


def _find_node_by_class(prompt: dict[str, Any], class_type: str) -> dict[str, Any] | None:
    for node in prompt.values():
        if isinstance(node, dict) and node.get('class_type') == class_type:
            return node
    return None


def _resolve_string(value: Any, prompt: dict[str, Any], cache: dict[str, str]) -> str:
    if _is_link(value):
        return _resolve_node_output(str(value[0]), prompt, cache)
    if value is None:
        return ''
    if isinstance(value, (int, float, bool)):
        return str(value)
    return str(value)


def _resolve_node_output(node_id: str, prompt: dict[str, Any], cache: dict[str, str]) -> str:
    if node_id in cache:
        return cache[node_id]
    node = prompt.get(node_id)
    if not isinstance(node, dict):
        cache[node_id] = ''
        return ''
    class_type = node.get('class_type', '')
    inputs = node.get('inputs', {})
    result = ''
    if class_type in {'CLIPTextEncode', 'CLIPTextEncodeSDXL', 'CLIPTextEncodeSDXLRefiner'}:
        result = _resolve_string(inputs.get('text'), prompt, cache)
    elif class_type == 'CommentableMultilineTextNode':
        text = _resolve_string(inputs.get('text'), prompt, cache)
        separator = _resolve_string(inputs.get('separator', ','), prompt, cache)
        result = _apply_commentable_text(text, separator)
    elif class_type == 'JoinTextNode':
        separator = _resolve_string(inputs.get('separator', ','), prompt, cache)
        result = _apply_join_text(inputs, separator, prompt, cache)
    elif class_type == 'TagToggleTextNode':
        text = _resolve_string(inputs.get('text'), prompt, cache)
        excluded = _resolve_string(inputs.get('excluded_tags', '[]'), prompt, cache)
        result = _apply_tag_toggle(text, excluded)
    elif class_type == 'LoadLorasWithTags':
        tags = _resolve_string(inputs.get('tags', ''), prompt, cache)
        result = _apply_load_loras_with_tags(inputs, tags)
    elif isinstance(inputs.get('text'), str):
        result = _resolve_string(inputs.get('text'), prompt, cache)
    cache[node_id] = result
    return result


def _is_link(value: Any) -> bool:
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return isinstance(value[0], (str, int))
    return False


def _collect_lora_tags(prompt: dict[str, Any], ksampler_inputs: dict[str, Any]) -> list[str]:
    entries: list[tuple[str, float]] = []
    visited: set[str] = set()
    model_link = ksampler_inputs.get('model')
    if _is_link(model_link):
        entries.extend(_collect_lora_entries(str(model_link[0]), prompt, visited))
    if not entries:
        return []
    deduped = _dedupe_lora_entries(entries)
    return [f'<lora:{name}:{_format_number(weight)}>' for name, weight in deduped]


def _collect_lora_entries(
    node_id: str, prompt: dict[str, Any], visited: set[str]
) -> list[tuple[str, float]]:
    if node_id in visited:
        return []
    visited.add(node_id)
    node = prompt.get(node_id)
    if not isinstance(node, dict):
        return []
    class_type = node.get('class_type', '')
    inputs = node.get('inputs', {})
    entries: list[tuple[str, float]] = []
    if class_type == 'LoadLorasWithTags':
        entries.extend(_extract_loras_from_load_loras_with_tags(inputs))
    elif class_type == 'LoraLoader':
        entry = _extract_lora_from_loader(inputs)
        if entry:
            entries.append(entry)
    elif class_type == 'LoraLoaderModelOnly':
        entry = _extract_lora_from_loader_model_only(inputs)
        if entry:
            entries.append(entry)
    for value in inputs.values():
        if _is_link(value):
            entries.extend(_collect_lora_entries(str(value[0]), prompt, visited))
    return entries


def _extract_loras_from_load_loras_with_tags(
    inputs: dict[str, Any],
) -> list[tuple[str, float]]:
    output: list[tuple[str, float]] = []
    for index in range(1, 11):
        if not _is_lora_enabled(inputs.get(f'lora_on_{index}', True)):
            continue
        name = _normalize_lora_name(inputs.get(f'lora_name_{index}', 'None'))
        if not name:
            continue
        weight = _to_float(inputs.get(f'lora_strength_{index}', 1.0))
        if weight is None or _is_zero(weight):
            continue
        output.append((name, weight))
    return output


def _extract_lora_from_loader(inputs: dict[str, Any]) -> tuple[str, float] | None:
    name = _normalize_lora_name(inputs.get('lora_name'))
    if not name:
        return None
    strength_model = _to_float(inputs.get('strength_model'))
    strength_clip = _to_float(inputs.get('strength_clip'))
    weight = _select_lora_weight(strength_model, strength_clip)
    if weight is None or _is_zero(weight):
        return None
    return (name, weight)


def _extract_lora_from_loader_model_only(
    inputs: dict[str, Any],
) -> tuple[str, float] | None:
    name = _normalize_lora_name(inputs.get('lora_name'))
    if not name:
        return None
    strength_model = _to_float(inputs.get('strength_model'))
    if strength_model is None or _is_zero(strength_model):
        return None
    return (name, strength_model)


def _select_lora_weight(
    strength_model: float | None, strength_clip: float | None
) -> float | None:
    if strength_model is not None and not _is_zero(strength_model):
        return strength_model
    if strength_clip is not None and not _is_zero(strength_clip):
        return strength_clip
    if strength_model is not None:
        return strength_model
    if strength_clip is not None:
        return strength_clip
    return None


def _is_zero(value: float) -> bool:
    return abs(value) < 1e-9


def _is_lora_enabled(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if text in {'false', '0', 'off', 'no'}:
        return False
    if text in {'true', '1', 'on', 'yes'}:
        return True
    return True


def _normalize_lora_name(value: Any) -> str:
    if value is None:
        return ''
    resolved = value
    if isinstance(resolved, dict):
        if 'value' in resolved:
            resolved = resolved['value']
        elif 'name' in resolved:
            resolved = resolved['name']
    text = str(resolved).strip()
    if text == '' or text.lower() == 'none':
        return ''
    base = os.path.basename(text)
    lower = base.lower()
    for ext in ('.safetensors', '.ckpt', '.pt'):
        if lower.endswith(ext):
            return base[: -len(ext)]
    return base


def _dedupe_lora_entries(entries: list[tuple[str, float]]) -> list[tuple[str, float]]:
    output: list[tuple[str, float]] = []
    seen: set[str] = set()
    for name, weight in entries:
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        output.append((name, weight))
    return output


def _append_lora_tags(positive: str, tags: list[str]) -> str:
    tags_text = ', '.join(tags)
    if not positive:
        return tags_text
    trimmed = positive.rstrip()
    if trimmed.endswith(','):
        return f'{trimmed} {tags_text}'
    if trimmed.endswith(', '):
        return f'{trimmed}{tags_text}'
    return f'{trimmed}, {tags_text}'


def _build_hashes_text(prompt: dict[str, Any], ksampler_inputs: dict[str, Any]) -> str:
    pairs: list[tuple[str, str]] = []
    model_path = _resolve_checkpoint_path(ksampler_inputs.get('model'), prompt)
    if model_path:
        model_hash = _hash_file_short(model_path)
        if model_hash:
            pairs.append(('model', model_hash))
    lora_pairs = _collect_lora_hashes(prompt, ksampler_inputs)
    pairs.extend(lora_pairs)
    if not pairs:
        return ''
    hashes = {key: value for key, value in pairs}
    return json.dumps(hashes)


def _collect_lora_hashes(
    prompt: dict[str, Any],
    ksampler_inputs: dict[str, Any],
) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    visited: set[str] = set()
    model_link = ksampler_inputs.get('model')
    if _is_link(model_link):
        entries.extend(_collect_lora_hash_entries(str(model_link[0]), prompt, visited))
    return _dedupe_hash_entries(entries)


def _collect_lora_hash_entries(
    node_id: str,
    prompt: dict[str, Any],
    visited: set[str],
) -> list[tuple[str, str]]:
    if node_id in visited:
        return []
    visited.add(node_id)
    node = prompt.get(node_id)
    if not isinstance(node, dict):
        return []
    class_type = node.get('class_type', '')
    inputs = node.get('inputs', {})
    entries: list[tuple[str, str]] = []
    if class_type == 'LoadLorasWithTags':
        entries.extend(_hashes_from_load_loras_with_tags(inputs))
    elif class_type == 'LoraLoader':
        entry = _hash_from_lora_loader(inputs)
        if entry:
            entries.append(entry)
    elif class_type == 'LoraLoaderModelOnly':
        entry = _hash_from_lora_loader_model_only(inputs)
        if entry:
            entries.append(entry)
    for value in inputs.values():
        if _is_link(value):
            entries.extend(_collect_lora_hash_entries(str(value[0]), prompt, visited))
    return entries


def _hashes_from_load_loras_with_tags(
    inputs: dict[str, Any],
) -> list[tuple[str, str]]:
    output: list[tuple[str, str]] = []
    for index in range(1, 11):
        if not _is_lora_enabled(inputs.get(f'lora_on_{index}', True)):
            continue
        raw_name = inputs.get(f'lora_name_{index}', 'None')
        path = _resolve_lora_path(raw_name)
        if not path:
            continue
        name = _normalize_lora_name(raw_name)
        if not name:
            continue
        weight = _to_float(inputs.get(f'lora_strength_{index}', 1.0))
        if weight is None or _is_zero(weight):
            continue
        file_hash = _hash_file_short(path)
        if not file_hash:
            continue
        output.append((f'lora:{name}', file_hash))
    return output


def _hash_from_lora_loader(inputs: dict[str, Any]) -> tuple[str, str] | None:
    raw_name = inputs.get('lora_name')
    path = _resolve_lora_path(raw_name)
    if not path:
        return None
    name = _normalize_lora_name(raw_name)
    if not name:
        return None
    strength_model = _to_float(inputs.get('strength_model'))
    strength_clip = _to_float(inputs.get('strength_clip'))
    weight = _select_lora_weight(strength_model, strength_clip)
    if weight is None or _is_zero(weight):
        return None
    file_hash = _hash_file_short(path)
    if not file_hash:
        return None
    return (f'lora:{name}', file_hash)


def _hash_from_lora_loader_model_only(inputs: dict[str, Any]) -> tuple[str, str] | None:
    raw_name = inputs.get('lora_name')
    path = _resolve_lora_path(raw_name)
    if not path:
        return None
    name = _normalize_lora_name(raw_name)
    if not name:
        return None
    strength_model = _to_float(inputs.get('strength_model'))
    if strength_model is None or _is_zero(strength_model):
        return None
    file_hash = _hash_file_short(path)
    if not file_hash:
        return None
    return (f'lora:{name}', file_hash)


def _dedupe_hash_entries(entries: list[tuple[str, str]]) -> list[tuple[str, str]]:
    output: list[tuple[str, str]] = []
    seen: set[str] = set()
    for key, value in entries:
        if key in seen:
            continue
        seen.add(key)
        output.append((key, value))
    return output


def _hash_file_short(path: str) -> str:
    # ハッシュ計算コストを下げるため永続キャッシュを使う
    _ensure_hash_cache_loaded()
    try:
        stat = os.stat(path)
    except Exception:
        return ''
    cached = _HASH_CACHE.get(path)
    if cached and cached[0] == stat.st_mtime_ns and cached[1] == stat.st_size:
        return cached[2]
    digest = _hash_file_uncached(path)
    if digest:
        _HASH_CACHE[path] = (stat.st_mtime_ns, stat.st_size, digest)
        _save_hash_cache()
    return digest


def _hash_file_uncached(path: str) -> str:
    try:
        hasher = hashlib.sha256()
        with open(path, 'rb') as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b''):
                hasher.update(chunk)
        return hasher.hexdigest()[:10]
    except Exception:
        return ''


def _ensure_hash_cache_loaded() -> None:
    global _HASH_CACHE_LOADED
    if _HASH_CACHE_LOADED:
        return
    _HASH_CACHE_LOADED = True
    cache_path = _hash_cache_path()
    if not cache_path or not os.path.isfile(cache_path):
        return
    try:
        with open(cache_path, 'r', encoding='utf-8') as file:
            payload = json.load(file)
    except Exception:
        return
    entries = payload.get('entries') if isinstance(payload, dict) else None
    if not isinstance(entries, dict):
        return
    for key, value in entries.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            continue
        mtime_ns = value.get('mtime_ns')
        size = value.get('size')
        digest = value.get('hash')
        if not isinstance(mtime_ns, int) or not isinstance(size, int):
            continue
        if not isinstance(digest, str) or digest == '':
            continue
        _HASH_CACHE[key] = (mtime_ns, size, digest)


def _save_hash_cache() -> None:
    cache_path = _hash_cache_path()
    if not cache_path:
        return
    entries = {
        path: {'mtime_ns': mtime_ns, 'size': size, 'hash': digest}
        for path, (mtime_ns, size, digest) in _HASH_CACHE.items()
    }
    payload = {'version': 1, 'entries': entries}
    tmp_path = f'{cache_path}.tmp'
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(tmp_path, 'w', encoding='utf-8') as file:
            json.dump(payload, file)
        os.replace(tmp_path, cache_path)
    except Exception:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


def _hash_cache_path() -> str:
    root = _custom_nodes_root()
    if not root:
        return ''
    return os.path.join(root, 'craftgear_hash_cache.json')


def _custom_nodes_root() -> str:
    try:
        return str(Path(__file__).resolve().parents[2])
    except Exception:
        return ''


def _resolve_checkpoint_path(value: Any, prompt: dict[str, Any]) -> str:
    if not _is_link(value):
        return ''
    node_id = str(value[0])
    ckpt_name = _find_upstream_checkpoint(node_id, prompt, set())
    if not ckpt_name:
        return ''
    path = _resolve_model_file_path(str(ckpt_name), 'checkpoints')
    return path or ''


def _resolve_lora_path(value: Any) -> str:
    if value is None:
        return ''
    resolved = value
    if isinstance(resolved, dict):
        if 'value' in resolved:
            resolved = resolved['value']
        elif 'name' in resolved:
            resolved = resolved['name']
    text = str(resolved).strip()
    if text == '' or text.lower() == 'none':
        return ''
    path = _resolve_model_file_path(text, 'loras')
    return path or ''


def _resolve_model_file_path(name: str, folder_key: str) -> str:
    if os.path.isabs(name) and os.path.isfile(name):
        return name
    if os.path.isfile(name):
        return name
    try:
        import folder_paths

        resolved = folder_paths.get_full_path(folder_key, name)
        if resolved and os.path.isfile(resolved):
            return resolved
    except Exception:
        return ''
    return ''


def _apply_commentable_text(text: str, separator: str) -> str:
    sep = separator.strip()
    if sep == '':
        sep = ','
    kept = []
    for line in str(text).splitlines():
        stripped_leading = line.lstrip()
        if stripped_leading.startswith('#') or stripped_leading.startswith('//'):
            continue
        kept.append(line.strip())
    return sep.join([item for item in kept if item != ''])


def _apply_join_text(
    inputs: dict[str, Any],
    separator: str,
    prompt: dict[str, Any],
    cache: dict[str, str],
) -> str:
    parts: list[str] = []
    for key in sorted(inputs.keys(), key=_text_key_index):
        if not key.startswith('text_'):
            continue
        value = _resolve_string(inputs.get(key), prompt, cache)
        if value is None:
            continue
        for line in str(value).splitlines():
            if line.strip() == '':
                continue
            parts.append(line)
    return _join_parts_without_duplicate_separator(parts, str(separator))


def _text_key_index(name: str) -> int:
    try:
        return int(name.split('_', 1)[1])
    except (IndexError, ValueError):
        return 10**9


def _join_parts_without_duplicate_separator(parts: list[str], separator: str) -> str:
    if not parts:
        return ''
    if separator == '':
        return ''.join(parts)
    result = parts[0]
    for part in parts[1:]:
        if result.endswith(separator) and part.startswith(separator):
            result += part[len(separator) :]
        elif result.endswith(separator) or part.startswith(separator):
            result += part
        else:
            result += separator + part
    return result


def _split_tags(value: Any) -> list[str]:
    if value is None:
        return []
    text = value if isinstance(value, str) else str(value)
    if text == '':
        return []
    return [part.strip() for part in text.split(',') if part.strip()]


def _apply_tag_toggle(text: str, excluded_tags: str) -> str:
    tags = _split_tags(text)
    excluded = _parse_excluded_tags(excluded_tags)
    kept = [tag for tag in tags if tag not in excluded]
    return ', '.join(kept)


def _parse_excluded_tags(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip() for item in value if str(item).strip()}
    text = value if isinstance(value, str) else str(value)
    stripped = text.strip()
    if stripped == '':
        return set()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            return {str(item).strip() for item in parsed if str(item).strip()}
    except json.JSONDecodeError:
        pass
    return {part.strip() for part in stripped.split(',') if part.strip()}


def _apply_load_loras_with_tags(inputs: dict[str, Any], tags: str) -> str:
    output_tags = _split_tags(tags)
    for index in range(1, 11):
        if not inputs.get(f'lora_on_{index}', True):
            continue
        lora_name = str(inputs.get(f'lora_name_{index}', 'None')).strip()
        if lora_name in {'', 'None'}:
            continue
        selection = _parse_tag_selection(inputs.get(f'tag_selection_{index}', ''))
        output_tags.extend(selection)
    return ', '.join(_dedupe_tags(output_tags))


def _parse_tag_selection(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    text = value if isinstance(value, str) else str(value)
    stripped = text.strip()
    if stripped == '':
        return []
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in stripped.split(',') if part.strip()]


def _dedupe_tags(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = value if isinstance(value, str) else str(value)
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def _resolve_model_name(value: Any, prompt: dict[str, Any]) -> str:
    if not _is_link(value):
        return ''
    node_id = str(value[0])
    ckpt_name = _find_upstream_checkpoint(node_id, prompt, set())
    if not ckpt_name:
        return ''
    base = os.path.basename(str(ckpt_name))
    for ext in ('.safetensors', '.ckpt', '.pt'):
        if base.lower().endswith(ext):
            return base[: -len(ext)]
    return base


def _find_upstream_checkpoint(
    node_id: str, prompt: dict[str, Any], visited: set[str]
) -> str:
    if node_id in visited:
        return ''
    visited.add(node_id)
    node = prompt.get(node_id)
    if not isinstance(node, dict):
        return ''
    if node.get('class_type') in {'CheckpointLoaderSimple', 'CheckpointLoader'}:
        inputs = node.get('inputs', {})
        return str(inputs.get('ckpt_name', '') or inputs.get('model_name', ''))
    inputs = node.get('inputs', {})
    for value in inputs.values():
        if _is_link(value):
            result = _find_upstream_checkpoint(str(value[0]), prompt, visited)
            if result:
                return result
    return ''


def _resolve_latent_size(value: Any, prompt: dict[str, Any]) -> tuple[int | None, int | None]:
    if not _is_link(value):
        return None, None
    node_id = str(value[0])
    return _find_latent_size(node_id, prompt, set())


def _find_latent_size(
    node_id: str, prompt: dict[str, Any], visited: set[str]
) -> tuple[int | None, int | None]:
    if node_id in visited:
        return None, None
    visited.add(node_id)
    node = prompt.get(node_id)
    if not isinstance(node, dict):
        return None, None
    inputs = node.get('inputs', {})
    if node.get('class_type') == 'EmptyLatentImage':
        width = inputs.get('width')
        height = inputs.get('height')
        return _to_int(width), _to_int(height)
    for value in inputs.values():
        if _is_link(value):
            width, height = _find_latent_size(str(value[0]), prompt, visited)
            if width and height:
                return width, height
    return None, None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        return int(str(value))
    except ValueError:
        return None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None


def _map_sampler_name(value: Any) -> str:
    if not value:
        return ''
    text = str(value)
    mapped = SAMPLER_NAME_MAP.get(text.lower())
    return mapped or text


def _format_number(value: Any) -> str:
    if isinstance(value, float):
        text = f'{value:.6f}'.rstrip('0').rstrip('.')
        return text or '0'
    return str(value)
