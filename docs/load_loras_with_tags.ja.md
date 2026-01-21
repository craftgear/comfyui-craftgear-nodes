# Load Loras With Tags

![node](./images/load_lora_with_tags_01.png)

## 特徴

- LoRAの `ss_tag_strings` と モデルと同じ場所にある json ファイルから `trainedWords` を読み込んで選択する事が出来ます。
- 選択したタグは tags ハンドルから出力します。
- LoRA選択はファイル名のファジーマッチで行えます。
- 最大10個のLoRAを同時に適用できます。


## LoRA選択ダイアログ

- LoRA名はファジーマッチでフィルタ可能です。大量のファイルから目的のものを素早く探すことが出来ます。
- 上下キーまたはマウスクリックでLoRAを選択します。
- 候補がアクティブになると、同じディレクトリの画像が左側に表示されます。
- プレビューにホバーすると拡大表示します（倍率は設定で変更可能）。
![select lora](./images/load_lora_with_tags_04.png)


## タグ選択ダイアログ

- タグはファジーマッチでフィルタ可能です。
![select tags](./images/load_lora_with_tags_03.png)


## LoRA強度の選択
- LoRA強度は数値ラベルをクリックすることで表示されるポップアップスライダーで行います。
![lora strength](./images/load_lora_with_tags_02.png)


## 選択したタグの出力

- 選択したタグは `tags` ハンドルから出力されます。
![selected tags output](./images/load_lora_with_tags_05.png)
 
## タグの優先度

- モデルと同じディレクトリに json ファイルがあれば、その中から `trainedWords` を探します。
- json ファイルから読み出したタグは頻度無限大として扱われ、タグ選択リストの先頭に表示されます。
- LoRAのメタデータに `ss_tag_strings` がある場合はタグとして読み出します。タグ選択リストで出現頻度順に並びます。


## 入力パラメータ

### 必須入力

| パラメータ | 型 | 説明 |
|-----------|------|------|
| model | MODEL | LoRAを適用するモデル |
| clip | CLIP | LoRAを適用するCLIP |

### LoRAスロット (1〜10)

各スロットに以下のパラメータがあります:

| パラメータ | 型 | 説明 |
|-----------|------|------|
| lora_name_{n} | DROPDOWN | 適用するLoRAファイル ("None" で無効) |
| lora_strength_{n} | FLOAT | LoRAの強度 (-2.0〜2.0、デフォルト: 1.0) |
| lora_on_{n} | BOOLEAN | LoRAの有効/無効 (デフォルト: True) |
| tag_selection_{n} | STRING | 選択されたタグ (UIで選択) |

### オプション入力

| パラメータ | 型 | 説明 |
|-----------|------|------|
| tags | STRING | 入力タグ (他のノードからの接続用、出力タグに結合されます) |


## 出力

| 出力 | 型 | 説明 |
|------|------|------|
| model | MODEL | LoRAが適用されたモデル |
| clip | CLIP | LoRAが適用されたCLIP |
| tags | STRING | 入力タグと選択されたLoRAタグを結合したテキスト |




## 使用例

### 基本的な使い方

1. `model` と `clip` を接続します (通常は Load Checkpoint ノードから)
2. LoRA名をクリックしてファジーマッチダイアログでLoRAを選択します
3. 必要に応じてタグを選択します
4. `tags` 出力を CLIP Text Encode などに接続してプロンプトに使用します

### 複数LoRAの組み合わせ

キャラクターLoRAとスタイルLoRAを組み合わせる例:

```
スロット1: character_lora.safetensors (強度: 0.8)
  -> キャラクター名タグを選択

スロット2: style_lora.safetensors (強度: 0.6)
  -> スタイルタグを選択
```

### タグの連結

他のノードからのタグを入力として受け取り、LoRAのタグと結合する例:

```
[Commentable Multiline Text] -> tags入力
                                    ↓
                            [Load LoRAs With Tags]
                                    ↓
                               tags出力 -> [CLIP Text Encode]
```

入力タグが `1girl, blue eyes` で、LoRAから `character_name` を選択した場合、
出力は `1girl, blue eyes, character_name` となります。

### Toggle Tags との連携

出力タグを Toggle Tags に接続して、生成時にタグを動的に有効/無効にする:

```
[Load LoRAs With Tags] -> tags -> [Toggle Tags] -> text -> [CLIP Text Encode]
```
