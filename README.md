# （アプリ名 未定）

ブックマークを「保存して終わり」から「行動」につなげる、情報構造化＋アクション支援の自律エージェント。

> Googleハッカソン参加作品。要件は [docs/requirements.md](docs/requirements.md)、構成は [docs/architecture.md](docs/architecture.md)。

---

## はじめに（メンバー向け）

リポジトリ： https://github.com/Kambara-Michiru/hannari-hustlers （private）

1. 上のリポジトリを開き、**Code → Codespaces → Create codespace on main** を押す（環境が自動でそろいます。ブラウザだけで始められます）
   - 手元のPCでやる場合は、clone してから VS Code の Dev Containers 拡張で開く
     ```bash
     git clone https://github.com/Kambara-Michiru/hannari-hustlers.git
     cd hannari-hustlers
     ```
2. `.env.example` をコピーして `.env` を作り、チャットで共有された値を入れる
   ```bash
   cp .env.example .env
   ```
3. AIツール（Claude Code / Gemini CLI など）を起動すると、`AGENTS.md` のルールが自動で読まれます
4. 作業はブランチを切って PR で出す
   ```bash
   git switch -c feat/やること
   # 作業してコミット
   git push -u origin feat/やること
   ```
   PR を作ると Gemini が自動でレビューし、CI がチェックします

## ファイルの説明

| ファイル | 何のため |
|---|---|
| `AGENTS.md` | AIツール共通のルール（pro/con を出してから決める、など） |
| `CLAUDE.md` / `GEMINI.md` | 各AIツール用。中身は AGENTS.md を読み込むだけ |
| `docs/requirements.md` | 要件定義（AIと一緒に埋める） |
| `docs/tech-selection.md` | 技術選定の進め方とAIへの頼み方 |
| `docs/decisions/` | 技術選定の記録（ADR）。発表の質疑対策にもなる |
| `docs/architecture.md` | 全体の構成図 |
| `.github/workflows/ci.yml` | PR ごとの自動チェック |
| `.gemini/` | Gemini のPRレビュー設定（日本語・初心者向け） |
| `.devcontainer/` | 全員同じ開発環境にする設定 |

---

## 最初に1人がやる初期設定（リーダー向けチェックリスト）

### GitHub

- [x] このフォルダの中身で新しいリポジトリを作り、最初のコミットを push
  （**.gitignore が入った状態で最初のコミットをすること**）
- [ ] メンバーを招待（Settings → Collaborators → Add people）
- [ ] [Gemini Code Assist](https://github.com/apps/gemini-code-assist) をインストールし、このリポジトリを選択
- [ ] ブランチ保護（Settings → Rules → Rulesets → New branch ruleset）
  - ⚠️ **private + GitHub Free では使えません**（`Upgrade to GitHub Pro or make this repository public`）。
    Public にするか Pro にするまでは、ルールで縛らず「main に直接 push しない」運用で守る
  - 使えるようになったら設定する内容：
  - 対象：`main`（Target branches → Include default branch）
  - Enforcement status：**Active**
  - ✅ Restrict deletions（ブランチ削除禁止）
  - ✅ Block force pushes（強制push禁止）
  - ✅ Require a pull request before merging（承認数は **0** でOK。レビュー待ちで止まらないように）
  - ✅ Require status checks to pass → `check` を追加（CIが一度動いた後に選べるようになります）

### Google Cloud（クレジット）

- [ ] ハッカソン専用のプロジェクトを作成し、クレジットの付いた請求先アカウントに紐づける
- [ ] お支払い → クレジットで、**有効期限と対象サービス**を確認
- [ ] 予算アラートを設定（※通知だけで、課金は自動で止まりません）
- [ ] メンバーを IAM で追加（オーナーはリーダーだけ、他は「編集者」）
- [ ] APIキーを作ったら、使えるAPIを制限しておく
- [ ] **ハッカソン終了後にプロジェクトを削除（またはシャットダウン）する**

### 技術選定

- [ ] `docs/requirements.md` をAIと埋める
- [ ] `docs/tech-selection.md` の手順で技術を決め、`docs/decisions/001-tech-stack.md` を埋める
- [ ] 決まった構成に合わせて、`.devcontainer/` と `ci.yml` をAIに直してもらう
- [ ] Hello World をデプロイまで通す（初日にやると最終日が楽）
