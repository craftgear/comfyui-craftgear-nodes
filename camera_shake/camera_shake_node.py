import math
from typing import Tuple

import torch
import torch.nn.functional as F

EDGE_MODES = (
    '1_scale',
    '2_crop',
    '3_prepad',
)


def generate_smooth_series(
    length: int,
    device: torch.device,
    alpha: float = 0.85,
) -> torch.Tensor:
    noise = torch.randn(length, device=device)
    values = torch.zeros_like(noise)

    for index in range(length):
        if index == 0:
            values[index] = noise[index]
        else:
            values[index] = values[index - 1] * alpha + noise[index] * (1 - alpha)

    values = values - values.mean()
    max_abs = values.abs().max()
    if max_abs > 0:
        values = values / max_abs

    return values


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


def build_transform(
    batch: int,
    width: int,
    height: int,
    strength: float,
    rot_base: float,
    move_x: float,
    move_y: float,
    scale: float,
    device: torch.device,
    dtype: torch.dtype,
) -> torch.Tensor:
    dx = generate_smooth_series(batch, device) * move_x * strength
    dy = generate_smooth_series(batch, device) * move_y * strength
    rot_deg = generate_smooth_series(batch, device) * rot_base * strength
    rot_rad = rot_deg * (math.pi / 180.0)

    cos_val = torch.cos(rot_rad) * scale
    sin_val = torch.sin(rot_rad) * scale

    tx = 2.0 * dx / max(width - 1, 1)
    ty = 2.0 * dy / max(height - 1, 1)

    theta = torch.zeros((batch, 2, 3), device=device, dtype=dtype)
    theta[:, 0, 0] = cos_val
    theta[:, 0, 1] = -sin_val
    theta[:, 1, 0] = sin_val
    theta[:, 1, 1] = cos_val
    theta[:, 0, 2] = tx
    theta[:, 1, 2] = ty

    return theta


def crop_and_resize(
    images_nchw: torch.Tensor,
    margin_px: int,
    target_height: int,
    target_width: int,
) -> torch.Tensor:
    if margin_px <= 0:
        return images_nchw

    _, _, height, width = images_nchw.shape
    if margin_px * 2 >= height or margin_px * 2 >= width:
        return images_nchw

    cropped = images_nchw[:, :, margin_px : height - margin_px, margin_px : width - margin_px]
    return F.interpolate(
        cropped,
        size=(target_height, target_width),
        mode='bilinear',
        align_corners=False,
    )


def pad_images(images_nchw: torch.Tensor, pad_px: int) -> torch.Tensor:
    if pad_px <= 0:
        return images_nchw
    # WHY: 反射では小さい画像で失敗しやすいため、複製で安全に余白を作る
    return F.pad(images_nchw, (pad_px, pad_px, pad_px, pad_px), mode='replicate')


class CameraShakeNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'images': ('IMAGE',),
                'strength': ('FLOAT', {'default': 1.0, 'min': 0.0, 'max': 3.0, 'step': 0.05}),
                'edge_mode': (EDGE_MODES,),
            }
        }

    RETURN_TYPES = ('IMAGE',)
    RETURN_NAMES = ('images',)
    FUNCTION = 'apply'
    CATEGORY = 'craftgear/image'

    def apply(self, images, strength: float, edge_mode: str):
        if images.dim() != 4:
            raise ValueError('images must be a 4D tensor')

        if strength <= 0:
            return (images,)

        batch, height, width, _channels = images.shape
        if batch == 0:
            return (images,)

        device = images.device
        dtype = images.dtype
        images_nchw = images.permute(0, 3, 1, 2)

        rot_base, move_x, move_y = compute_orientation_params(width, height)
        margin = compute_margin(width, height, float(strength), move_x, move_y)
        margin_px = int(math.ceil(margin))

        if edge_mode == '3_prepad':
            padded = pad_images(images_nchw, margin_px)
            padded_height = padded.shape[2]
            padded_width = padded.shape[3]
            theta = build_transform(
                batch,
                padded_width,
                padded_height,
                float(strength),
                rot_base,
                move_x,
                move_y,
                1.0,
                device,
                dtype,
            )
            grid = F.affine_grid(theta, padded.size(), align_corners=False)
            warped = F.grid_sample(
                padded,
                grid,
                mode='bilinear',
                padding_mode='zeros',
                align_corners=False,
            )
            if margin_px <= 0:
                output = warped
            else:
                output = warped[
                    :,
                    :,
                    margin_px : margin_px + height,
                    margin_px : margin_px + width,
                ]
            return (output.permute(0, 2, 3, 1),)

        if edge_mode == '1_scale':
            scale = compute_scale(width, height, float(strength), move_x, move_y)
            padding_mode = 'zeros'
        elif edge_mode == '2_crop':
            scale = 1.0
            padding_mode = 'zeros'
        else:
            scale = 1.0
            padding_mode = 'zeros'

        theta = build_transform(
            batch,
            width,
            height,
            float(strength),
            rot_base,
            move_x,
            move_y,
            scale,
            device,
            dtype,
        )
        grid = F.affine_grid(theta, images_nchw.size(), align_corners=False)
        warped = F.grid_sample(
            images_nchw,
            grid,
            mode='bilinear',
            padding_mode=padding_mode,
            align_corners=False,
        )
        if edge_mode == '2_crop':
            warped = crop_and_resize(warped, margin_px, height, width)
        output = warped.permute(0, 2, 3, 1)
        return (output,)
