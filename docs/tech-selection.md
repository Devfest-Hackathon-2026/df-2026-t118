# 技術選定

状態: 選定済み（2026-11-06）。この調査をもとに ADR-001 を承認したが、提出要件の判明により [`decisions/002-web-stack.md`](decisions/002-web-stack.md)（Web + Firebase Hosting）へ差し替えた。
このファイルには**調査でわかった事実**と**要確認**だけを残す。前提は [`requirements.md`](requirements.md)、論理構成は [`architecture.md`](architecture.md)。

## 決定対象

| # | 対象 | 状態 |
|---|---|---|
| 1 | アプリの実装技術（3D をどこで動かすか） | **最大の論点**。ADR-001 で比較 |
| 2 | 共有拡張（F1 の入口） | 1 に従属 |
| 3 | バックエンドとエージェント実装基盤 | ADR-001 で比較 |
| 4 | データストア・認証・通知・画像保存 | ほぼ Firebase で確定見込み |
| 5 | デプロイ先 | 3・4 に従属 |

## 調査でわかったこと

### 3D をどこで動かすか

差別化の柱が 3D の島（`requirements.md`「ビジュアル要件」）なので、ここが選定を支配する。
`island-app/`（three.js）に S2・S3・S4・S6 の動くプロトタイプがあり、ぷっくりツヤの質感はここで検証済み。**この資産を運べるかどうかが分かれ目。**

| 事実 | 出典 |
|---|---|
| Flutter の 3D は `flutter_scene`。glTF 読み込み、PBR、IBL、カスタムシェーダーに対応。ただし pub.dev は**早期プレビュー**と明記し、0.18/0.19 は master ビルドを要求する | [pub.dev/packages/flutter_scene](https://pub.dev/packages/flutter_scene) |
| iOS / Android では Impeller が既定のレンダラなので、flutter_scene は追加設定なしで動く。Web では Impeller / Flutter GPU が使えず、WebGL2 バックエンドに切り替わる | 同上 |
| React Native の three.js 対応は `@react-three/fiber/native` から **`@react-three/native` という別パッケージに移った**（v10）。React Native 0.78 以降 / React 19 が必要 | [github.com/pmndrs/native](https://github.com/pmndrs/native) |
| **iOS シミュレータ / Android エミュレータでは three.js + EXGL がまともに動かない。実機が要る** | [github.com/expo/expo-three](https://github.com/expo/expo-three) |
| 60fps を裏づける公開ベンチマークは見つからなかった。実機の最小シーンで測るしかない | — |

### 共有拡張（F1）

| 事実 | 出典 |
|---|---|
| Expo には `expo-share-extension`（MaxAst）がある。App Group、Info.plist、Podfile、Xcode ターゲットの作成を設定で済ませられる。受け取る種類は `activationRules` で指定する | [github.com/MaxAst/expo-share-extension](https://github.com/MaxAst/expo-share-extension) |
| 同パッケージは Expo SDK ごとにバージョンが対応する（SDK 54 → 5.0.0 以降）。**React Native 既定の `Text` / `TextInput` はフォントスケーリングの問題で共有拡張内では動かない** | 同上 |
| Flutter は `receive_sharing_intent` が定番。画像・動画・テキスト・URL・任意のファイルを受け取れ、iOS の Share Extension に対応。新しい版は **Swift Package Manager 専用で CocoaPods 非対応** | [pub.dev/packages/receive_sharing_intent](https://pub.dev/packages/receive_sharing_intent) |
| どのパッケージでも、Xcode に Share Extension ターゲットを足し、App Group を本体と共有する手順は共通 | 同上 |

**Web（PWA）は候補から外す。** iOS の Safari は Web Share Target に対応しておらず、共有シートに現れない。F1 が成立しない。

### バックエンドとモデル呼び出し

| 事実 | 出典 |
|---|---|
| Genkit は TypeScript（Node.js）で書け、Cloud Functions for Firebase にデプロイできる。`onCallGenkit` で flow をそのまま callable function にできる | [firebase.google.com/docs/genkit/firebase](https://firebase.google.com/docs/genkit/firebase) |
| Genkit は Zod のスキーマで**型のついた構造化出力**を返せる。F3（意図の 1 文の候補）と F6（提案文）がこれに乗る | [firebase.google.com/docs/genkit](https://firebase.google.com/docs/genkit) |
| API キーは `firebase functions:secrets:set` で Secret Manager に入れ、`defineSecret` で参照する | 同上 |
| Genkit flow を**定時実行（`onSchedule`）から呼ぶ公式の記述は見つからなかった**。通常の関数から flow を呼べば済むはずだが、要確認 | — |

### 束ね（F5）のベクトル検索

| 事実 | 出典 |
|---|---|
| Firestore は `find_nearest` による KNN ベクトル検索に対応。2024-09 に GA | [firebase.google.com/docs/firestore/vector-search](https://firebase.google.com/docs/firestore/vector-search) |
| **呼べるのはサーバー SDK（Node.js / Python / Go / Java）だけ。Web / iOS / Android のクライアント SDK からは直接叩けない** | 同上 |
| Firestore は埋め込みを生成しない。ベクトル型で保存し、ベクトルインデックスを先に作る必要がある | 同上 |

束ねは定時ジョブ（サーバー側）でしか走らないので、クライアント SDK の制限は問題にならない。
MVP の件数（数十件）なら、関数内で総当たりの余弦類似度を計算しても足りる。**インデックスは後から足せる。**

## 要確認

実装を始める前に確かめる。料金・提供状況は変わるので、公式ドキュメントで見る。

- [x] **ハッカソンの審査要件** → [`submission.md`](submission.md) に明文化されていた。実行基盤（Firebase Hosting など）の使用とデプロイ URL が必須。**これにより ADR-001 を廃止し、ADR-002 に差し替えた**
- [ ] クレジットが Vertex AI 側でしか消費されないか。Gemini API（Google AI Studio）経由との違い
- [ ] Firestore ベクトル検索の料金とリージョン
- [ ] Genkit flow を定時実行から呼ぶ書き方
- [ ] iOS の PWA で Web Push が届く条件（ホーム画面への追加が要るか）
- [ ] モバイル Safari の WebGL で `island-app/` が 60fps を保てるか ← **実機で測る**

Expo / Flutter 関連の確認項目は、Web に決めたため不要になった。調査の記録は上に残す。
