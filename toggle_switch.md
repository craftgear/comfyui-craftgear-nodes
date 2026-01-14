# PowerLoraLoader のトグルスイッチと UI 配置

対象リポジトリ: `rgthree/rgthree-comfy` main ブランチ

このノートは `web/comfyui/power_lora_loader.js` と `py/power_lora_loader.py` を元に、トグルスイッチの実装と UI 要素の配置方法を整理したものです。UI は DOM ではなく Canvas 描画で構成され、位置計算と hitArea の bounds によりクリック判定を行っています。

## トグルスイッチの実装概要

- 行ごとのトグル状態は `value.on` に保持されます。
- クリック判定は `hitAreas.toggle` の bounds で行います。
- ヘッダーのトグルは全行をまとめて切り替えます。
- Python 側は `value['on']` を見て LoRA を適用するか判定します。

### コード例: 行トグルの描画とクリック

```js
// web/comfyui/power_lora_loader.js
this.hitAreas.toggle.bounds = drawTogglePart(ctx, {
  posX,
  posY,
  height,
  value: this.value.on,
});

onToggleDown(event, pos, node) {
  this.value.on = !this.value.on;
  this.cancelMouseDown();
  return true;
}
```

### コード例: 全体トグル

```js
// web/comfyui/power_lora_loader.js
allLorasState() {
  let allOn = true;
  let allOff = true;
  for (const widget of this.widgets) {
    if (widget.name?.startsWith('lora_')) {
      const on = widget.value?.on;
      allOn = allOn && on === true;
      allOff = allOff && on === false;
      if (!allOn && !allOff) return null;
    }
  }
  return allOn && this.widgets?.length ? true : false;
}

toggleAllLoras() {
  const allOn = this.allLorasState();
  const toggledTo = !allOn ? true : false;
  for (const widget of this.widgets) {
    if (widget.name?.startsWith('lora_') && widget.value?.on != null) {
      widget.value.on = toggledTo;
    }
  }
}
```

### コード例: Python 側の反映

```py
# py/power_lora_loader.py
if key.startswith('LORA_') and 'on' in value and 'lora' in value and 'strength' in value:
  if value['on'] and (strength_model != 0 or strength_clip != 0):
    model, clip = LoraLoader().load_lora(model, clip, lora, strength_model, strength_clip)

# enabled loras
if name.startswith('lora_') and lora['on']:
  lora_file = get_lora_by_filename(lora['lora'], log_node=cls.NAME)
```

## UI 要素の配置ロジック

### 共通ルール

- `margin = 10` を左端の基準に使用します。
- `innerMargin = margin * 0.33` を要素間の間隔に使用します。
- 左から右は `posX` を進め、右から左は `rposX` を戻します。
- 描画位置を `hitAreas.*.bounds` に保存し、同一座標系でクリック判定します。

### ヘッダー行の配置

- 左端にトグルを描画し、その幅分 `posX` を進めます。
- トグルの右に `Toggle All` テキストを配置します。
- 右端側に `Strength` と必要に応じて `Model` と `Clip` のラベルを配置します。

```js
// web/comfyui/power_lora_loader.js
const margin = 10;
const innerMargin = margin * 0.33;
const allLoraState = node.allLorasState();
let posX = 10;

this.hitAreas.toggle.bounds = drawTogglePart(ctx, {
  posX,
  posY,
  height,
  value: allLoraState,
});

posX += this.hitAreas.toggle.bounds[1] + innerMargin;
ctx.fillText('Toggle All', posX, midY);

let rposX = node.size[0] - margin - innerMargin - innerMargin;
ctx.fillText('Strength', rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
```

### LoRA 行の配置

- 行背景を `drawRoundedRectangle` で描画します。
- 左端にトグル、右端に数値コントロールを置きます。
- 右端の数値コントロールは `drawNumberWidgetPart` の戻り値で hitArea を設定します。
- `Model` と `Clip` の 2 本表示のときは右側に 2 つ並べます。
- 情報アイコンは右端側から順に配置し、その左側に LoRA 名の領域を確保します。

```js
// web/comfyui/power_lora_loader.js
const margin = 10;
const innerMargin = margin * 0.33;
let posX = margin;
let rposX = node.size[0] - margin - innerMargin - innerMargin;

drawRoundedRectangle(ctx, {
  pos: [posX, posY],
  size: [node.size[0] - margin * 2, height],
});

this.hitAreas.toggle.bounds = drawTogglePart(ctx, {
  posX,
  posY,
  height,
  value: this.value.on,
});
posX += this.hitAreas.toggle.bounds[1] + innerMargin;

const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
  posX: rposX,
  posY,
  height,
  value: strengthValue,
  direction: -1,
});
this.hitAreas.strengthDec.bounds = leftArrow;
this.hitAreas.strengthVal.bounds = text;
this.hitAreas.strengthInc.bounds = rightArrow;
this.hitAreas.strengthAny.bounds = [
  leftArrow[0],
  rightArrow[0] + rightArrow[1] - leftArrow[0],
];

const infoIconSize = height * 0.66;
const infoWidth = infoIconSize + innerMargin + innerMargin;
if (this.hitAreas['info']) {
  rposX -= innerMargin;
  drawInfoIcon(ctx, rposX - infoIconSize, posY + (height - infoIconSize) / 2, infoIconSize);
  this.hitAreas.info.bounds = [rposX - infoIconSize, infoWidth];
  rposX = rposX - infoIconSize - innerMargin;
}

const loraWidth = rposX - posX;
ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
this.hitAreas.lora.bounds = [posX, loraWidth];
```

## まとめ

- トグルは `drawTogglePart` による描画と `hitAreas.toggle` によるクリック判定で構成されています。
- 配置は `posX` と `rposX` を使った左右からのレイアウトで、余白は `margin` と `innerMargin` を基準に統一されています。
- トグル状態は `value.on` に集約され、Python 側で有効な LoRA の適用に使われます。
