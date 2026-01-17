# craftgear nodes

ComfyUI 用の少し便利なカスタムノード集です。

## ノード一覧

詳細はリンク先の各ノードのドキュメントをご覧下さい。 

- [Load LoRAs With Tags](./docs/load_loras_with_tags.ja.md) : タグをLoRA＆jsonから読み込み、選択を可能にします。LoRA選択は名前のファジーマッチで行えます
- [Toggle Tags](./docs/toggle_tags.ja.md) : 入力されたタグテキストからタグのオンオフをクリックで切り替えます
- [Commentable Multiline Text](./docs/commentable_multiline_text.ja.md) : コメント行を除去して出力します
- [Join Texts](./docs/join_texts.ja.md) : 複数のテキスト入力を 1 行に結合します
- [Image Batch Loader](./docs/image_batch_loader.ja.md) : ディレクトリ内の画像をバッチで読み込みます
- [Camera Shake](./docs/camera_shake.ja.md) : 画像バッチに手持ち風の揺れを追加します


## インストール

### Comfy Manager を使う方法

Comfy Managerの Custome Nodes Manager で `craftgear` を検索してインストールして下さい

バージョン選択画面で `nightly` を選ぶとセキュリティ制限でインストールできません。
数字のバージョンを選んでインストールして下さい。

### git clone を使う方法

ComfyUI の custom nodes ディレクトリで次のコマンドを実行して下さい。

```bash
git clone https://github.com/craftgear/comfyui-craftgear-nodes
```


## LICENCE
MIT
