# A1111 Metadata Writer

## 概要
**Load Loras With Tags / Commentable Multiline Text / Toggle Tags** などが生成するプロンプトやタグ情報を A1111 互換の `parameters` としてまとめ、PNG メタデータに書き込んで保存する用途を想定しています。`OUTPUT_NODE = True` なので出力が未接続でも実行されます。

## 入力
- `image` (`IMAGE`, 必須): 書き出し対象の画像。
- `overwrite` (`BOOLEAN`, 既定 `False`):  
  - `True` のときは `SaveImage` ノードの出力ファイル名プレフィックスを探し、同じ名前の最新ファイルを上書きします。見つからなければ新規に生成します。  
  - `False` のときは `suffix` を付けた新規ファイル名で保存します。
- `suffix` (`STRING`, 既定 `_a1111`): `overwrite=False` のときのファイル名サフィックス。空や `true/false/none` と解釈される値は無視され、`_a1111` にフォールバックします。
- 隠し入力 `prompt` (`PROMPT`): ComfyUI が自動で渡すワークフローデータ。これが無い場合、保存は行われません。
- 隠し入力 `extra_pnginfo` (`EXTRA_PNGINFO`): 追加で書き込みたいメタデータ。`prompt` と `parameters` キーはスキップされます。

## 出力
- `parameters` (`STRING`): A1111 形式に整形したプロンプト文字列。
- `path` (`STRING`): 保存した PNG のフルパス。

## 動作
1. `prompt` から KSampler などを解析し、A1111 互換の `parameters` 文字列を生成します。生成できない場合は処理を中断します。
2. `overwrite` フラグに応じて保存先パスを決定します。  
   - デフォルトの出力ディレクトリは `folder_paths.get_output_directory()` に従います。
3. PNG に以下のテキストチャンクを追加して保存します。  
   - `prompt`: 元の ComfyUI ワークフロー (JSON)  
   - `parameters`: A1111 互換テキスト  
   - `extra_pnginfo` 内の任意キー (上記2キーは除外)

## 使い方
1. 画像の直後に配置し、必要に応じて出力を他ノードへ接続します（未接続でも実行されます）。
2. 既存画像を上書きしたい場合は `overwrite` をオンにし、`SaveImage` ノードと同じプレフィックスを使ってください。
3. 複製保存したい場合は `overwrite` をオフにし、`suffix` で名前を調整します。

## 注意点
- `prompt` が無い、またはパラメータ抽出に失敗した場合はファイルを保存せず空文字を返します。
- `overwrite=True` のときは `suffix` は UI 上で無効化され、ファイル名決定に使われません。
- `extra_pnginfo` に `prompt` または `parameters` を入れても無視されます。
