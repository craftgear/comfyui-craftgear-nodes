# A1111 Metadata Reader Preview Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A1111 Metadata Readerで、`image_path` の変更方法に関係なく画像プレビューを常に表示し、実行結果でもプレビューが表示される状態にする。

**Architecture:** フロントエンドは `image_path` ウィジェット変更検知を明示的にラップし、ノード内プレビューを同期する。バックエンドは `image_path` から ComfyUI 互換の `ui.images` ペイロードを構築し、実行結果プレビューを返す。表示ロジックとパス変換ロジックを分離して、テストしやすい関数単位に保つ。

**Tech Stack:** Python (`unittest`), JavaScript (ESM, Vitest), ComfyUI custom node API

---

### Task 1: 現状固定化と失敗テスト追加（JS）

**Files:**
- Modify: `tests/a1111WebpMetadataReaderUtils.test.mjs`
- Modify: `web/a1111_metadata_reader/js/a1111WebpMetadataReaderUtils.js`
- Reference: `web/a1111_metadata_reader/js/a1111WebpMetadataReaderNode.js`

**Step 1: Write the failing test**

```javascript
import {
  applyWidgetValue,
  wrapWidgetCallback,
} from '../web/a1111_metadata_reader/js/a1111WebpMetadataReaderUtils.js';

it('applyWidgetValue は callback を呼んで値変更を通知する', () => {
  const calls = [];
  const widget = {
    value: '',
    callback: (value) => calls.push(value),
  };
  applyWidgetValue(widget, 'input/demo.webp');
  expect(widget.value).toBe('input/demo.webp');
  expect(calls).toEqual(['input/demo.webp']);
});

it('wrapWidgetCallback は元callbackを維持しつつ onChange を呼ぶ', () => {
  const calls = [];
  const widget = {
    callback: (value) => calls.push(`orig:${value}`),
  };
  wrapWidgetCallback(widget, '__wrapped__', (value) => calls.push(`new:${value}`));
  widget.callback('a.webp');
  expect(calls).toEqual(['orig:a.webp', 'new:a.webp']);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs`  
Expected: FAIL with `applyWidgetValue is not exported` など未実装エラー

**Step 3: Write minimal implementation**

```javascript
const applyWidgetValue = (widget, value) => {
  if (!widget) {
    return;
  }
  widget.value = value;
  if (typeof widget.callback === 'function') {
    widget.callback(value);
  }
};

const wrapWidgetCallback = (widget, markerKey, onChange) => {
  if (!widget || widget[markerKey]) {
    return;
  }
  const original = widget.callback;
  widget.callback = (value) => {
    const result = original?.(value);
    onChange?.(value);
    return result;
  };
  widget[markerKey] = true;
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/a1111WebpMetadataReaderUtils.test.mjs web/a1111_metadata_reader/js/a1111WebpMetadataReaderUtils.js
git commit -m "test: add widget sync helpers for webp reader preview"
```

### Task 2: ノード内プレビューを `image_path` 変更へ追従

**Files:**
- Modify: `web/a1111_metadata_reader/js/a1111WebpMetadataReaderNode.js`
- Modify: `tests/a1111WebpMetadataReaderUtils.test.mjs`

**Step 1: Write the failing test**

```javascript
it('wrapWidgetCallback は二重ラップしない', () => {
  const calls = [];
  const widget = {
    callback: (value) => calls.push(`orig:${value}`),
  };
  wrapWidgetCallback(widget, '__wrapped__', (value) => calls.push(`new:${value}`));
  wrapWidgetCallback(widget, '__wrapped__', (value) => calls.push(`new2:${value}`));
  widget.callback('b.webp');
  expect(calls).toEqual(['orig:b.webp', 'new:b.webp']);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs`  
Expected: FAIL if marker guardが未実装なら `new2` が混入

**Step 3: Write minimal implementation**

```javascript
import {
  applyWidgetValue,
  wrapWidgetCallback,
} from './a1111WebpMetadataReaderUtils.js';

const PATH_WIDGET_WRAP_KEY = '__a1111WebpPathWidgetWrapped';

const setPathWidget = (node, value) => {
  const widget = getWidget(node, PATH_WIDGET_NAME);
  applyWidgetValue(widget, value);
};

const attachPathWidgetSync = (node) => {
  const pathWidget = getWidget(node, PATH_WIDGET_NAME);
  wrapWidgetCallback(pathWidget, PATH_WIDGET_WRAP_KEY, (value) => {
    setPreviewFromPath(node, value);
    markDirty(node);
  });
};

const setupNode = (node) => {
  ensurePreviewWidget(node);
  attachDropHandler(node);
  attachPathWidgetSync(node);
  const pathWidget = getWidget(node, PATH_WIDGET_NAME);
  if (pathWidget?.value) {
    setPreviewFromPath(node, pathWidget.value);
  }
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add web/a1111_metadata_reader/js/a1111WebpMetadataReaderNode.js tests/a1111WebpMetadataReaderUtils.test.mjs
git commit -m "feat: sync webp reader preview with image_path updates"
```

### Task 3: 実行結果の `ui.images` プレビュー追加（Python）

**Files:**
- Modify: `a1111_metadata_reader/ui/node.py`
- Modify: `a1111_metadata_reader/tests/test_a1111_metadata_reader_ui.py`

**Step 1: Write the failing test**

```python
def test_read_returns_ui_images_for_relative_input_path(self) -> None:
    reader = A1111WebpMetadataReader()
    payload = {
        'positive_prompt': 'pos',
        'negative_prompt': 'neg',
        'model': '{"name":"","hash":""}',
        'loras': '[]',
        'steps': 1,
        'sampler': 'Euler',
        'cfg_scale': 7.0,
        'seed': 1,
        'size': '512x512',
        'clip_skip': 1,
        'raw_parameters': 'raw',
    }
    with mock.patch('a1111_metadata_reader.ui.node.logic.read_and_parse_metadata', return_value=payload):
        result = reader.read('nested/sample.webp')
    self.assertEqual(result['ui']['images'], [{'filename': 'sample.webp', 'subfolder': 'nested', 'type': 'input'}])

def test_build_input_preview_payload_rejects_empty_path(self) -> None:
    self.assertIsNone(_build_input_preview_payload(''))
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest a1111_metadata_reader.tests.test_a1111_metadata_reader_ui -v`  
Expected: FAIL with `tuple indices must be integers` または `_build_input_preview_payload is not defined`

**Step 3: Write minimal implementation**

```python
def _build_input_preview_payload(image_path: str) -> dict[str, str] | None:
    text = str(image_path or '').strip().replace('\\', '/')
    if not text:
        return None
    parts = [part for part in text.split('/') if part not in {'', '.'}]
    if not parts:
        return None
    filename = parts[-1]
    if not filename:
        return None
    subfolder = '/'.join(parts[:-1])
    payload: dict[str, str] = {'filename': filename, 'type': 'input'}
    if subfolder:
        payload['subfolder'] = subfolder
    return payload

def _build_result(parsed: dict[str, Any], preview: dict[str, str] | None) -> dict[str, Any]:
    result_tuple = (
        str(parsed.get('positive_prompt', '')),
        str(parsed.get('negative_prompt', '')),
        str(parsed.get('model', '{"name":"","hash":""}')),
        str(parsed.get('loras', '[]')),
        int(parsed.get('steps', 0) or 0),
        str(parsed.get('sampler', '')),
        float(parsed.get('cfg_scale', 0.0) or 0.0),
        int(parsed.get('seed', 0) or 0),
        str(parsed.get('size', '')),
        int(parsed.get('clip_skip', 0) or 0),
        str(parsed.get('raw_parameters', '')),
    )
    return {'ui': {'images': [preview] if preview else []}, 'result': result_tuple}
```

`read` は `parsed` と `preview` を使って `_build_result` を返す。

**Step 4: Run test to verify it passes**

Run: `python -m unittest a1111_metadata_reader.tests.test_a1111_metadata_reader_ui -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add a1111_metadata_reader/ui/node.py a1111_metadata_reader/tests/test_a1111_metadata_reader_ui.py
git commit -m "feat: return input preview payload from webp metadata reader"
```

### Task 4: 回帰確認とUI実機検証

**Files:**
- Verify: `web/a1111_metadata_reader/js/a1111WebpMetadataReaderNode.js`
- Verify: `a1111_metadata_reader/ui/node.py`
- Verify: `tests/a1111WebpMetadataReaderUtils.test.mjs`
- Verify: `a1111_metadata_reader/tests/test_a1111_metadata_reader_logic.py`
- Verify: `a1111_metadata_reader/tests/test_a1111_metadata_reader_ui.py`

**Step 1: Write the failing test**

このタスクは検証専用のため新規テスト追加なし（既存テストの回帰確認を実施）。

**Step 2: Run test to verify current status**

Run:

```bash
pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs
python -m unittest a1111_metadata_reader.tests.test_a1111_metadata_reader_logic a1111_metadata_reader.tests.test_a1111_metadata_reader_ui -v
```

Expected: PASS

**Step 3: Visual verification (Chrome MCP)**

1. ComfyUIを起動して対象ノードを配置  
2. `image_path` に手入力で `input/sample.webp` を設定しプレビュー更新を確認  
3. 同ノードへドラッグ&ドロップし、プレビューが即時更新されることを確認  
4. ノード実行後、実行結果の画像プレビュー表示を確認

**Step 4: Re-run tests**

Run:

```bash
pnpm test tests/a1111WebpMetadataReaderUtils.test.mjs
python -m unittest a1111_metadata_reader.tests.test_a1111_metadata_reader_logic a1111_metadata_reader.tests.test_a1111_metadata_reader_ui -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify webp reader preview flow end-to-end"
```
