import asyncio
import sys
import types
import unittest
from unittest.mock import patch


class _DummyRoutes:
    def post(self, _path: str):
        def decorator(handler):
            return handler

        return decorator


class _DummyPromptServer:
    def __init__(self) -> None:
        self.routes = _DummyRoutes()


sys.modules['server'] = types.SimpleNamespace(
    PromptServer=types.SimpleNamespace(instance=_DummyPromptServer())
)
sys.modules['aiohttp'] = types.SimpleNamespace(
    web=types.SimpleNamespace(
        Request=object,
        Response=object,
        json_response=lambda payload: payload,
    )
)

from image_batch_loader.ui import select_directory_api


class SelectDirectoryApiTest(unittest.TestCase):
    def test_run_command(self) -> None:
        class Result:
            def __init__(self, returncode: int, stdout: str) -> None:
                self.returncode = returncode
                self.stdout = stdout

        with patch('subprocess.run', return_value=Result(0, 'ok')) as run:
            self.assertEqual(select_directory_api._run_command(['echo', 'ok']), 'ok')
            run.assert_called_once()
        with patch('subprocess.run', return_value=Result(1, 'fail')):
            self.assertEqual(select_directory_api._run_command(['echo', 'fail']), '')

    def test_uses_osascript_on_macos_preferred(self) -> None:
        with patch.object(
            select_directory_api,
            '_select_directory_with_tkinter',
            return_value='/tmp/selected',
        ) as tkinter_select, patch('platform.system', return_value='Darwin'), patch.object(
            select_directory_api,
            '_select_directory_with_osascript',
            return_value='/Users/test/Pictures',
        ) as osascript_select, patch.object(
            select_directory_api,
            '_select_directory_with_powershell',
            return_value='',
        ) as powershell_select, patch.object(
            select_directory_api,
            '_select_directory_with_zenity',
            return_value='',
        ) as zenity_select, patch.object(
            select_directory_api,
            '_select_directory_with_kdialog',
            return_value='',
        ) as kdialog_select:
            result = select_directory_api.select_directory_path()

            self.assertEqual(result, '/Users/test/Pictures')
            osascript_select.assert_called_once()
            tkinter_select.assert_not_called()
            powershell_select.assert_not_called()
            zenity_select.assert_not_called()
            kdialog_select.assert_not_called()

    def test_uses_powershell_on_windows_preferred(self) -> None:
        with patch.object(
            select_directory_api,
            '_select_directory_with_tkinter',
            return_value='/tmp/selected',
        ) as tkinter_select, patch('platform.system', return_value='Windows'), patch.object(
            select_directory_api,
            '_select_directory_with_powershell',
            return_value='C:\\Images',
        ) as powershell_select:
            result = select_directory_api.select_directory_path()

            self.assertEqual(result, 'C:\\Images')
            powershell_select.assert_called_once()
            tkinter_select.assert_not_called()

    def test_uses_linux_fallbacks_preferred(self) -> None:
        with patch.object(
            select_directory_api,
            '_select_directory_with_tkinter',
            return_value='/tmp/selected',
        ) as tkinter_select, patch('platform.system', return_value='Linux'), patch.object(
            select_directory_api,
            '_select_directory_with_zenity',
            return_value='',
        ) as zenity_select, patch.object(
            select_directory_api,
            '_select_directory_with_kdialog',
            return_value='/home/test/images',
        ) as kdialog_select:
            result = select_directory_api.select_directory_path()

            self.assertEqual(result, '/home/test/images')
            zenity_select.assert_called_once()
            kdialog_select.assert_called_once()
            tkinter_select.assert_not_called()

    def test_uses_tkinter_when_platform_picker_fails(self) -> None:
        with patch.object(
            select_directory_api,
            '_select_directory_with_tkinter',
            return_value='/tmp/selected',
        ) as tkinter_select, patch('platform.system', return_value='Windows'), patch.object(
            select_directory_api,
            '_select_directory_with_powershell',
            return_value='',
        ) as powershell_select:
            result = select_directory_api.select_directory_path()

            self.assertEqual(result, '/tmp/selected')
            powershell_select.assert_called_once()
            tkinter_select.assert_called_once()

    def test_select_directory_with_osascript_guard(self) -> None:
        with patch('platform.system', return_value='Darwin'), patch('shutil.which', return_value=None):
            self.assertEqual(select_directory_api._select_directory_with_osascript(), '')

    def test_select_directory_with_powershell_guard(self) -> None:
        with patch('platform.system', return_value='Windows'), patch('shutil.which', return_value=None):
            self.assertEqual(select_directory_api._select_directory_with_powershell(), '')

    def test_select_directory_with_linux_guards(self) -> None:
        with patch('platform.system', return_value='Linux'), patch('shutil.which', return_value=None):
            self.assertEqual(select_directory_api._select_directory_with_zenity(), '')
            self.assertEqual(select_directory_api._select_directory_with_kdialog(), '')

    def test_select_directory_with_tkinter(self) -> None:
        class DummyRoot:
            def withdraw(self) -> None:
                return None

            def attributes(self, *_args, **_kwargs) -> None:
                return None

            def destroy(self) -> None:
                return None

        class DummyTk:
            def Tk(self):
                return DummyRoot()

        class DummyDialog:
            @staticmethod
            def askdirectory():
                return '/tmp/selected'

        with patch.object(select_directory_api, 'tk', DummyTk()), patch.object(
            select_directory_api,
            'filedialog',
            DummyDialog(),
        ):
            self.assertEqual(select_directory_api._select_directory_with_tkinter(), '/tmp/selected')

        with patch.object(select_directory_api, 'tk', None), patch.object(
            select_directory_api,
            'filedialog',
            None,
        ):
            self.assertIsNone(select_directory_api._select_directory_with_tkinter())

    def test_select_directory_handler(self) -> None:
        with patch.object(select_directory_api, 'select_directory_path', return_value=''):
            result = asyncio.run(select_directory_api.select_directory(object()))
        self.assertEqual(result, {'path': ''})


if __name__ == '__main__':
    unittest.main()
