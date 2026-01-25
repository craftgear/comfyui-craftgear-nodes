import os
import sys
import tempfile
import types
import unittest


class _DummyResponse:
    def __init__(self, data=None, status: int = 200, path: str | None = None) -> None:
        self.data = data
        self.status = status
        self.path = path


class _DummyWebModule(types.SimpleNamespace):
    def __init__(self) -> None:
        super().__init__(
            Request=object,
            json_response=self.json_response,
            FileResponse=self.FileResponse,
        )

    @staticmethod
    def json_response(payload, status: int = 200):
        return _DummyResponse(payload, status=status)

    class FileResponse(_DummyResponse):
        def __init__(self, path: str) -> None:
            super().__init__(None, status=200, path=path)


class _DummyRoutes:
    def post(self, _path: str):
        def decorator(handler):
            return handler

        return decorator


class _DummyPromptServer:
    def __init__(self) -> None:
        self.routes = _DummyRoutes()


class _DummyRequest:
    def __init__(self, payload, raise_error: bool = False) -> None:
        self._payload = payload
        self._raise_error = raise_error

    async def json(self):
        if self._raise_error:
            raise ValueError("boom")
        return self._payload


class TriggerApiTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._modules_backup = dict(sys.modules)
        sys.modules["server"] = types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(instance=_DummyPromptServer())
        )
        web_module = _DummyWebModule()
        aiohttp_module = types.SimpleNamespace(web=web_module)
        sys.modules["aiohttp"] = aiohttp_module
        sys.modules["aiohttp.web"] = web_module
        folder_paths = types.SimpleNamespace(get_full_path=lambda *_args, **_kwargs: None)
        sys.modules["folder_paths"] = folder_paths
        sys.modules.pop("checkpoint_selector.ui.trigger_api", None)
        from checkpoint_selector.ui import trigger_api

        self.trigger_api = trigger_api

    def tearDown(self) -> None:
        sys.modules.clear()
        sys.modules.update(self._modules_backup)

    async def test_open_folder_platforms(self) -> None:
        original_platform = sys.platform
        original_startfile = getattr(os, "startfile", None)
        if original_startfile is None:
            os.startfile = lambda _path: None  # type: ignore[assignment]
            original_startfile = os.startfile  # type: ignore[assignment]
        try:
            sys.platform = "win32"
            os.startfile = lambda _path: None  # type: ignore[assignment]
            self.assertTrue(self.trigger_api._open_folder("C:\\"))
            sys.platform = "darwin"
            with tempfile.TemporaryDirectory() as temp_dir, unittest.mock.patch(
                "subprocess.Popen",
                return_value=types.SimpleNamespace(),
            ):
                self.assertTrue(self.trigger_api._open_folder(temp_dir))
        finally:
            sys.platform = original_platform
            os.startfile = original_startfile  # type: ignore[assignment]

    async def test_open_folder_linux_and_failure(self) -> None:
        original_platform = sys.platform
        original_startfile = getattr(os, "startfile", None)
        if original_startfile is None:
            os.startfile = lambda _path: None  # type: ignore[assignment]
            original_startfile = os.startfile  # type: ignore[assignment]
        try:
            sys.platform = "linux"
            with unittest.mock.patch(
                "subprocess.Popen",
                return_value=types.SimpleNamespace(),
            ):
                self.assertTrue(self.trigger_api._open_folder("/tmp"))
            sys.platform = "win32"
            os.startfile = (
                lambda _path: (_ for _ in ()).throw(RuntimeError("fail"))
            )  # type: ignore[assignment]
            self.assertFalse(self.trigger_api._open_folder("C:\\"))
        finally:
            sys.platform = original_platform
            os.startfile = original_startfile  # type: ignore[assignment]

    async def test_open_checkpoint_folder_validation(self) -> None:
        response = await self.trigger_api.open_checkpoint_folder(
            _DummyRequest({"checkpoint_name": "None"})
        )
        self.assertEqual(response.data, {"ok": False, "error": "invalid_checkpoint"})
        self.trigger_api.folder_paths.get_full_path = lambda *_args, **_kwargs: ""
        response = await self.trigger_api.open_checkpoint_folder(
            _DummyRequest({"checkpoint_name": "x"})
        )
        self.assertEqual(response.data, {"ok": False, "error": "not_found"})

    async def test_open_checkpoint_folder_invalid_payload(self) -> None:
        response = await self.trigger_api.open_checkpoint_folder(
            _DummyRequest({}, raise_error=True)
        )
        self.assertEqual(response.data, {"ok": False, "error": "invalid_checkpoint"})

    async def test_open_checkpoint_folder_invalid_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ckpt_path = os.path.join(temp_dir, "demo.safetensors")
            with open(ckpt_path, "wb") as file:
                file.write(b"")
            self.trigger_api.folder_paths.get_full_path = (
                lambda *_args, **_kwargs: ckpt_path
            )
            with unittest.mock.patch("os.path.isdir", return_value=False):
                response = await self.trigger_api.open_checkpoint_folder(
                    _DummyRequest({"checkpoint_name": "demo.safetensors"})
                )
            self.assertEqual(response.data, {"ok": False, "error": "invalid_path"})

    async def test_open_checkpoint_folder_success(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ckpt_path = os.path.join(temp_dir, "demo.safetensors")
            with open(ckpt_path, "wb") as file:
                file.write(b"")
            self.trigger_api.folder_paths.get_full_path = (
                lambda *_args, **_kwargs: ckpt_path
            )
            self.trigger_api._open_folder = lambda _path: True
            response = await self.trigger_api.open_checkpoint_folder(
                _DummyRequest({"checkpoint_name": "demo.safetensors"})
            )
            self.assertEqual(response.data, {"ok": True})

    async def test_load_checkpoint_preview_errors(self) -> None:
        response = await self.trigger_api.load_checkpoint_preview(
            _DummyRequest({"checkpoint_name": "None"})
        )
        self.assertEqual(response.status, 400)
        self.trigger_api.folder_paths.get_full_path = lambda *_args, **_kwargs: ""
        response = await self.trigger_api.load_checkpoint_preview(
            _DummyRequest({"checkpoint_name": "demo.safetensors"})
        )
        self.assertEqual(response.status, 404)

    async def test_load_checkpoint_preview_invalid_payload(self) -> None:
        response = await self.trigger_api.load_checkpoint_preview(
            _DummyRequest({}, raise_error=True)
        )
        self.assertEqual(response.status, 400)

    async def test_load_checkpoint_preview_no_preview(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ckpt_path = os.path.join(temp_dir, "demo.safetensors")
            with open(ckpt_path, "wb") as file:
                file.write(b"")
            self.trigger_api.folder_paths.get_full_path = (
                lambda *_args, **_kwargs: ckpt_path
            )
            self.trigger_api.select_checkpoint_preview_path = (
                lambda *_args, **_kwargs: None
            )
            response = await self.trigger_api.load_checkpoint_preview(
                _DummyRequest({"checkpoint_name": "demo.safetensors"})
            )
            self.assertEqual(response.status, 404)

    async def test_load_checkpoint_preview_success(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ckpt_path = os.path.join(temp_dir, "demo.safetensors")
            preview_path = os.path.join(temp_dir, "demo.png")
            with open(ckpt_path, "wb") as file:
                file.write(b"")
            with open(preview_path, "wb") as file:
                file.write(b"")
            self.trigger_api.folder_paths.get_full_path = (
                lambda *_args, **_kwargs: ckpt_path
            )
            self.trigger_api.select_checkpoint_preview_path = (
                lambda *_args, **_kwargs: preview_path
            )
            response = await self.trigger_api.load_checkpoint_preview(
                _DummyRequest({"checkpoint_name": "demo.safetensors"})
            )
            self.assertEqual(response.path, preview_path)
