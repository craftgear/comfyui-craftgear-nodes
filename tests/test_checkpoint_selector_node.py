import sys
import types
import unittest
import json

# Stub external modules used by the node
folder_paths = types.SimpleNamespace(
    get_filename_list=lambda *_args, **_kwargs: ['ckptA.safetensors', 'ckptB.safetensors'],
    get_full_path=lambda _category, name: f'/tmp/{name}',
    get_folder_paths=lambda _category: ['/tmp/embeddings'],
)
_default_get_full_path = folder_paths.get_full_path
comfy_sd_calls = []

def _fake_load_checkpoint_guess_config(*args, **kwargs):
    comfy_sd_calls.append({"args": args, "kwargs": dict(kwargs)})
    return ('model', 'clip', 'vae', 'extra')

comfy = types.SimpleNamespace(
    sd=types.SimpleNamespace(load_checkpoint_guess_config=_fake_load_checkpoint_guess_config)
)

sys.modules['folder_paths'] = folder_paths
sys.modules['comfy'] = comfy
sys.modules['comfy.sd'] = comfy.sd

from checkpoint_selector.ui.node import CheckpointSelector  # noqa: E402


class CheckpointSelectorNodeTest(unittest.TestCase):
    def setUp(self) -> None:
        comfy_sd_calls.clear()
        folder_paths.get_full_path = _default_get_full_path

    def test_loads_active_slot_checkpoint(self) -> None:
        node = CheckpointSelector()

        model, clip, vae = node.load_checkpoint(
            ckpt_name_1='ckptA.safetensors',
            slot_active_1=False,
            ckpt_name_2='ckptB.safetensors',
            slot_active_2=True,
        )

        self.assertEqual((model, clip, vae), ('model', 'clip', 'vae'))
        self.assertEqual(comfy_sd_calls[-1]["args"][0], "/tmp/ckptB.safetensors")

    def test_falls_back_to_first_slot_when_none_active(self) -> None:
        node = CheckpointSelector()

        node.load_checkpoint(
            ckpt_name_1='ckptA.safetensors',
            slot_active_1=False,
            ckpt_name_2='ckptB.safetensors',
            slot_active_2=False,
        )

        self.assertEqual(comfy_sd_calls[-1]["args"][0], "/tmp/ckptA.safetensors")

    def test_raises_when_checkpoint_missing(self) -> None:
        folder_paths.get_full_path = lambda *_args, **_kwargs: None
        node = CheckpointSelector()

        with self.assertRaises(ValueError) as ctx:
            node.load_checkpoint(ckpt_name_1='ckptA.safetensors', slot_active_1=True)

        self.assertIn('Checkpoint not found', str(ctx.exception))

    def test_validate_requires_selection(self) -> None:
        result = CheckpointSelector.VALIDATE_INPUTS(ckpt_name_1='', slot_active_1=True)
        self.assertIsInstance(result, str)
        self.assertIn('Checkpoint not selected', result)

    def test_input_types_has_model_json_optional(self) -> None:
        input_types = CheckpointSelector.INPUT_TYPES()
        optional = input_types.get('optional', {})
        self.assertIn('model_json', optional)
        model_json = optional['model_json']
        self.assertEqual(model_json[0], 'STRING')
        self.assertTrue(model_json[1].get('forceInput'))

    def test_load_checkpoint_prioritizes_model_json(self) -> None:
        node = CheckpointSelector()
        node.load_checkpoint(
            ckpt_name_1='ckptA.safetensors',
            slot_active_1=True,
            model_json=json.dumps({'name': 'ckptB.safetensors'}),
        )
        self.assertEqual(comfy_sd_calls[-1]["args"][0], "/tmp/ckptB.safetensors")


if __name__ == '__main__':
    unittest.main()
