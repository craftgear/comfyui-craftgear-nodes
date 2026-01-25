import unittest

from camera_shake import logic


class CameraShakeLogicTest(unittest.TestCase):
    def test_orientation_params(self) -> None:
        self.assertEqual(logic.compute_orientation_params(1920, 1080), (0.4, 10.0, 6.0))
        self.assertEqual(logic.compute_orientation_params(720, 1280), (0.6, 6.0, 10.0))

    def test_compute_margin_and_scale(self) -> None:
        self.assertEqual(logic.compute_margin(512, 512, 0.0, 10.0, 10.0), 0.0)
        self.assertEqual(logic.compute_scale(512, 512, 0.0, 10.0, 10.0), 1.0)
        margin = logic.compute_margin(64, 32, 1.0, 10.0, 6.0)
        self.assertEqual(margin, 8.0)
        scale = logic.compute_scale(64, 64, 0.5, 6.0, 10.0)
        self.assertGreater(scale, 1.0)

    def test_build_transform_plan_prepad(self) -> None:
        plan = logic.build_transform_plan(64, 32, 1.0, '3_prepad')
        self.assertTrue(plan['use_prepad'])
        self.assertFalse(plan['use_crop'])
        self.assertEqual(plan['scale'], 1.0)
        self.assertEqual(plan['margin_px'], 8)

    def test_build_transform_plan_scale_and_crop(self) -> None:
        scale_plan = logic.build_transform_plan(64, 64, 0.5, '1_scale')
        self.assertFalse(scale_plan['use_prepad'])
        self.assertFalse(scale_plan['use_crop'])
        self.assertGreater(scale_plan['scale'], 1.0)

        crop_plan = logic.build_transform_plan(64, 64, 0.5, '2_crop')
        self.assertTrue(crop_plan['use_crop'])
        self.assertEqual(crop_plan['scale'], 1.0)

        default_plan = logic.build_transform_plan(64, 64, 0.5, 'unknown')
        self.assertFalse(default_plan['use_crop'])
        self.assertEqual(default_plan['scale'], 1.0)


if __name__ == '__main__':
    unittest.main()
