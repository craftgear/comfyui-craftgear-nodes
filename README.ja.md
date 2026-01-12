# craftgear nodes

ComfyUI 用のカスタムノード集です。

## ノード

### Auto Lora Loader (craftgear/loras)

ComfyUI の loras フォルダから LoRA を選択し、名前と強度とトリガーワードを返します。

入力:
- lora_name: LoRA ファイルのドロップダウン
- lora_strength: Float, 既定 1.0, 範囲 -2.0 から 2.0
- trigger_selection: 文字列。選択したトリガーの JSON 配列

出力:
- lora_name: 文字列
- lora_strength: Float
- lora_triggers: 文字列のリスト

動作:
- lora_name が None の場合は空の名前と空のリストを返します
- safetensors のメタデータからトリガーワードを抽出します
- trigger_selection がある場合は選択したものだけに絞り込みます

UI 補助:
- トリガー選択ダイアログ
- lora_name ドロップダウンのファジー検索

### Camera Shake (craftgear/image)

画像バッチに手持ち風の揺れを追加します。

入力:
- images: 画像バッチ
- strength: Float, 既定 1.0, 範囲 0.0 から 3.0
- edge_mode: ドロップダウン
  - 1_scale: 少し拡大して余白を減らします
  - 2_crop: クロップして元サイズに戻します
  - 3_prepad: 事前に余白を複製拡張し、揺らした後に元サイズへ戻します

出力:
- images: 画像バッチ

動作:
- 時間的に滑らかなランダム揺れを使います
- 向きを自動判定して元スクリプトと同じ係数を使います
  - 横向き: 回転 0.4 度, 移動 X 10, 移動 Y 6
  - 縦向き: 回転 0.6 度, 移動 X 6, 移動 Y 10
- edge_mode で余白の扱いを選べます
  - 1_scale は少し拡大してサイズを維持します
  - 2_crop はクロップして元サイズに戻します
  - 3_prepad は外周を複製拡張してから揺らし、元サイズに戻します
- おすすめ
  - 1_scale: 手軽に黒縁を避けたい時
  - 2_crop: 枠取りを優先し、再サンプルの影響を許容できる時
  - 3_prepad: 枠取りを保ちつつ黒縁を避けたい時

### image_batch_loader (craftgear/image)

ディレクトリ内の画像をすべて読み込み、バッチを返します。

入力:
- directory: 文字列パス
- filter: ファイル名部分一致の正規表現（大文字小文字を区別しない）

出力:
- batch: IMAGE バッチ

動作:
- OS のディレクトリ選択ボタンでパスを設定します
- 直下のみ読み込みます
- 名前順で読み込みます
- 対象は png, jpg, jpeg, webp です
- 読み込めないファイルはスキップします
- filter がある場合はファイル名で絞り込みます
- batch は最初に読み込めた画像と同じサイズだけ返します
- 読み込めない場合は空のバッチを返します

## インストール

ComfyUI の custom nodes 配下に配置して下さい。

例:
- /path/to/ComfyUI/custom_nodes/comfyui-craftgear-nodes

## 使い方

1. ComfyUI を起動または再起動します。
2. Auto Lora Loader または Camera Shake、image_batch_loader を追加します。
3. 入力を接続して必要に応じて調整します。

image_batch_loader の場合:

1. Select Directory を押してフォルダを選択します。
2. 実行すると画像のバッチが返ります。

## Camera Shake の例

文章のみの例です。

1. 画像バッチのローダーを追加して Camera Shake に接続します。
2. strength は 0.8 から 1.2 から始めると自然です。
3. 強くしたい場合は 2.0 から 3.0 へ上げます。
4. 端が気になる場合は edge_mode を 2_crop または 3_prepad にして下さい。

## 構成

- auto_lora_loader/logic: LoRA の補助関数
- auto_lora_loader/ui: ノードと API
- auto_lora_loader/tests: テスト
- image_batch_loader: 画像バッチローダー
- web/auto_lora_loader: Auto Lora Loader の UI 拡張
- web/image_batch_loader: image_batch_loader の UI 拡張
- camera_shake: Camera Shake ノード

## テスト

Python テスト:

- python -m unittest discover -s auto_lora_loader/tests
- python -m unittest discover -s image_batch_loader/tests

Node スクリプトテスト:

- node auto_lora_loader/tests/loraFuzzyMatch.test.mjs
