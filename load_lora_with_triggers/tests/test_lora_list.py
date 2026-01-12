import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

sys.path.append(str(Path(__file__).resolve().parents[1]))  # テストからローカルモジュールを読み込むため

from load_lora_with_triggers.logic.main import collect_lora_names


def test_collect_lora_names_filters_and_recursive() -> None:
    with TemporaryDirectory() as tmp:
        base = Path(tmp)
        (base / 'a.safetensors').write_text('x')
        (base / 'b.txt').write_text('x')
        sub = base / 'sub'
        sub.mkdir()
        (sub / 'c.safetensors').write_text('x')

        result = collect_lora_names([str(base)], {'.safetensors', '.pt'})

        assert result == ['a.safetensors', os.path.join('sub', 'c.safetensors')]


def test_collect_lora_names_merges_dirs_and_dedupes() -> None:
    with TemporaryDirectory() as tmp1, TemporaryDirectory() as tmp2:
        base1 = Path(tmp1)
        base2 = Path(tmp2)
        (base1 / 'a.safetensors').write_text('x')
        (base2 / 'a.safetensors').write_text('x')
        (base2 / 'b.pt').write_text('x')

        result = collect_lora_names([str(base1), str(base2)], {'.safetensors', '.pt'})

        assert result == ['a.safetensors', 'b.pt']
