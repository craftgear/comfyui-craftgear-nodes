import math
from typing import Tuple


def compute_orientation_params(width: int, height: int) -> Tuple[float, float, float]:
    if width > height:
        return 0.4, 10.0, 6.0
    return 0.6, 6.0, 10.0


def compute_margin(
    width: int,
    height: int,
    strength: float,
    move_x: float,
    move_y: float,
) -> float:
    if strength <= 0:
        return 0.0

    base_margin = strength * 10.0
    move_margin = strength * max(move_x, move_y)
    min_dim = min(width, height)
    max_margin = min_dim / 4.0
    return min(base_margin + move_margin, max_margin)


def compute_scale(
    width: int,
    height: int,
    strength: float,
    move_x: float,
    move_y: float,
) -> float:
    margin = compute_margin(width, height, strength, move_x, move_y)

    if margin <= 0:
        return 1.0

    width_scale = width / max(width - 2 * margin, 1.0)
    height_scale = height / max(height - 2 * margin, 1.0)

    return max(1.0, width_scale, height_scale)


def compute_margin_px(
    width: int,
    height: int,
    strength: float,
    move_x: float,
    move_y: float,
) -> int:
    margin = compute_margin(width, height, strength, move_x, move_y)
    return int(math.ceil(margin))


def build_transform_plan(width: int, height: int, strength: float, edge_mode: str) -> dict[str, object]:
    rot_base, move_x, move_y = compute_orientation_params(width, height)
    margin_px = compute_margin_px(width, height, strength, move_x, move_y)
    padding_mode = 'zeros'
    use_prepad = edge_mode == '3_prepad'
    use_crop = edge_mode == '2_crop'
    scale = 1.0
    if edge_mode == '1_scale':
        scale = compute_scale(width, height, strength, move_x, move_y)
    return {
        'rot_base': rot_base,
        'move_x': move_x,
        'move_y': move_y,
        'margin_px': margin_px,
        'scale': scale,
        'padding_mode': padding_mode,
        'use_prepad': use_prepad,
        'use_crop': use_crop,
    }
