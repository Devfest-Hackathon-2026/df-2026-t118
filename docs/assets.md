# 外部素材の台帳

著作物利用シート（提出物）を書くための元データ。**素材を使った時点でここに追記する**。提出前にまとめて思い出すのは不可能で、記載漏れはルール違反になる。

対象は、自分たちで作っていないものすべて。

- 画像・イラスト・アイコン・ロゴ
- フォント
- 音源・効果音・BGM（デモ動画に使うものを含む）
- 動画素材
- デモ・シードデータに使った外部コンテンツ（記事・動画の URL、サムネイル）
- OSS ライブラリ（提出シートの対象かは配布フォーマットの指示に従う。判断がつかないものは記載しておく）
- 生成 AI で作った素材（生成に使ったツールとプロンプトの要旨を備考に書く）

## 台帳

| # | 素材 | 種別 | 出典 URL | 作者・提供元 | ライセンス | 利用箇所 | 改変 | クレジット表記 | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Instrument Sans | フォント | https://fonts.google.com/specimen/Instrument+Sans | Rodrigo Fuenzalida, Jordan Egstad | SIL OFL 1.1 | `public/fonts/` 見出しと英字ラベル | なし（Google Fonts 配信の woff2 をそのまま同梱） | 不要 | 収録は 400/500/600。デザイン上は 300（Light）指定だが Google Fonts に 300 が無く、400 で描画される |
| 2 | Zen Kaku Gothic New | フォント | https://fonts.google.com/specimen/Zen+Kaku+Gothic+New | Yoshimichi Ohira | SIL OFL 1.1 | `public/fonts/` 日本語本文 | なし | 不要 | 300/400/500 の3ウェイト。unicode-range で121スライスに分かれており計 3.9MB。ブラウザは本文に出る文字を含むスライスだけ取得する |
| 3 | JetBrains Mono | フォント | https://fonts.google.com/specimen/JetBrains+Mono | JetBrains, Philipp Nurullin, Konstantin Bulenkov | SIL OFL 1.1 | `public/fonts/` 小さなラベルと時刻 | なし | 不要 | |
| 4 | Material Symbols Outlined | フォント（アイコン） | https://fonts.google.com/icons | Google | Apache License 2.0 | `public/fonts/` 各画面のアイコン | **あり** — 軸を opsz24/wght400/FILL0/GRAD0 に固定し、使用する24個だけにサブセット（2.3MB → 268KB） | 不要 | 収録しているアイコンは下の一覧のとおり。足すときは取り直しが必要 |
| 5 | three.js r128 | OSS ライブラリ | https://github.com/mrdoob/three.js/tree/r128 | three.js authors (mrdoob) | MIT | `package.json` (`"three": "0.128.0"`) | なし | 不要 | r152 以降の color management 刷新で削除された API に `src/vendor/island.js` が依存しているため r128 に固定。詳細は `docs/decisions/002-web-stack.md` |
| 6 | island.js（3Dの島とキャラクター） | 生成AIで作った素材 | — | Claude（Claude Design） | — | `src/vendor/island.js` | なし（生成物をそのまま使用） | 要確認 | Claude Design のデザインプロジェクト「Island mobile app form」で生成。three.js で島・キャラクター（ぽこ／ともり／ふみ）・カード・ステッカーを手続き的に描く。外部の画像素材は使っておらず、模様はすべてコード生成 |
| 7 | 島アプリのUI（S1〜S9） | 生成AIで作った素材 | — | Claude / Gemini | — | `src/components/screens/`・`src/styles/styles.css` | — | 要確認 | デザインは Claude Design のプロトタイプ v2 をベースに、PC（右ドロワー）＆スマホ（ボトムシート）両対応の React + TypeScript コンポーネントとして実装 |
| 8 | アプリアイコン | 生成AIで作った素材 | — | Claude Code | — | `public/icons/*.png` | — | 要確認 | 外部素材を使わず、Python の zlib だけで PNG を直接生成。空色の地に島とドームを描いたもの |
| 9 | React / React DOM | OSS ライブラリ | https://react.dev/ | Meta Platforms, Inc. | MIT | `src/` フロントエンド UI | なし | 不要 | ADR-002 / ADR-003 に基づき S1〜S9 の画面コンポーネントで使用 |
| 10 | Firebase JS SDK / Firebase Functions / Genkit | OSS ライブラリ | https://firebase.google.com/ | Google | Apache License 2.0 | `src/infrastructure/firebase/`, `functions/` | なし | 不要 | Auth / Firestore / Storage / Cloud Functions で使用。Genkit は依存に含まれるが実行経路外 |
| 11 | Zod | OSS ライブラリ | https://zod.dev/ | Colin McDonnell | MIT | `functions/src/schemas.ts` | なし | 不要 | Gemini 構造化出力の型検証で使用 |
| 12 | モフ（3D キャラクター） | 生成AIで作った素材 | — | RodinAI | 要確認 | `public/models/mofu.glb` 島の4人目のキャラクター | **あり** — glTF-Transform で Draco 圧縮・テクスチャを WebP に変換（23MB → 1.35MB） | 要確認 | RodinAI で生成。プロンプトの要旨: 要確認 |
| 13 | モフのアイコン画像 | 生成AIで作った素材 | — | ChatGPT | 要確認 | `public/characters/mofu.png` 吹き出し・シートのキャラアイコン | なし | 要確認 | ChatGPT で生成。プロンプトの要旨: 要確認 |
| 14 | Draco デコーダ（three r128 同梱） | OSS ライブラリ | https://github.com/google/draco | Google | Apache License 2.0 | `public/draco/` モフの GLB の展開 | なし（`node_modules/three/examples/js/libs/draco/gltf/` からコピー） | 不要 | ADR-006。GLTFLoader / DRACOLoader は three r128（#5）に同梱のもの |

### Material Symbols で収録しているアイコン

`signal_cellular_alt` `wifi` `battery_full` `search` `add` `arrow_forward` `360` `auto_awesome` `check` `edit`
`schedule` `chevron_right` `arrow_back` `more_horiz` `sentiment_satisfied` `hourglass_empty` `waves`
`add_a_photo` `close` `inventory_2` `construction` `storefront` `local_library` `restart_alt`

## フォントの取得手順

`public/fonts/` は Google Fonts の css2 が返す `@font-face` を、参照先だけローカルに書き換えたもの。
更新するときは同じ手順をなぞる。`unicode-range` は触らないこと（触ると日本語のスライス分割が壊れる）。

本文用（woff2 を受け取るため、ブラウザの User-Agent を付けて取得する）:

```
https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Zen+Kaku+Gothic+New:wght@300;400;500&family=JetBrains+Mono:wght@500&display=swap
```

アイコン用（軸を1点に固定し、使うアイコン名だけ `text=` で渡す。アイコンを足したらこの一覧に加えて取り直す）:

```
https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&text=<上の一覧をスペース区切りで URL エンコードしたもの>&display=swap
```

返ってきた CSS 内の `https://fonts.gstatic.com/...` をすべて取得し、`src: url(...)` をローカルのファイル名に差し替えて `public/fonts/fonts.css` にまとめる。
