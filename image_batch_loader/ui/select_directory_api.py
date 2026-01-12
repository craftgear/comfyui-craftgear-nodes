from __future__ import annotations

from typing import Any
import platform
import shutil
import subprocess

import server
from aiohttp import web

try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:
    tk = None
    filedialog = None


def _run_command(args: list[str]) -> str:
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=False)
    except Exception:
        return ''
    if result.returncode != 0:
        return ''
    return result.stdout.strip()


def _select_directory_with_tkinter() -> str | None:
    if not tk or not filedialog:
        return None
    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        try:
            root.attributes('-topmost', True)
        except Exception:
            pass
        selected = filedialog.askdirectory()
    except Exception:
        return None
    finally:
        if root is not None:
            try:
                root.destroy()
            except Exception:
                pass
    return selected or ''


def _select_directory_with_osascript() -> str:
    if platform.system() != 'Darwin':
        return ''
    if not shutil.which('osascript'):
        return ''
    script = 'POSIX path of (choose folder)'
    return _run_command(['osascript', '-e', script])


def _select_directory_with_powershell() -> str:
    if platform.system() != 'Windows':
        return ''
    if not shutil.which('powershell'):
        return ''
    script = (
        'Add-Type -AssemblyName System.Windows.Forms;'
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;'
        '$dialog.ShowNewFolderButton = $true;'
        'if ($dialog.ShowDialog() -eq "OK") { $dialog.SelectedPath }'
    )
    return _run_command(['powershell', '-NoProfile', '-Command', script])


def _select_directory_with_zenity() -> str:
    if platform.system() != 'Linux':
        return ''
    if not shutil.which('zenity'):
        return ''
    return _run_command(['zenity', '--file-selection', '--directory'])


def _select_directory_with_kdialog() -> str:
    if platform.system() != 'Linux':
        return ''
    if not shutil.which('kdialog'):
        return ''
    return _run_command(['kdialog', '--getexistingdirectory'])


def select_directory_path() -> str:
    os_name = platform.system()
    if os_name == 'Darwin':
        selected = _select_directory_with_osascript()
        return selected or ''
    if os_name == 'Windows':
        selected = _select_directory_with_powershell()
        if selected:
            return selected
    if os_name == 'Linux':
        selected = _select_directory_with_zenity()
        if selected:
            return selected
        selected = _select_directory_with_kdialog()
        if selected:
            return selected
    selected = _select_directory_with_tkinter()
    return selected or ''


@server.PromptServer.instance.routes.post('/craftgear/select_directory')
async def select_directory(request: web.Request) -> web.Response:
    _ = request
    selected = select_directory_path()
    payload: dict[str, Any] = {'path': selected or ''}
    return web.json_response(payload)
