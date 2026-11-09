# ADR-006: GLB キャラクターの読み込みと Draco デコーダの配信元

- 日付: 2026-11-10
- 状態: 承認
- 決定者: fluffymarron

## 背景

4人目のキャラクター「モフ」（イシュー #43）を、3D生成ツール（RodinAI）で作った GLB で島に置く。
元の GLB は 23MB で重すぎたため、glTF-Transform で 1.35MB に縮めた版を使う。この版は
`KHR_draco_mesh_compression` と `EXT_texture_webp` が**必須**（`extensionsRequired`）になっている。

three 0.128（ADR-002 で固定）の GLTFLoader は WebP には対応しているが、Draco のメッシュは
DRACOLoader とデコーダ（wasm）がないと読めない。デコーダをどこから配るかを決める必要があった。

## 候補と比較

| 観点 | A. three 同梱のデコーダを自前で配信 | B. Google の CDN（gstatic）から読む | C. Draco なしで書き出し直す |
|---|---|---|---|
| 学習コスト | 低 | 低 | 中（素材の作り直し） |
| 実装速度 | 速い | 速い | 素材の作り直しを待つ |
| Google 製品との相性 | Firebase Hosting で完結 | Google の CDN | 影響なし |
| コスト | 増えない（配信が 約250KB 増える） | 増えない | 増えない |
| デプロイ容易性 | `public/draco/` に置くだけ | 外部への通信が増える | ローダーが GLTFLoader だけで済む |
| 情報量 | 多い（three 公式例と同じ構成） | 多い | 多い |

## 決定

A。`node_modules/three/examples/js/libs/draco/gltf/` の `draco_decoder.wasm` と `draco_wasm_wrapper.js` を
`public/draco/` にコピーし、Firebase Hosting から配る。

読み込みは `src/infrastructure/three/characterModels.ts` が持つ。島の描画（`src/vendor/island.js`）は
`window.THREE` を使う素の JS なので、ローダーは `window.IslandCharacterModels.load(kind)` として渡す。
読み込み中と失敗時はぽこを表示する。

## 根拠

- 新しい npm 依存を増やさない。three 0.128 に同梱されたものなので版のずれがない
- 外部への通信を増やさず、Firebase Hosting だけで完結する

## 却下した案と理由

- B: デコーダの版を three 0.128 と合わせる手間があり、外部への通信が増える
- C: 素材を作り直す必要があり、メッシュの簡略化で見た目が変わる

## 運用上の注意

- three を上げるときは、`public/draco/` のデコーダも同じ版のものに差し替える
- `draco_decoder.js`（wasm が使えないブラウザ向け）は置いていない。WebAssembly のない環境では読み込みに失敗し、ぽこが出る
