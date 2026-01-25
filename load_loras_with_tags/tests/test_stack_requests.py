import unittest

from load_loras_with_tags.logic import stack_requests


class StackRequestsTest(unittest.TestCase):
    def test_build_stack_requests_defaults(self) -> None:
        result = stack_requests.build_stack_requests({}, 2)
        self.assertEqual(
            result,
            [
                {'name': 'None', 'strength': 1.0, 'enabled': True},
                {'name': 'None', 'strength': 1.0, 'enabled': True},
            ],
        )

    def test_is_active_request(self) -> None:
        self.assertFalse(stack_requests.is_active_request({'name': 'None'}))
        self.assertFalse(stack_requests.is_active_request({'name': 'a', 'enabled': False}))
        self.assertFalse(stack_requests.is_active_request({'name': 'a', 'strength': 0}))
        self.assertTrue(stack_requests.is_active_request({'name': 'a', 'strength': 1}))
