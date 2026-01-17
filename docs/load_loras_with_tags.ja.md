# Load Loras With Tags 

## 特徴

- LoRAの `ss_tag_strings` と モデルと同じ場所にある json ファイルから `trainedWords` を読み込んで選択する事が出来ます。
- 選択したタグは tags ハンドルから出力します。
- LoRA選択はファイル名のファージマッチで行えます。
![node](./images/load_lora_with_tags_01.png)


## LoRA選択ダイアログ

- LoRA名はファジーマッチでフィルタ可能です。大量のファイルから目的のものを素早く探すことが出来ます。
- 上下キーまたはマウスクリックでLoRAを選択します。
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

