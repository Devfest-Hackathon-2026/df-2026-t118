# ADR-002: 技術スタック（ADR-001 の差し替え）

- 日付: 2026-11-06
- 状態: **承認**
- 決定者: Michiru Kambara

## 背景

[ADR-001](001-tech-stack.md) で React Native (Expo) + three.js を承認した直後、`main` をマージして [`submission.md`](../submission.md) の提出要件が判明し、前提が崩れた。

| 提出要件 | ADR-001 への影響 |
|---|---|
| App Engine / Compute Engine / GKE / Cloud Run / Firebase App Hosting / Firebase Hosting のいずれかを使う。使っていないと**審査対象外** | ネイティブアプリはこれらの実行基盤の上で動かない |
| 提出物に「デプロイした URL」が必須。2026-11-14 まで稼働 | ネイティブアプリに URL はない |
| 11/7（土）の完了条件が「実行基盤上の URL が外から開く」 | 残り 1 日 |
| 提出締切 2026-11-10（火）19:00 | 実装は実質 3 日。iOS の共有拡張は実機ビルドが要り、配信もできない |

ADR-001 を廃止し、本 ADR が置き換える。

## 候補と比較

ADR-001 の 6 観点の比較は済んでいるため、ここでは**提出要件を満たせるか**を軸に 3 案を比べる。

| 観点 | A: Web (PWA) + three.js | B: RN 維持 + Expo Web 出力も配信 | C: Flutter Web + flutter_scene |
|---|---|---|---|
| 学習コスト | 低。`island-app/` と同じ JS / three.js | 中。RN と Web の 2 系統を持つ | 高。Dart と flutter_scene |
| 実装速度 | **最速。既存プロトタイプがそのまま動く** | 遅い。three.js を 2 回動かす | 遅い。3D を作り直す |
| Google 製品との相性 | ○ Firebase Hosting / Firestore / Gemini。フロントの枠組みのみ非 Google | ○ 同左 | ◎ |
| コスト | 従量課金。Hosting は無料枠が厚い | 同左 | 同左 |
| デプロイ容易性 | **◎ `firebase deploy` で URL が出る** | △ 実体が別ビルドで、審査での説明が要る | ○ |
| 情報量 | 多い | 多い | 3D は少ない |
| 提出要件（実行基盤） | **○ Firebase Hosting** | △ | ○ |
| 提出要件（デプロイ URL） | **○** | △ | ○ |
| 共有シート（F1） | **×** iOS Safari は Web Share Target 非対応 | ○ | × |
| 3 日で届くか | **○** | × | × |

## 決定

**A を採用する。Web アプリ（PWA）として作り、Firebase Hosting で配信する。**

| 層 | 採用 | 補足 |
|---|---|---|
| アプリ | Vite + React + TypeScript | `island-app/` の画面遷移と状態を移植する |
| 3D | three.js（`island-app/vendor/island.js` をそのまま使う） | React から `useEffect` でマウントする。**検証済みの質感を変えない** |
| 配信 | **Firebase Hosting** | 提出要件の実行基盤リストに含まれる。ここで要件 1 を満たす |
| PWA | `vite-plugin-pwa` | ホーム画面に追加できる。デモはスマホの画面収録 |
| バックエンド | Cloud Functions for Firebase + Genkit (TypeScript) | ADR-001 から据え置き |
| 定時ジョブ | Scheduled Functions（`onSchedule`） | 据え置き |
| モデル | Gemini（Vertex AI 経由） | 据え置き。プロダクトが使う AI は Gemini に統一（提出要件） |
| データ | Firestore / Cloud Storage for Firebase | 据え置き |
| 認証 | Firebase Authentication（匿名認証から始める） | デモの導線を短くする |
| 通知 | FCM（Web Push） | iOS はホーム画面に追加した PWA でのみ受け取れる。デモは画面内の演出で代替できるようにする |

言語は TypeScript に統一する。

## 根拠

1. **11/7（土）の「実行基盤上の URL が外から開く」を最短で満たせる。** `island-app/` は既に Web で動いているので、Firebase Hosting に載せるだけで条件を通せる。他の 2 案はここで 1 日以上を失う
2. **差別化の柱である 3D を、検証済みのまま運べる。** ぷっくりツヤの質感を作り直さずに済むのは A だけ
3. **残り 3 日を 3D の質とデモに使える。** 新しいフレームワークの学習に時間を取られない
4. **失うのは共有シート（F1）だけ。** しかも代替がある（下記）
5. **バックエンドの決定（Genkit / Firestore / Gemini / FCM）を引き継げる。** ADR-001 の検討が無駄にならない

## 共有シートを失うことへの対応

要件 F1 の入口を変える。

| 変更前 | 変更後 |
|---|---|
| SNS の共有シートから保存する | 島の「＋」から、URL の貼り付け・画像/スクショのアップロード・テキストの貼り付けで保存する |

- アプリ内の「＋」からの保存は、`requirements.md` の遷移表に**元から入っている**（S2 → S3）。画面を追加する必要はない
- デモは「Instagram で見つけた投稿のスクショを選ぶ」で成立する。**実際に動く画面を録る**という提出要件にも適う
- Android の PWA は manifest の `share_target` で共有シートに出せる。**MVP には入れない**が、将来の拡張として残す

## 却下した案と理由

- **B: React Native を維持し、Expo の Web 出力も配信する** — 一見すると両取りだが、three.js を RN と Web の 2 系統で動かすことになり、3 日では終わらない。審査でも「デプロイした URL」と実際のアプリが別物である説明が要る
- **C: Flutter Web + flutter_scene** — 3D を作り直すうえ、flutter_scene は Web では Impeller / Flutter GPU が使えず WebGL2 バックエンドに切り替わる。実績が最も薄い経路を 3 日で通すことになる
- **ADR-001（React Native ネイティブ）** — 提出要件を満たせない。廃止する

## リスクと対策

| リスク | 対策 |
|---|---|
| モバイル Safari の WebGL で 60fps が出ない | `island-app/` で実機確認する。出なければ要件どおり平面の簡易表示に落とす |
| iOS の PWA で Web Push が届かない | デモは画面内の演出（島を開いたときの再生）で成立させる。通知は補助に置く |
| Firestore のベクトル検索がサーバー SDK 専用 | 束ねは定時ジョブでしか走らないので影響なし。MVP は総当たりでも足りる |
| 3 日で全機能は入らない | デモシナリオ（UC1 → UC2 → UC4 → UC5 → UC6）に必要な機能から作る。F7・F8・F9 は後回し |

## 決定後にやること

- [ ] **Vite + React + TypeScript のプロジェクトを作り、`island.js` を載せて Firebase Hosting にデプロイする（11/7 の完了条件）**
- [ ] `scripts/check.sh` は `package.json` を置けば Node.js の検証が自動で走る。`lint` / `typecheck` / `build` のスクリプトを用意する
- [ ] `.devcontainer/` を Node.js 向けに更新する
- [ ] Firebase プロジェクトを作り、Hosting / Firestore / Functions / Auth を有効にする
- [ ] `island-app/` をリポジトリに取り込む（現在は外にある）
