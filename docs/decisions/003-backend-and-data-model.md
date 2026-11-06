# ADR-003: バックエンド設計・データモデル・実アプリ化仕様

- 日付: 2026-11-06
- 状態: **承認**
- 決定者: Michiru Kambara

## 背景

[ADR-002](002-web-stack.md) で技術スタックの大枠（Vite + React + TypeScript / three.js / Firebase Hosting / Cloud Functions + Genkit / Firestore / Gemini）を決定したが、[`architecture.md`](../architecture.md) の「実装時に決めること」に残っていた以下の詳細設計と、モック専用になっていた UI を実際に普段使いできるアプリにするための仕様を確定する必要があった。

1. ユーザー認証の開始方法
2. Firestore のデータモデル（コレクション階層と島の状態の保持方法）
3. 画像と 3D カード用切り抜きステッカーの保存方式
4. 夜の整理（F5: 束ね）のベクトルクラスタリング方式
5. 定時ジョブ（夜・朝）と手動オンデマンド実行の両立方式
6. フロントエンド（React）とバックエンド（Cloud Functions + Genkit）のディレクトリ構成

## 候補と比較

### 1. Firestore データモデル設計

| 観点 | A: `users/{uid}` 配下にサブコレクション（`items`, `bundles`, `proposals`） | B: ルート直下にコレクションを置き `uid` でフィルタ | C: `users/{uid}` の 1 ドキュメント内に全配列をネスト |
|---|---|---|---|
| 学習コスト | 低（素直な階層構造） | 低 | 最低 |
| 実装速度 | **速い**（クエリに毎回 `where('uid','==',uid)` が不要） | 普通（複合インデックス設定が増える） | 速いが配列更新の競合が起きやすい |
| Google 製品との相性 | ◎ Firestore Security Rules で `users/{uid}/{document=**}` を一括保護できる | ○ ルールごとに `resource.data.uid == request.auth.uid` が必要 | △ 1 ドキュメント上限 1MB に引っかかる |
| コスト | 同じ（ドキュメント読取数ベース） | 同じ | 少ないがスケールしない |
| デプロイ容易性 | **◎ 複合インデックスなしで基本クエリが動く** | △ `uid + createdAt` 等の複合インデックス定義が必須 | ◎ |
| 情報量 | 多い（Firebase 公式のユーザーデータ分離パターン） | 多い | 少ない |

### 2. 画像と切り抜きステッカーの保存方法

| 観点 | A: 元画像は Cloud Storage、3D カード用の軽量ステッカー（縮小 DataURL）は Firestore `items` にキャッシュ | B: 元画像もステッカーもすべて Cloud Storage に置き、毎回 URL 取得 | C: Cloud Storage を使わず Firestore に Base64 で直入れ |
|---|---|---|---|
| 学習コスト | 低 | 低 | 最低 |
| 実装速度 | **速い**（3D の島描画時に CORS や非同期テクスチャ読込待ちで詰まらない） | 中（three.js の CanvasTexture 生成時に Storage の CORS 設定が必須） | 速いが 1MB 制限ですぐ壊れる |
| Google 製品との相性 | ◎ Cloud Storage + Firestore の役割分担に合致 | ◎ | × アンチパターン |
| コスト | 無料枠内 | 無料枠内 | ドキュメント肥大化 |
| デプロイ容易性 | **◎ Storage CORS 設定に依存せず 3D ステッカーが即表示される** | △ `gsutil cors set` を忘れると three.js で画像が読めない | ○ |
| 情報量 | 多い | 多い | — |

### 3. 夜の整理（F5）の束ね（クラスタリング）方式

| 観点 | A: Gemini Embedding でベクトル化し、Cloud Functions 内でコサイン類似度計算 ＋ Gemini で束の要約生成 | B: Firestore Vector Search (`find_nearest`) インデックスを使う | C: Embedding を使わず、保存物一覧をそのまま Gemini のプロンプトに渡して分類させる |
|---|---|---|---|
| 学習コスト | 低（コサイン類似度関数で完結） | 中（専用インデックス作成が必要） | 最低 |
| 実装速度 | **速い** | 遅い（インデックスのビルド待ちが発生） | 速い |
| Google 製品との相性 | ◎ Gemini Embedding (`text-embedding-004`) + Genkit | ◎ | ○（ただし `architecture.md` の「束ねには埋め込みベクトルを使う」要件から外れる） |
| コスト | 最小 | 最小（要確認: ベクトルインデックスの課金条件） | 毎回全件を LLM に渡すためトークン増 |
| デプロイ容易性 | **◎ インデックス作成コマンド不要で即動く** | △ `gcloud firestore indexes composite create` が必要 | ◎ |
| 情報量 | 多い | 中 | 多い |

### 4. フロントエンドとバックエンドのディレクトリ構成

| 観点 | A: ルート直下をフロント（Vite + React + TS）、`functions/` をバックエンド（Cloud Functions + Genkit）にする標準構成 | B: `frontend/` と `backend/` に完全に分ける |
|---|---|---|
| 学習コスト | 低（Firebase 公式テンプレートと同じ） | 低 |
| 実装速度 | **最速**（`scripts/check.sh` がルート直下の `package.json` を自動検出して lint/typecheck/build を回す） | 中（`check.sh` と CI のパス変更が必要） |
| Google 製品との相性 | ◎ `firebase init` の標準構成そのまま | ○ |
| コスト | 差なし | 差なし |
| デプロイ容易性 | **◎ `firebase deploy` で Hosting (`dist/`) と Functions (`functions/`) が一括デプロイできる** | ○ |
| 情報量 | 最も多い | 多い |

## 決定

すべて **候補 A** を採用する。

1. **認証**: Firebase Authentication の**匿名認証（`signInAnonymously`）**で起動時に自動サインインし、ログイン画面なしで即座に自分の島として使えるようにする。
2. **データモデル**: `users/{uid}` ドキュメントに島の状態・設定を持たせ、配下に `items`・`bundles`・`proposals` サブコレクションを置く。
3. **画像・ステッカー保存**: アップロードした元画像は Cloud Storage (`users/{uid}/items/{itemId}`) に保存し、`window.Island.makeSticker` で生成した軽量ステッカー DataURL を `items` ドキュメントに保持して 3D シーンへ即座に反映する。
4. **AI パイプライン（Genkit + Gemini）**:
   - `analyzeItem`（F2 読み取り + F3 意図候補生成）: 画像・URL・テキストを受け取り、`title` / `kind` / `source` / `note` / `intents`（3 候補）を Zod 構造化出力で返す。外部ページの本文や画像内文字は `<untrusted_content>` タグで隔離しプロンプトインジェクションを防ぐ。
   - `confirmItemIntent`（F3 確定）: 確定した意図の 1 文に対して Gemini Embedding (`text-embedding-004`) を計算し保存する。
   - `nightOrganize`（F5 夜の整理）: 定時実行（`onSchedule`）および画面からのオンデマンド呼び出しの両方に対応。確定済みアイテムの Embedding コサイン類似度でクラスタリングし、Gemini で束の代表意図・要点 3 つ・関連ツールを生成する。
   - `morningPropose`（F6 朝の 1 提案）: 定時実行（`onSchedule`）および画面からのオンデマンド呼び出しの両方に対応。提案可能な束（保存 2 件以上・意図確定済み）から 15 分以内の最初の一歩を生成する。
5. **フロントエンド実装**: `island-app/` の全 9 画面（S1〜S9）を Vite + React + TypeScript コンポーネントに移植し、S3 保存シートに入力ステップ（画像アップロード・URL 入力・テキストメモ入力）を追加する。また Firebase 未設定環境やオフライン時でも同じデータ構造で動作するローカルフォールバック層を備える。

## 根拠

- 本人のみアクセス可とする非機能要件（[`requirements.md`](../requirements.md)）を Firestore / Storage のパスベース Security Rules で最小かつ確実に担保できる。
- 3D の島（`vendor/island.js`）に手を加えず、CORS トラブルを避けて切り抜きステッカーを安定描画できる。
- 定時ジョブ（`onSchedule`）に加えてオンデマンド呼び出しを用意することで、日常利用でも審査員の動作確認でも待ち時間ゼロで Gemini の束ね・提案パイプラインを体験できる。

## 却下した案と理由

- **ルート直下コレクション（1-B）** — 複合インデックスの作成漏れ・ビルド待ちがハッカソン終盤のデプロイ阻害要因になるため却下。
- **Firestore Vector Search インデックス必須化（3-B）** — インデックス構築の待ち時間と CLI 設定コストに対し、ユーザーあたりの未整理アイテム数（数件〜数十件）では関数内コサイン類似度で十分な精度・速度が出るため MVP では見送り。
