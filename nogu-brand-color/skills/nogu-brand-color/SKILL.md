---
name: nogu-brand-color
description: |
  nogu のブランドカラーパレット。UI/Webデザイン、HTML/CSS生成、モックアップ作成、
  プレゼン資料、ダッシュボード、アプリUI など、視覚的な成果物を作るときに必ず参照する。
  色選びに迷ったとき、「いい感じの色で」と言われたとき、デザイン系タスク全般で使う。
  このスキルはユーザーのブランドアイデンティティそのものなので、デザイン作業では
  他のカラーパレットよりも優先して適用すること。
---

# nogu ブランドカラーパレット

KOGUMA TODO カラーガイドラインに基づくブランドカラー。
デザイン作業では、このパレットを基本として使う。

## Service（UI基盤色）

| トークン名 | HEX | 用途 |
|-----------|-----|------|
| `service-bg` | `#F9F9F9` | 背景色 |
| `service-divider` | `#D5D5D8` | 罫線・ボーダー |

## Char（テキスト色）

| トークン名 | HEX | 用途 |
|-----------|-----|------|
| `char-main` | `#2C2E31` | メインテキスト |
| `char-sub` | `#787C87` | サブテキスト・補足情報 |
| `char-placeholder` | `#BBC5D1` | プレースホルダー・無効状態 |

## Brand（ブランド色）

| トークン名 | HEX | 用途 |
|-----------|-----|------|
| `brand-primary` | `#1A6AFF` | メインカラー（CTA、リンク、主要アクション） |
| `brand-primary-sub` | `#D9E6FF` | メインカラーの背景（バッジ、ハイライト領域） |
| `brand-secondary` | `#FF557D` | アクセントカラー（通知、重要マーク） |
| `brand-secondary-sub` | `#FFD9E2` | アクセントカラーの背景（警告帯、アラート背景） |

## 使い方ガイド

### 基本原則
- テキストは `char-main`（#2C2E31）をデフォルトにする。白背景に対して十分なコントラスト比がある
- ボタンやリンクなど主要アクションには `brand-primary`（#1A6AFF）を使う
- 目を引きたい要素（通知バッジ、セール表示など）には `brand-secondary`（#FF557D）を使う
- 淡い背景色が欲しいときは `*-sub` バリアントを使う（Primary Sub / Secondary Sub）

### コンビネーション例
- **カード**: `service-bg` 背景 + `service-divider` ボーダー + `char-main` テキスト
- **CTA ボタン**: `brand-primary` 背景 + 白テキスト
- **通知バッジ**: `brand-secondary` 背景 + 白テキスト
- **選択状態**: `brand-primary-sub` 背景 + `brand-primary` テキスト
- **警告バナー**: `brand-secondary-sub` 背景 + `brand-secondary` テキスト

### CSS カスタムプロパティ（参考）

```css
:root {
  --service-bg: #F9F9F9;
  --service-divider: #D5D5D8;
  --char-main: #2C2E31;
  --char-sub: #787C87;
  --char-placeholder: #BBC5D1;
  --brand-primary: #1A6AFF;
  --brand-primary-sub: #D9E6FF;
  --brand-secondary: #FF557D;
  --brand-secondary-sub: #FFD9E2;
}
```

### Tailwind 設定（参考）

```js
colors: {
  service: { bg: '#F9F9F9', divider: '#D5D5D8' },
  char: { main: '#2C2E31', sub: '#787C87', placeholder: '#BBC5D1' },
  brand: {
    primary: { DEFAULT: '#1A6AFF', sub: '#D9E6FF' },
    secondary: { DEFAULT: '#FF557D', sub: '#FFD9E2' },
  },
}
```
