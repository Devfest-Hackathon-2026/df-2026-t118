# hannari-hustlers

ブックマークを構造化し、次にとるべきアクションの提案・準備までを行う自律エージェント。Google ハッカソン参加作品。

- 要件: [docs/requirements.md](docs/requirements.md)
- アーキテクチャ: [docs/architecture.md](docs/architecture.md)
- 技術選定: [docs/tech-selection.md](docs/tech-selection.md) / [docs/decisions/](docs/decisions)

## セットアップ

Codespaces（推奨）: **Code → Codespaces → Create codespace on main**

ローカル: clone して VS Code の Dev Containers 拡張で開く。

```bash
git clone https://github.com/Kambara-Michiru/hannari-hustlers.git
cd hannari-hustlers
cp .env.example .env   # 値はチームのチャットで共有
```

## 開発フロー

- `main` への直接 push は禁止。`feat/*` / `fix/*` / `docs/*` でブランチを切り、PR を出す
- PR には CI（`check`）と Gemini Code Assist のレビューが走る
- Claude Code / Gemini CLI などの AI エージェントは [AGENTS.md](AGENTS.md) のルールに従う

```bash
git switch -c feat/<topic>
git push -u origin feat/<topic>
```

## リポジトリ構成

| パス | 内容 |
|---|---|
| `AGENTS.md` | AI エージェント共通ルール（`CLAUDE.md` / `GEMINI.md` から参照） |
| `docs/requirements.md` | 要件定義 |
| `docs/architecture.md` | 構成図・処理フロー・担当 |
| `docs/tech-selection.md` | 技術選定の候補と論点 |
| `docs/decisions/` | ADR（技術判断の記録） |
| `.devcontainer/` | 開発環境定義（Codespaces / Dev Containers 共通） |
| `.github/workflows/ci.yml` | CI |
| `.gemini/` | Gemini Code Assist のレビュー設定 |

## 初期設定（リーダー）

### GitHub

- [x] リポジトリ作成と初期コミットの push
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

- [ ] `docs/requirements.md` の MVP とエージェントの自律レベルを確定
- [ ] `docs/tech-selection.md` の論点を比較し、`docs/decisions/001-tech-stack.md` に記録
- [ ] 確定した構成に合わせて `.devcontainer/` と `.github/workflows/ci.yml` を更新
- [ ] Hello World をデプロイまで通す
