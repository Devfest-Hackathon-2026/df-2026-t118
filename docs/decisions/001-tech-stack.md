# ADR-001: 技術スタック

- 日付: 2026-11-06
- 状態: **廃止**（[ADR-002](002-web-stack.md) が置き換えた）
- 決定者: Michiru Kambara

## 背景

[`requirements.md`](../requirements.md) が確定し、差別化の柱が **3D の島**（ぷっくりツヤのスタイライズ）と決まった。
これにより技術選定の制約が 3 つ立った。

1. **3D の質が要件**。平面の代替表示は保険であって、主役は 3D
2. **入口は共有シート**（F1）。SNS から直接保存できないと体験が成立しない
3. **`island-app/`（three.js）に動くプロトタイプがある**。島の生成、カード、キャラクター、ツヤの質感を検証済み

一方 [`AGENTS.md`](../../AGENTS.md) は「Google の製品・言語を優先する」「Google 以外を採用する場合は、Google の候補と並べて比較し、選ぶ理由を示す」としている。
3 と Google 優先が正面からぶつかる。これを決めたのがこの ADR。

調査した事実と出典は [`tech-selection.md`](../tech-selection.md) にある。

## 候補と比較 — アプリの実装技術

| 観点 | A: Flutter + flutter_scene | B: React Native (Expo) + three.js | C: Swift + SceneKit / RealityKit |
|---|---|---|---|
| 学習コスト | 中。Dart と宣言的 UI は学びやすいが、**flutter_scene は早期プレビューで事例が少ない** | 低〜中。`island-app` が JS なので地続き。R3F は宣言的で RN と同じ書き味 | 高。Swift + SceneKit を両方やる。チームで書ける人が限られる |
| 実装速度 | UI は速い。**3D は作り直し**。ツヤの質感・島の生成を Dart で再実装する | **3D の資産をそのまま運べる**。最大の不確実性が消える。共有拡張は設定で済む | 共有シートは最も素直。3D は作り直し。画面も UIKit/SwiftUI で作り直し |
| Google 製品との相性 | ◎ Flutter も Firebase も Gemini も Google | △ フロントは非 Google。Firebase SDK と Gemini は問題なく使える | △ 同左 |
| コスト | 差なし（3 案ともバックエンドは従量課金） | 差なし | 差なし |
| デプロイ容易性 | ○ Flutter の標準手順 | ○ EAS Build。**ただし three.js はシミュレータで動かず実機が要る** | ○ Xcode / TestFlight。iOS のみ |
| 情報量 | UI は多い。**3D は少なく、API も動いている** | 多い。ただし RN 対応は `@react-three/native` へ移行済みで、古い記事は使えない | 多い。ただし「ぷっくりツヤ」の作例は自前 |
| 対応プラットフォーム | iOS / Android | iOS / Android | **iOS のみ** |

## 候補と比較 — バックエンドとエージェント実装基盤

| 観点 | X: Cloud Functions for Firebase + Genkit (TS) | Y: Cloud Run + Genkit / Go | Z: Firebase AI Logic（クライアントから直接） |
|---|---|---|---|
| 学習コスト | 低。アプリが TS なら言語が 1 つで済む | 中。Go を足す | 最低 |
| 実装速度 | 速い。`onCallGenkit` で flow をそのまま公開できる。Zod で構造化出力 | 中。コンテナと CI を自分で持つ | 速いが**定時ジョブが作れない** |
| Google 製品との相性 | ◎ | ◎ | ◎ |
| コスト | 従量課金。アイドル時は課金されない | 従量課金。最小インスタンス 0 なら同じ | 従量課金 |
| デプロイ容易性 | ◎ `firebase deploy` 一発。定時実行は `onSchedule` | ○ | ◎ |
| 情報量 | 多い | 多い | 中 |
| 定時ジョブ | ○ Scheduled Functions | ○ Cloud Scheduler + Cloud Run | **×** |

要件の「能動性の実体は定時ジョブ」（[`architecture.md`](../architecture.md)）から、**Z は単独では成立しない。**

## 決定

**B（アプリ）と X（バックエンド）を採用する。言語は TypeScript に統一する。**

| 層 | 採用 | 補足 |
|---|---|---|
| アプリ | React Native (Expo) + `@react-three/native`（three.js） | RN 0.78 以降 / React 19 が要る。**開発とデモ録画は実機** |
| 共有拡張 | `expo-share-extension` | `activationRules` で URL・画像・テキストを受ける |
| バックエンド | Cloud Functions for Firebase (TypeScript) | `onCallGenkit` で flow を公開 |
| エージェント基盤 | Genkit (TypeScript) | Zod のスキーマで構造化出力。F3・F6 がここに乗る |
| 定時ジョブ | Scheduled Functions（`onSchedule`） | 夜の整理 / 朝の提案 / 振り返り / 週 1 の仕分け |
| モデル | Gemini（Vertex AI 経由） | クレジットの消費先は要確認 |
| データ | Firestore | 束ね（F5）のベクトル検索は定時ジョブから。サーバー SDK のみ対応 |
| 画像 | Cloud Storage for Firebase | 本人のみアクセス可にする |
| 認証 | Firebase Authentication | |
| 通知 | FCM | ボタン付きプッシュ |

フロントエンド以外はすべて Google 製品。

## 決定後に判明した前提（2026-11-06）

`main` をマージしたところ、この ADR で「要確認」としていた**審査要件が [`submission.md`](../submission.md) に明文化されていた**。
内容がこの決定の前提を崩している。**決定をこのまま進めると審査対象外になりうる。**

| 判明した要件 | この決定への影響 |
|---|---|
| アプリの実行に App Engine / Compute Engine / GKE / Cloud Run / Firebase App Hosting / Firebase Hosting のいずれかを使う。使っていないと**審査対象外** | React Native のネイティブアプリは、これらの実行基盤の上では動かない |
| 提出物に「プロジェクトをデプロイした URL」が必須。2026-11-14 まで稼働させる | **ネイティブアプリに URL はない** |
| 11/7（土）の完了条件が「実行基盤上の URL が外から開く」 | 残り 1 日 |
| 提出締切 2026-11-10（火）19:00 | 実装期間は実質 3 日。iOS の共有拡張は実機ビルドが要り、配信もできない |

**Cloud Functions for Firebase が実行基盤のリストに入っていない**点も要確認。第 2 世代は Cloud Run の上で動くが、審査でそう扱われる保証はない。Firebase Hosting を併用すれば確実に満たせる。

### 再検討の選択肢

| 案 | 内容 | デプロイ URL | 共有シート（F1） | 3D の資産 | 3 日で届くか |
|---|---|---|---|---|---|
| **A（推奨）** | Web（PWA）+ three.js を Firebase Hosting に置く | ○ | **×**。アプリ内の「＋」と URL 貼り付けで代替 | **`island-app/` がそのまま動く** | ○ |
| B | React Native を維持し、Expo の Web 出力も Firebase Hosting に置く | △ 実体は別ビルドで、審査で説明が要る | ○ | three.js を RN と Web の両方で動かす | × |
| C | Flutter Web + flutter_scene | ○ | × | 作り直し | × |

**A を推奨する。** 理由は 3 つ。

1. **11/7 の「URL が外から開く」を最短で満たせる。** `island-app/` は既に Web で動いているので、Firebase Hosting に載せるだけで条件を通せる
2. **残り 3 日を 3D の質とデモに使える。** 差別化の柱に時間を寄せられる
3. **F1 の共有シートは、要件の中で最も代替が効く。** アプリ内の「＋」からの保存は `requirements.md` の遷移表に既にあり（S2 → S3）、デモでも「Instagram のスクショを選ぶ」で成立する。PWA としてホーム画面に追加すればアプリらしく見せられる

この ADR で Web を却下した理由は「iOS Safari が Web Share Target 非対応で F1 が成立しない」の 1 点だった。**提出要件の前では、その欠点より実行基盤の制約が重い。**

A を採る場合はこの ADR を廃止し、ADR-002 を起こす。バックエンド側（Genkit / Firestore / Gemini / FCM）の決定は A でもそのまま使える。

## 根拠

- **最大のリスクは 3D であって、Google 製品比率ではない。** 期間内に 60fps のツヤの島が立つかどうかでデモの成否が決まる。`island-app/` で一度通した道をもう一度通れるのは B だけで、A と C は検証済みの質感を捨てて作り直すことになる
- **A の 3D は土台が揺れている。** flutter_scene は pub.dev 自身が早期プレビューと書き、バージョンによっては master ビルドを要求する。ハッカソンの期間中にフレームワーク側の破壊的変更を踏むリスクを、差別化の柱に負わせたくない
- **Google 製品との相性は、バックエンドで十分に満たせる。** Gemini / Genkit / Firebase / Cloud Functions / FCM と、フロント以外すべて Google。`AGENTS.md` も Google 以外の採用を禁じてはおらず、比較して理由を示すことを求めている（この ADR がそれ）
- **言語が TypeScript 1 つに揃う。** アプリ、共有拡張、Genkit の flow が同じ言語になり、レビューと分担のコストが下がる（`tech-selection.md` の論点「言語の統一」）
- **X は定時ジョブとモデル呼び出しが同じ場所に置ける。** 夜の整理・朝の提案・振り返り・週 1 の仕分けはすべて `onSchedule` で書け、常時起動のサービスを持たずに済む（`AGENTS.md` 方針 4）

## 却下した案と理由

- **A: Flutter** — Google 製品との相性は最良だが、3D の土台（flutter_scene）が早期プレビューで、既存の three.js 資産も捨てることになる。差別化の柱を最も不確実な部分に賭ける形になる
- **C: Swift** — 共有シートは最も素直で 3D も SceneKit で作れるが、iOS 専用になり、画面も 3D も全部作り直しで、書ける人が限られる。期間内の完成可能性が最も低い
- **Web（PWA）+ three.js** — 既存資産をそのまま使える唯一の案だが、**iOS Safari が Web Share Target に対応しておらず共有シートに出ない**。F1 が成立しないため、比較表に入れる前に落とした
- **Z: Firebase AI Logic でクライアントから直接** — バックエンドなしで最速だが、定時ジョブが作れない。このプロダクトの能動性は定時ジョブそのもの
- **ADK** — 要件が「自律エージェントではなく、決まった段階を通るパイプライン」と定めている（`requirements.md`「技術構成の前提」）。重いエージェント基盤は MVP に不要

## リスクと対策

| リスク | 対策 |
|---|---|
| three.js がシミュレータで動かない | 開発とデモ録画を実機で行う。チームの iPhone を 1 台デモ機に固定する |
| `@react-three/native` が RN 0.78+ / React 19 を要求する | Expo SDK のバージョンを先に固定し、最小シーンを実機で通してから本実装に入る |
| 共有拡張内で RN の `Text` / `TextInput` が動かない | 拡張側の UI は最小にし、意図の 1 文の確定はアプリ本体に寄せるか、代替コンポーネントを使う |
| **審査要件がフロントエンドまで Google 製品を求める** | **この決定を覆す唯一の条件。** 判明した時点で A（Flutter）を再検討し、この ADR を廃止して ADR-002 を起こす |
| 3D の読み込みが遅い | 要件どおり平面の簡易表示を先に出す（`requirements.md` 制約） |

## 決定後にやること

- [ ] [`tech-selection.md`](../tech-selection.md)「要確認」を潰す。**審査要件は最優先**
- [ ] `.devcontainer/` を Node.js / Expo 向けに更新する
- [ ] `.github/workflows/ci.yml` の `check` を TypeScript の型検査・lint に合わせる
- [ ] Expo SDK のバージョンを固定し、最小の three.js シーンを実機で通す（**他の実装より先**）
- [ ] Firebase プロジェクトを作り、Hello World をデプロイまで通す
