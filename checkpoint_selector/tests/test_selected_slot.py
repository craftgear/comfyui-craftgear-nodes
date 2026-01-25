import unittest

from checkpoint_selector.logic.selection import (
    resolve_selected_slot_index,
    SELECTED_SLOT_PROPERTY,
)


class SelectedSlotResolverTest(unittest.TestCase):
    def test_resolves_from_workflow_properties(self) -> None:
        extra_pnginfo = {
            'workflow': {
                'nodes': [
                    {
                        'id': 12,
                        'properties': {
                            SELECTED_SLOT_PROPERTY: 3,
                        },
                    }
                ]
            }
        }
        resolved = resolve_selected_slot_index(extra_pnginfo, unique_id='12', slot_values=None)
        self.assertEqual(resolved, 3)

    def test_falls_back_to_first_filled_slot(self) -> None:
        extra_pnginfo = {'workflow': {'nodes': []}}
        slot_values = ['None', 'model.safetensors', 'None']
        resolved = resolve_selected_slot_index(extra_pnginfo, unique_id='1', slot_values=slot_values)
        self.assertEqual(resolved, 2)

    def test_falls_back_to_first_slot_when_empty(self) -> None:
        resolved = resolve_selected_slot_index({}, unique_id='1', slot_values=['None', 'None'])
        self.assertEqual(resolved, 1)


if __name__ == '__main__':
    unittest.main()
