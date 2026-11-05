# はじめに読む（メンバー向け）

このリポジトリは、AI エージェント（Claude Code / Gemini CLI）が人と同じ手順で作業することを前提に組んである。
最初に読むのはこのファイルだけでよい。細かい規則は、必要になった時点でリンク先を見れば足りる。

## 1. 何を作るか

ブックマークを構造化し、次にとるべきアクションの提案・準備までを行う自律エージェント。Google ハッカソン参加作品。

要件と技術スタックは**まだ確定していない**。[docs/requirements.md](requirements.md) を埋めるところから始まる。

## 2. 環境を用意する（最初の10分）

**Codespaces（推奨）**: リポジトリの **Code → Codespaces → Create codespace on main**。ブラウザだけで、全員同じ環境が立ち上がる。インストール作業は不要。

**ローカル**: clone して VS Code の Dev Containers 拡張で開く。

```bash
git clone https://github.com/Kambara-Michiru/hannari-hustlers.git
cd hannari-hustlers
cp .env.example .env                  # 値はチームのチャットで共有
git config core.hooksPath .githooks   # Codespaces では自動で設定済み
```

`.env` は**絶対にコミットしない**。`.gitignore` と CI の両方で止まるようにしてあるが、APIキーが一度でも GitHub に入れば再発行が必要になる。

## 3. 1日の流れ

```
イシューを取る → ブランチを切って実装 → self-review → PR → 誰かがレビュー → マージ
```

AI に任せる場合は、担当するコマンドがある。

| やること | コマンド | 確認の有無 |
| --- | --- | --- |
| イシューに着手する | `/task` | あり（着手するイシューと投稿内容を確認） |
| PR をレビューする | `/review` | あり（投稿前に文面を確認） |
| 差分に指摘だけもらう | `@reviewer` | PR には投稿しない |
| 寝ている間に全部回す | `/sleep` | **なし**（レビュー・マージ・実装まで自動） |

`/task` は、着手可能なイシューを依存関係から判定して「次にやるべき1つ」を提案してくれる。迷ったら引数なしで実行する。

手で進める場合はこうなる。

```bash
git switch -c feat/18-add-bookmark-api   # <prefix>/<イシュー番号>-<説明>
# 実装する
bash scripts/check.sh                     # 検証
git push -u origin feat/18-add-bookmark-api
gh pr create                              # または GitHub 上で作成
```

## 4. 守ること（4つだけ）

**1. `main` に直接 push しない。** 必ずブランチを切って PR を出す。force push もしない。
このリポジトリは private + GitHub Free でブランチ保護が使えないため、**GitHub は止めてくれない**。各自が守る。

**2. コミット前に `bash scripts/check.sh` を通す。**
これが唯一の検証の門で、人も AI も CI も同じものを通る。**「check がすべて通ること」が完了の定義**。手元で通れば CI でも通る。

**3. 機密情報はコードに書かない。** `.env` から読む。新しい環境変数を足したら、`.env.example` にキー名だけ書いておく（値は書かない）。

**4. 技術選定は人間が決める。** AI は候補と pro/con を出すところまで。「人間が決定するまで実装を始めない」が全エージェントのルールになっている（[AGENTS.md](../AGENTS.md)）。勝手に決まっていたら指摘してほしい。

## 5. イシューの書き方

`/task` と `/sleep` がイシューを読んで動くため、形式が決まっている。

- **担当者を必ず設定する**（Assignees）。担当者のないイシューは自動実装の対象外
- 依存があれば本文に `前提: #12、#15` の行を1行で書く。この行を自動化が読む
- **受け入れ条件**を箇条書きで書く（何ができたら閉じられるか）
- 優先度は `priority::high` / `medium` / `low` ラベル（任意）

```markdown
前提: #12

## やること
ブックマークのURLを登録できるようにする。

## 受け入れ条件
- [ ] URLを送ると保存される
- [ ] 不正なURLはエラーを返す
```

## 6. ラベル

| ラベル | 意味 |
| --- | --- |
| `status::wip` | 実装中 / レビュー対応中 |
| `status::reviewing` | レビュー中 / マージ確認中 |
| `priority::high` `medium` `low` | 優先度 |

`status::` は作業を始めるときに付け、終わったら必ず外す。付けっぱなしだと他の人が触れなくなる。

## 7. 安全装置

危険な操作は、気をつけるのではなく**設定で止めてある**（`.claude/settings.json`）。

- 実行できない: `rm -rf`、`git push --force`、`.env` の読み取り
- 人間の承認が必要: ブランチ削除、`git reset --hard`、クラウドリソースの削除

AI がこれらを拒否したら、設定どおりの動作。迂回させずに、本当に必要かを考えてほしい。

## 8. つまずいたら

| 症状 | 原因 |
| --- | --- |
| push しようとしたら check が走って止まった | `.githooks/pre-push` が動作中。エラーを直してから push する |
| AI がコマンドを拒否する | 上の安全装置。`.claude/settings.json` を見る |
| CI が赤い | 手元で `bash scripts/check.sh` を実行すれば同じエラーが出る |
| `.env` が無いと言われる | `cp .env.example .env` して、チャットで共有された値を入れる |

## 9. もっと知りたいとき

| 知りたいこと | ファイル |
| --- | --- |
| 開発フローの詳細（イシュー・PR・レビュー・自動実行） | [docs/workflow.md](workflow.md) |
| AI エージェント共通のルール | [AGENTS.md](../AGENTS.md) |
| 何を作るか（要件） | [docs/requirements.md](requirements.md) |
| 構成・設計 | [docs/architecture.md](architecture.md) |
| 技術選定の候補と論点 | [docs/tech-selection.md](tech-selection.md) |
| なぜその技術にしたか（ADR） | [docs/decisions/](decisions) |
| マージ条件・レビュー観点・self-review | [.claude/shared/rules.md](../.claude/shared/rules.md) |

分からないことは、遠慮なくチャットで聞いてほしい。ルールのほうがおかしいと思ったら、それも言ってほしい（ルールは PR で変えられる）。
