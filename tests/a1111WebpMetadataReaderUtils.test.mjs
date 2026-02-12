import { describe, expect, it } from 'vitest';
import {
  applyWidgetValue,
  buildInputPreviewPayload,
  fileNameFromPath,
  isSupportedImagePath,
  normalizeDroppedPath,
  wrapWidgetCallback,
} from '../web/a1111_metadata_reader/js/a1111WebpMetadataReaderUtils.js';

describe('a1111WebpMetadataReaderUtils', () => {
  it('判定可能な画像拡張子を受け付ける', () => {
    expect(isSupportedImagePath('a.webp')).toBe(true);
    expect(isSupportedImagePath('a.png')).toBe(true);
    expect(isSupportedImagePath('a.jpg')).toBe(true);
    expect(isSupportedImagePath('a.jpeg')).toBe(true);
    expect(isSupportedImagePath('a.txt')).toBe(false);
  });

  it('file URLをローカルパスへ正規化する', () => {
    expect(normalizeDroppedPath('file:///tmp/sample.webp')).toBe('/tmp/sample.webp');
    expect(normalizeDroppedPath('file:///tmp/space%20name.webp')).toBe('/tmp/space name.webp');
  });

  it('ローカルパスからファイル名を取り出す', () => {
    expect(fileNameFromPath('/tmp/sample.webp')).toBe('sample.webp');
    expect(fileNameFromPath('C:\\tmp\\sample.webp')).toBe('sample.webp');
  });

  it('入力パスからプレビューペイロードを組み立てる', () => {
    expect(buildInputPreviewPayload('input/sample.webp')).toEqual({
      filename: 'sample.webp',
      subfolder: 'input',
      type: 'input',
    });
    expect(buildInputPreviewPayload('sample.webp')).toEqual({
      filename: 'sample.webp',
      type: 'input',
    });
    expect(buildInputPreviewPayload('')).toBeNull();
  });

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
});
