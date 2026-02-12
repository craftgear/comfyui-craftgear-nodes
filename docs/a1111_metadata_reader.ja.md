# A1111 Metadata Reader

## 概要
画像ファイルに保存された A1111 形式のメタデータ文字列を読み取り、解析結果を各出力へ返すノードです。  
表示名は **A1111 Metadata Reader**、クラス名は `A1111WebpMetadataReader` です。

## 入力
- `image_path` (`STRING`, 必須): メタデータを読み込む画像パス。

## 出力
- `positive_prompt` (`STRING`)
- `negative_prompt` (`STRING`)
- `model json` (`STRING`)
- `loras json` (`STRING`)
- `steps` (`INT`)
- `sampler` (`STRING`)
- `cfg_scale` (`FLOAT`)
- `seed` (`INT`)
- `size` (`STRING`)
- `clip_skip` (`INT`)
- `raw_parameters` (`STRING`)

## 動作
1. `image_path` を解決します。
- 指定パスがそのまま存在すればそれを使用します。
- 無い場合は ComfyUI の `input` ディレクトリ（`folder_paths.get_input_directory()`）配下を試し、最後に basename でも探索します。
2. 画像形式ごとにメタデータ文字列を抽出します。
- `webp`: RIFF 内 EXIF チャンクの `UserComment`
- `png`: `tEXt` / `zTXt` / `iTXt` の `parameters` / `Extparameters` 系キー（必要に応じて Pillow 情報も参照）
- `jpg` / `jpeg`: EXIF `UserComment`
3. A1111 形式文字列を解析して各出力へ展開します。
- `model json` 形式: `{"name":"","hash":"","modelVersionId":""}`
- `loras json` 形式: `[{"name":"","hash":"","modelVersionId":""}]`

## UI 挙動
- ノード内に画像プレビュー領域があります。
- ドラッグアンドドロップは `.webp`, `.png`, `.jpg`, `.jpeg` に対応します。
- `image_path` 入力で Enter を押すと、プレビューと出力同期を実行します。

## API（UI拡張で使用）
- エンドポイント: `POST /my_custom_node/a1111_reader_metadata`
- リクエスト: `{ "image_path": "<path>" }`
- レスポンス: `{ "model_json": "...", "loras_json": "..." }`
- 不正入力や読込失敗時は空の既定値を返します。

## 注意点
- メタデータが存在しない、または解析できない場合は空/既定値を返します。
- `Hashes` / `Lora hashes` / `Civitai resources` が存在する場合は、それらも解析対象になります。
