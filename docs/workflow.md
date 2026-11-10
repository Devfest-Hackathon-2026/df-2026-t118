# 開発フロー

初めての人は先に [onboarding.md](onboarding.md) を読む。このファイルは運用の詳細を定める。
この運用を**なぜそうしたか**と、トークン制限の中での工夫は [ai-driven-development.md](ai-driven-development.md) にまとめてある。

## イシュー

タスクは GitHub Issues で管理する。AI エージェントが自動で着手できるようにするため、次を守る。

- **担当者を必ず設定する**（Assignees）。担当者のないイシューは自動実装の対象にならない
- 依存があれば本文に `前提: #12、#15` の行を1行で書く。この行は自動化が読む
- 親子関係を示すだけの場合は `親イシュー: #3` と書く（依存とは扱われない）
- 受け入れ条件を箇条書きで書く（何ができたら閉じられるか）
- 優先度は `priority::high` / `medium` / `low` のラベルで示す（任意。次にやるタスクの判断に使う）

着手は `/task`（定義: `.claude/commands/task.md`）。着手可能なイシューを前提から判定し、**次にやるべき1つを理由つきで提案**してから実装に入る。選び方は「着手可能 → 他のイシューの前提になっている数 → `priority::` → 番号順」。

## ブランチと PR

- `main` への直接 push と force push は禁止
- ブランチ名は `<prefix>/<イシュー番号>-<説明>`（例: `feat/18-add-bookmark-api`）。`prefix` は `feat` / `fix` / `docs` / `refactor`
- commit 前に **self-review**（`.claude/shared/rules.md`）を通す。見つけた問題は自分で直してから出す
- PR 本文は `.github/pull_request_template.md` に沿う。イシューを閉じる場合は `Closes #<番号>` を書く
- 自分が作成した PR は自分でマージしない（コンフリクト解消後を除く）
- マージは squash

## レビュー

- PR には CI（`check`）と Gemini Code Assist のレビューが走る
- 人間のレビューは「レビュー観点」（`.claude/shared/rules.md`）の順で見る。スタイルの好みは指摘しない
- 手元でAIにレビューさせる場合は `/review`（定義: `.claude/commands/review.md`）。イシューと照らし、指摘を提示してから、**許可を得て**投稿する。指摘が0件ならそのままマージする
- 差分だけ見てほしいときは `@reviewer`（定義: `.claude/agents/reviewer.md`）。投稿はせず指摘を返すだけ
- `main` は private + GitHub Free のためブランチ保護が効かない。マージ条件は GitHub ではなく各自が確認する

## 検証：1コマンドの門

人もAIもCIも、同じ `bash scripts/check.sh` を通す。

```bash
bash scripts/check.sh
```

- 中身は「機密情報がコミットされていないか」＋ 検出したスタックの lint・型・ビルド・テスト
- チェックを増やすときは `scripts/check.sh` を編集する。CI 側は編集しない（CI はツールチェーンを用意して check を呼ぶだけ）
- **完了の定義は「check がすべて通ること」**。タスク固有の条件も、できる限りテストにして check に入れる
- push 前に自動で通したい場合は git hook を有効化する（Codespaces / Dev Containers では自動で有効）

```bash
git config core.hooksPath .githooks
```

門は3段階に置いてある。内側ほど速く、外側ほど確実に止まる。

| 層 | 仕組み | 強制力 |
| --- | --- | --- |
| エージェント | `.claude/settings.json` の deny / ask | 迂回できるが即座 |
| リポジトリ | `.githooks/pre-push` → check | `--no-verify` で抜けられる |
| リモート | CI（`check`） | 抜けられない |

## エージェントのガードレール

`.claude/settings.json`（コミット済み。clone すれば全員に効く）で、危険な操作を機械的に止めている。

- deny（実行できない）: `rm -rf`、`git push --force`、`.env` の読み取り
- ask（人間の承認が必要）: ブランチ削除、`git reset --hard`、クラウドリソースの削除

Bash のパターン一致は万能ではないため、これは最後の砦ではなく事故防止です。ルール本体は `AGENTS.md` にあります。

## 状態ラベル

| ラベル | 意味 |
| --- | --- |
| `status::wip` | イシューの実装中、またはPRのレビュー対応中 |
| `status::reviewing` | PRのレビュー中、またはマージ確認中 |

作業開始時に付け、終了時に必ず外す。1時間以上更新がないラベルは残骸として扱う。

## AI エージェントによる自動実行

`/sleep`（定義: `.claude/commands/sleep.md`）で、確認なしの一括実行ができる。不在時に回す用途。

実行内容:

- メンバーのレビュー待ち PR のレビュー（指摘がなければマージ）
- 自分がレビュー済みの PR の指摘対応確認とマージ
- 自分の PR のコンフリクト解消
- 着手可能な自分担当イシューの実装と PR 作成

守るルール:

- 技術選定が必要になった時点で実装を止め、候補と pro/con を報告する（`AGENTS.md` の「人間が決定するまで実装を始めない」が優先）
- マージ条件（CI 成功・コンフリクトなし・指摘対応済み・機密情報なし）を満たさない PR はマージしない
- force push、ブランチ削除、イシューのクローズ・編集はしない
- 自分が作成した PR は自動マージしない（コンフリクト解消後を除く）
