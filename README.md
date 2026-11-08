# hannari-hustlers

保存したインスピレーションを 3D の島に浮かべ、PARA で整理して、1 日 1 つだけ小さな実行を提案するアプリ。Google ハッカソン参加作品。

> **初めての人は [docs/onboarding.md](docs/onboarding.md) から読んでください。** 環境の用意から1日の流れまで、これ1枚で始められます。

カテゴリ: クリエイティブ / 提出締切: **2026-11-10（火）19:00**

- 提出物と残りスケジュール: [docs/submission.md](docs/submission.md)
- 要件: [docs/requirements.md](docs/requirements.md)
- アーキテクチャ: [docs/architecture.md](docs/architecture.md)
- 画面遷移・ユースケース解説（PC版 / スマホ版スクリーンショット付き）: [docs/ui-and-usecases.md](docs/ui-and-usecases.md)
- 技術選定: [docs/tech-selection.md](docs/tech-selection.md) / [docs/decisions/](docs/decisions)

技術スタックは [ADR-002](docs/decisions/002-web-stack.md) および [ADR-003](docs/decisions/003-backend-and-data-model.md) で確定。Web (PWA) + Vite + React + TypeScript + three.js を Firebase Hosting に配信 / Cloud Functions for Firebase + Genkit / Firestore / Gemini。言語は TypeScript に統一。

## セットアップ

Codespaces（推奨）: **Code → Codespaces → Create codespace on main**

ローカル: clone して VS Code の Dev Containers 拡張で開く。

```bash
git clone https://github.com/Kambara-Michiru/hannari-hustlers.git
cd hannari-hustlers
cp .env.example .env            # 値はチームのチャットで共有
git config core.hooksPath .githooks   # push 前に check を通す（Codespaces では自動）
```

## 開発

```bash
npm install
npm run dev    # http://localhost:5173
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー（Vite + `/api/*` Gemini AI ミドルウェア） |
| `npm run build` | `dist/` を生成 |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm test` | 単体テスト実行（`vitest run`） |
| `bash scripts/check.sh` | 検証の門。コミット前と push 時に通す |

3D の島は [`src/vendor/island.js`](src/vendor/island.js) として組み込まれている。
**three は 0.128.0 で固定。上げると島の色が壊れる**（理由は [ADR-002 の実装メモ](docs/decisions/002-web-stack.md)）。

## デプロイ（Firebase Hosting & Functions）

配信先は Firebase プロジェクト `hannari-hustlers`（`.firebaserc` にコミット済み、Blaze プラン）。

### 初回だけ必要な準備

1. **Web アプリの登録** — Firebase コンソール → プロジェクトの概要 → ＋ アプリを追加 → Web（`</>`）。
   表示された設定値を `.env` の `VITE_FIREBASE_*`（キー名は `.env.example` 参照）に入れる。
   これが未設定だとビルドは通るが、実行時に Firebase へ接続しない。
2. **CLI ログイン** — 課金クレジットが付いた Google アカウントで入る。
   どの請求先アカウントが紐づいているかは、コンソールの 設定 → 使用量と請求 で確認する。
3. **Gemini の API キーを Secret Manager に登録** — Functions は `GEMINI_API_KEY` を
   `defineSecret` で読む。`.env` の値はローカル開発専用で、デプロイ先には渡らない。

```bash
npx firebase-tools login
npx firebase-tools functions:secrets:set GEMINI_API_KEY
```

### デプロイ

```bash
bash scripts/check.sh
npx firebase-tools deploy --only hosting,functions,firestore:rules,storage
```

`npm run build` は `dist/`（Hosting）と `functions/lib/`（Functions）の両方を生成する。
`firebase.json` の rewrites で `/api/*` が `asia-northeast1` の各 Functions に向く。

> 提出要件により、デプロイ URL は **2026-11-14 まで稼働させる**。
> 環境の作り直しや課金停止は事前に確認すること（[AGENTS.md](AGENTS.md)）。

## 開発フロー

詳細は [docs/workflow.md](docs/workflow.md)。

- `main` への直接 push は禁止。`feat/*` / `fix/*` / `docs/*` でブランチを切り、PR を出す
- 検証は `bash scripts/check.sh` の1コマンド。人もAIもCIも同じ門を通る
- PR には CI（`check`）と Gemini Code Assist のレビューが走る
- Claude Code / Gemini CLI などの AI エージェントは [AGENTS.md](AGENTS.md) のルールに従う
- イシューの実装は `/task`、PRレビューは `/review`（どちらも投稿前に確認あり）。不在時の一括実行は `/sleep`（確認なし）

```bash
git switch -c feat/<topic>
git push -u origin feat/<topic>
```

## リポジトリ構成

| パス | 内容 |
|---|---|
| `src/` | フロントエンド実装（Vite + React + TypeScript: `components/`, `hooks/`, `services/`, `constants/`, `types/`, `styles/`, `vendor/`） |
| `functions/` | バックエンド実装（Cloud Functions for Firebase + Genkit + Gemini: `schemas.ts`, `aiCore.ts`, `index.ts`） |
| `public/` | 静的アセット（セルフホストフォント `fonts/`、PWA アイコン `icons/`、`manifest.webmanifest`、`sw.js`） |
| `AGENTS.md` | AI エージェント共通ルール（`CLAUDE.md` / `GEMINI.md` から参照） |
| `scripts/check.sh` | 検証の門（機密情報・lint・型・ビルド・テスト） |
| `docs/onboarding.md` | メンバーが最初に読む導入 |
| `docs/workflow.md` | イシュー・PR・レビュー・自動実行の運用 |
| `docs/submission.md` | 提出物・締切・審査対象外になる条件・最終チェックリスト |
| `docs/product-doc.md` | プロダクト説明ドキュメント（提出物）の下書き |
| `docs/assets.md` | 著作物利用シート（提出物）のための外部素材台帳 |
| `docs/ui-and-usecases.md` | PC版・スマホ版の画面遷移とユースケース解説（スクリーンショット付き） |
| `docs/references/` | 主催者配布資料 |
| `docs/requirements.md` | 要件定義 |
| `docs/architecture.md` | 構成図・ディレクトリ構造・処理フロー |
| `docs/tech-selection.md` | 技術選定の候補と論点 |
| `docs/decisions/` | ADR（技術判断の記録: 001〜003） |
| `.devcontainer/` | 開発環境定義（Codespaces / Dev Containers 共通） |
| `.github/workflows/ci.yml` | CI |
| `.gemini/` | Gemini Code Assist のレビュー設定 |
| `.githooks/pre-push` | push 前に check を通す git hook |
| `.claude/settings.json` | エージェントのガードレール（deny / ask） |
