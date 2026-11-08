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
- [x] **クレジットが Vertex AI 側でしか消費されないか。Gemini API（Google AI Studio）経由との違い**
  → **実装は Gemini API（`generativelanguage.googleapis.com`、API キー方式）を使っている。Vertex AI は使っていない。**
  提出要件 3「AI は Gemini に統一」は満たすが、`product-doc.md` と ADR の「Vertex AI 経由」という記述は実装と食い違っていた（修正済み）。
  **決定（2026-11-08）**: Vertex AI には寄せず、Gemini API のままにする。移行コストが提出までの残り時間に見合わないため。
  詳細は [`implementation-status.md`](implementation-status.md) 2.2
- [x] **Firestore ベクトル検索の料金とリージョン**（2026-11-08 公式ドキュメントで確認）
  - 課金は **kNN インデックスエントリ 100 件ごとに 1 read**。返ってきたドキュメントの read は別途かかる。
    公式の例では、limit 5 で 1,550 件のインデックスエントリを読んだクエリが「ドキュメント 5 read ＋ インデックスエントリ 16 read」になる
  - `find_nearest` にはベクトルインデックスが必要。`where` で事前に絞る場合は複合ベクトルインデックスが要る
  - クエリベクトルは 2048 次元まで、結果は 1000 件まで
  - リージョン別のベクトル専用料金は公式に記載が見つからなかった。Firestore の「ロケーション別の料金」に従うものとみられる（**要確認のまま**）
  - **ただし、このプロジェクトでは使っていない。** 束ねは Cloud Functions 内で総当たりのコサイン類似度を計算しており
    （`functions/src/domain/clustering.ts`）、ベクトルインデックスを作っていないため、この課金は発生しない。
    件数が増えてインデックスに移す段階で、改めてここを見ること
  - 出典: [Search with vector embeddings](https://firebase.google.com/docs/firestore/vector-search) /
    [Understand Cloud Firestore billing](https://firebase.google.com/docs/firestore/pricing) /
    [Firestore pricing](https://cloud.google.com/firestore/pricing)
- [x] ~~Genkit flow を定時実行から呼ぶ書き方~~ → **Genkit を通さない方針に決定したため不要**（[`implementation-status.md`](implementation-status.md) 2.3）
- [x] **iOS の PWA で Web Push が届く条件**（2026-11-08 WebKit / Apple のドキュメントで確認）
  - **ホーム画面への追加が必須**。Safari のタブで開いたままでは届かない。iOS / iPadOS 16.4 以降
  - manifest の `display` を `standalone` にしておく必要がある（本プロジェクトの `manifest.webmanifest` は `standalone` 済み）
  - 通知の許可要求は、ボタンのタップなど**ユーザー操作に応じて**出す必要がある
  - Apple Developer Program への加入は不要。標準の Push API / Notifications API / **Service Worker** で動く
  - **結論: このプロジェクトでは Web Push は実現できない。** オフライン対応を入れない判断（[`implementation-status.md`](implementation-status.md) 2.4）に伴い
    Service Worker を登録していないため、Web Push の前提を満たさない。通知相当の体験はアプリ内の「しまの連絡箱」で代替する
  - 出典: [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) /
    [WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
- [ ] **モバイル Safari の WebGL で島が 60fps を保てるか ← 未実測。実機が要る**
  - デスクトップのブラウザやモバイルエミュレーションで測っても答えにならない（GPU が別物）ため、数値は出していない
  - 測り方: iPhone を Mac に USB 接続し、Safari の「開発」メニューから
    `https://hannari-hustlers.web.app` を選んで Web Inspector を開き、**タイムライン**で島をドラッグしながら記録する。
    見るのは平均 fps と、回転中にフレーム落ちが出るかどうか
  - 落ちる場合に効きそうな順: 影の解像度を下げる → `devicePixelRatio` の上限を 2 に制限する → 建物の個数上限（現状 4 棟）を下げる

Expo / Flutter 関連の確認項目は、Web に決めたため不要になった。調査の記録は上に残す。
