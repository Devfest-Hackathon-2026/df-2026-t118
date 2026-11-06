# hannari-hustlers

保存したインスピレーションを 3D の島に浮かべ、PARA で整理して、1 日 1 つだけ小さな実行を提案するアプリ。Google ハッカソン参加作品。

> **初めての人は [docs/onboarding.md](docs/onboarding.md) から読んでください。** 環境の用意から1日の流れまで、これ1枚で始められます。

カテゴリ: クリエイティブ / 提出締切: **2026-11-10（火）19:00**

- 提出物と残りスケジュール: [docs/submission.md](docs/submission.md)
- 要件: [docs/requirements.md](docs/requirements.md)
- アーキテクチャ: [docs/architecture.md](docs/architecture.md)
- 技術選定: [docs/tech-selection.md](docs/tech-selection.md) / [docs/decisions/](docs/decisions)

技術スタックは [ADR-002](docs/decisions/002-web-stack.md) で確定。Web (PWA) + three.js を Firebase Hosting に配信 / Cloud Functions for Firebase + Genkit / Firestore / Gemini。言語は TypeScript に統一。

## セットアップ

Codespaces（推奨）: **Code → Codespaces → Create codespace on main**

ローカル: clone して VS Code の Dev Containers 拡張で開く。

```bash
git clone https://github.com/Kambara-Michiru/hannari-hustlers.git
cd hannari-hustlers
cp .env.example .env            # 値はチームのチャットで共有
git config core.hooksPath .githooks   # push 前に check を通す（Codespaces では自動）
```

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
| `AGENTS.md` | AI エージェント共通ルール（`CLAUDE.md` / `GEMINI.md` から参照） |
| `scripts/check.sh` | 検証の門（機密情報・lint・型・ビルド・テスト） |
| `docs/onboarding.md` | メンバーが最初に読む導入 |
| `docs/workflow.md` | イシュー・PR・レビュー・自動実行の運用 |
| `docs/submission.md` | 提出物・締切・審査対象外になる条件・最終チェックリスト |
| `docs/product-doc.md` | プロダクト説明ドキュメント（提出物）の下書き |
| `docs/assets.md` | 著作物利用シート（提出物）のための外部素材台帳 |
| `docs/references/` | 主催者配布資料 |
| `docs/requirements.md` | 要件定義 |
| `docs/architecture.md` | 構成図・処理フロー・担当 |
| `docs/tech-selection.md` | 技術選定の候補と論点 |
| `docs/decisions/` | ADR（技術判断の記録） |
| `.devcontainer/` | 開発環境定義（Codespaces / Dev Containers 共通） |
| `.github/workflows/ci.yml` | CI |
| `.gemini/` | Gemini Code Assist のレビュー設定 |
| `.githooks/pre-push` | push 前に check を通す git hook |
| `.claude/settings.json` | エージェントのガードレール（deny / ask） |
| `.claude/agents/reviewer.md` | レビュー専門サブエージェント（`@reviewer`） |
| `.claude/commands/task.md` | `/task`（対話版のイシュー実装）の定義 |
| `.claude/commands/review.md` | `/review`（対話版のPRレビュー）の定義 |
| `.claude/commands/sleep.md` | `/sleep`（不在時の一括実行）の定義 |
| `.claude/sleep/` | `/sleep` の役割別手順 |
| `.claude/shared/rules.md` | マージ条件・レビュー観点・状態ラベル |

## 初期設定（リーダー）

### GitHub

- [x] リポジトリ作成と初期コミットの push
- [x] 状態ラベル（`status::wip` / `status::reviewing`）の作成
- [ ] メンバーを Collaborator に招待（Settings → Collaborators）
- [ ] [Gemini Code Assist](https://github.com/apps/gemini-code-assist) をインストールし、本リポジトリを選択
- [ ] ブランチ保護（Settings → Rules → Rulesets）
  - private + GitHub Free では利用不可。Public 化または Pro 契約まではルールで強制せず運用で担保する
  - 有効化時の設定: 対象 `main` / Enforcement `Active` / Restrict deletions / Block force pushes / Require a pull request before merging（承認数 0） / Require status checks to pass → `check`

### Google Cloud

- [ ] ハッカソン専用プロジェクトを作成し、クレジット付きの請求先アカウントに紐づける
- [ ] クレジットの有効期限と対象サービスを確認
- [ ] 予算アラートを設定（通知のみ。課金は自動停止しない）
- [ ] IAM でメンバーを追加（オーナーはリーダーのみ、他は編集者）
- [ ] API キーに使用可能 API の制限をかける
- [ ] ハッカソン終了後にプロジェクトを削除またはシャットダウン

### 技術選定

- [x] `docs/requirements.md` の MVP とエージェントの自律レベルを確定
- [x] `docs/tech-selection.md` の論点を比較し、`docs/decisions/001-tech-stack.md` に記録
- [ ] 確定した構成に合わせて `.devcontainer/` と `.github/workflows/ci.yml` を更新
- [ ] Hello World をデプロイまで通す
