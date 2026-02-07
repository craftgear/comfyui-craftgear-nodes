import sys
import types
import unittest
import importlib


class _DummyResponse:
    def __init__(self, data=None, status: int = 200) -> None:
        self.data = data
        self.status = status


class _DummyWebModule(types.SimpleNamespace):
    def __init__(self) -> None:
        super().__init__(
            Request=object,
            Response=object,
            json_response=self.json_response,
        )

    @staticmethod
    def json_response(payload, status: int = 200):
        return _DummyResponse(payload, status=status)


class _DummyRoutes:
    def post(self, _path: str):
        def decorator(handler):
            return handler

        return decorator


class _DummyPromptServer:
    def __init__(self) -> None:
        self.routes = _DummyRoutes()


class _DummyRequest:
    def __init__(self, payload=None, raise_error: bool = False) -> None:
        self._payload = payload if payload is not None else {}
        self._raise_error = raise_error

    async def json(self):
        if self._raise_error:
            raise ValueError('boom')
        return self._payload


class A1111ReaderTriggerApiTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._modules_backup = dict(sys.modules)
        sys.modules['server'] = types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(instance=_DummyPromptServer())
        )
        web_module = _DummyWebModule()
        sys.modules['aiohttp'] = types.SimpleNamespace(web=web_module)
        sys.modules['aiohttp.web'] = web_module
        sys.modules.pop('a1111_webp_metadata_reader.ui.trigger_api', None)
        self.trigger_api = importlib.import_module(
            'a1111_webp_metadata_reader.ui.trigger_api'
        )

    def tearDown(self) -> None:
        sys.modules.clear()
        sys.modules.update(self._modules_backup)

    async def test_read_metadata_preview_success(self) -> None:
        self.trigger_api.logic.read_and_parse_metadata = lambda _path: {
            'model': '{"name":"model"}',
            'loras': '[{"name":"foo"}]',
        }
        response = await self.trigger_api.read_metadata_preview(
            _DummyRequest({'image_path': 'input/sample.webp'})
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(
            response.data,
            {
                'model_json': '{"name":"model"}',
                'loras_json': '[{"name":"foo"}]',
            },
        )

    async def test_read_metadata_preview_invalid_payload(self) -> None:
        response = await self.trigger_api.read_metadata_preview(
            _DummyRequest({}, raise_error=True)
        )
        self.assertEqual(response.data, {'model_json': '{"name":"","hash":"","modelVersionId":""}', 'loras_json': '[]'})

    async def test_read_metadata_preview_handles_reader_error(self) -> None:
        def raise_error(_path: str):
            raise RuntimeError('fail')

        self.trigger_api.logic.read_and_parse_metadata = raise_error
        response = await self.trigger_api.read_metadata_preview(
            _DummyRequest({'image_path': 'input/sample.webp'})
        )
        self.assertEqual(response.data, {'model_json': '{"name":"","hash":"","modelVersionId":""}', 'loras_json': '[]'})


if __name__ == '__main__':
    unittest.main()
