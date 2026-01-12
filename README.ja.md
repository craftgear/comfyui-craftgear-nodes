# craftgear nodes

ComfyUI 用のカスタムノード集です。

## ノード

### Load Lora With Triggers (craftgear/loras)

ComfyUI の loras フォルダから LoRA を選択し、model と clip に適用して選択トリガーを返します。

入力:
- model: Model
- clip: CLIP
- lora_name: LoRA ファイルのドロップダウン
- lora_strength: Float, 既定 1.0, 範囲 -2.0 から 2.0
- trigger_selection: 文字列。選択したトリガーの JSON 配列

出力:
- model: Model
- clip: CLIP
- selected triggers: カンマ区切り文字列

動作:
- lora_name が None の場合は入力の model と clip と空文字列を返します
- lora_strength が 0 の場合は入力の model と clip と選択トリガー文字列を返します
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

### Commentable Multiline Text (craftgear/text)

複数行のテキスト入力を 1 行の文字列に変換します。

入力:
- text: 複数行文字列
- separator: 文字列, 既定 ","

出力:
- text: 文字列

動作:
- 行頭が # または // の行は除外します。先頭の空白は無視します
- 前後の空白をトリムします
- 空行は残します
- 残った行を separator で連結します
- separator をトリムして空なら "," で連結します

### join_text_node (craftgear/text)

複数のテキスト入力を 1 行の文字列に連結します。

入力:
- text_1: テキスト入力, ソケットのみ
- separator: 文字列, 既定 ","
- 最後の入力が接続されると入力が追加されます

出力:
- text: 文字列

動作:
- 空行と空文字は除外します
- 残った行を separator で連結します
- 最後の接続が外れると末尾の空入力を削除します

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
2. Load Lora With Triggers または Camera Shake、image_batch_loader を追加します。
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

- load_lora_with_triggers/logic: LoRA の補助関数
- load_lora_with_triggers/ui: ノードと API
- load_lora_with_triggers/tests: テスト
- image_batch_loader: 画像バッチローダー
- web/load_lora_with_triggers: Load Lora With Triggers の UI 拡張
- web/image_batch_loader: image_batch_loader の UI 拡張
- camera_shake: Camera Shake ノード
- camera_shake/tests: Camera Shake のテスト
- join_text_node: join_text_node
- join_text_node/tests: join_text_node のテスト

## テスト

Python テスト:

- python -m unittest discover -s load_lora_with_triggers/tests
- python -m unittest discover -s image_batch_loader/tests
- python -m unittest discover -s camera_shake/tests
- python -m unittest discover -s join_text_node/tests
- python -m unittest discover -s commentable_multiline_text/tests

Node スクリプトテスト:

- node load_lora_with_triggers/tests/loraFuzzyMatch.test.mjs
