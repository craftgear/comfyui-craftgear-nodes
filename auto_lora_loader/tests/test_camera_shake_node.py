import sys
import unittest
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from camera_shake import camera_shake_node


class TestCameraShakeNode(unittest.TestCase):
    def test_compute_margin_zero_strength(self):
        margin = camera_shake_node.compute_margin(512, 512, 0.0, 10.0, 10.0)
        self.assertEqual(margin, 0.0)

    def test_compute_margin_positive_strength(self):
        margin = camera_shake_node.compute_margin(512, 512, 1.0, 10.0, 10.0)
        self.assertGreater(margin, 0.0)
        self.assertLessEqual(margin, 128.0)

    def test_orientation_params_landscape(self):
        rot_base, move_x, move_y = camera_shake_node.compute_orientation_params(1920, 1080)
        self.assertEqual(rot_base, 0.4)
        self.assertEqual(move_x, 10.0)
        self.assertEqual(move_y, 6.0)

    def test_orientation_params_portrait(self):
        rot_base, move_x, move_y = camera_shake_node.compute_orientation_params(720, 1280)
        self.assertEqual(rot_base, 0.6)
        self.assertEqual(move_x, 6.0)
        self.assertEqual(move_y, 10.0)

    def test_compute_scale_no_strength(self):
        scale = camera_shake_node.compute_scale(512, 512, 0.0, 10.0, 10.0)
        self.assertEqual(scale, 1.0)

    def test_compute_scale_positive_strength(self):
        scale = camera_shake_node.compute_scale(512, 512, 1.0, 10.0, 10.0)
        self.assertGreaterEqual(scale, 1.0)

    def test_generate_smooth_series_range(self):
        series = camera_shake_node.generate_smooth_series(8, torch.device('cpu'))
        self.assertEqual(series.numel(), 8)
        self.assertLessEqual(float(series.abs().max()), 1.0)

    def test_apply_edge_modes_output_shape(self):
        torch.manual_seed(0)
        images = torch.zeros((2, 16, 16, 3), dtype=torch.float32)
        node = camera_shake_node.CameraShakeNode()
        edge_modes = [
            "1_scale",
            "2_crop",
            "3_prepad",
        ]
        for edge_mode in edge_modes:
            (output,) = node.apply(images, 1.0, edge_mode)
            self.assertEqual(output.shape, images.shape)


if __name__ == '__main__':
    unittest.main()
