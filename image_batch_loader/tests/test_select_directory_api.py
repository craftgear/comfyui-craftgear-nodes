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


if __name__ == '__main__':
    unittest.main()
