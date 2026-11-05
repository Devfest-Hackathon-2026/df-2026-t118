---
description: PRをイシューと照らしてレビューし、許可を得てレビューコメントを投稿する（指摘がなければマージする）
argument-hint: "[PR番号]"
---

# PR レビュー（対話版）

引数: `$ARGUMENTS`（PR番号。省略可）

不在時の一括実行は `/sleep`。こちらは**人が横にいる前提**で、投稿前に必ず確認を取る。
レビュー観点とマージ条件は `.claude/shared/rules.md` にある。

## 0. main の最新化

メインの作業ディレクトリで main を最新にする。コマンド定義（`.claude/`）も main に含まれるため、これで常に最新の手順で動く。

- `git status --porcelain` と `git branch --show-current` を確認する
- main かつ未コミットの変更がなければ `git pull --ff-only origin main`
- それ以外は `git checkout` / `git switch` をせず `git fetch origin` だけ行い、main を更新できなかった旨を伝える
- `--ff-only` が失敗した場合も merge / reset はせず、その旨を伝える
- pull で `.claude/` の内容が変わった場合は、このコマンドの定義を読み直してから続ける

## 1. 対象PRの特定

```bash
gh pr list --state open --limit 200 --json number,title,author,headRefName,updatedAt
```

- 引数が空、または指定番号のPRがオープンでない場合
  - オープンなPRが1件 → それを選ぶ
  - 2件以上 → 番号・タイトル・作成者・ブランチ・更新日時の表を出し、**どれをレビューするか尋ねて待つ**
  - 0件 → その旨を伝えて終了
- 自分が作成者のPRは、自己レビューになる旨を伝えてから続ける

## 2. 差分の取得

**worktree を作らなくてよい場合**: 差分がドキュメントのみ、または CI（`check`）が成功済みでコードを動かす必要がない場合は `gh pr diff <番号>` だけでよい。

worktree を作る場合は、進行中の作業を壊さないため**現在の作業ディレクトリでは `git switch` / `git checkout` をしない**。

```bash
git fetch origin pull/<番号>/head:pr-<番号>-review
git worktree add ../hannari-pr-<番号> pr-<番号>-review
```

`pull/<番号>/head` を使うのは、fork からのPRでも取得できるため。以降のファイル参照・コマンド実行はこの worktree 内で行う。

対象PRに `status::reviewing` を付ける（ラベルの付け替えは投稿ではないので確認は要らない）。

## 3. イシューと照らす

- `gh pr view <番号>` でPR説明を読み、関連イシュー（`Closes #N` / `Fixes #N` / `#N` / URL）を特定する。`gh issue view <N>` で受け入れ条件を把握する。特定できなければユーザーに尋ねる
- Gemini Code Assist のレビューがあれば読む（重複指摘を避ける）
  ```bash
  gh pr view <番号> --json reviews,comments
  ```
- `.claude/shared/rules.md` の「レビュー観点」の順に、`gh pr diff <番号>` と worktree のコードを見る
- worktree を作った場合は検証も通す
  ```bash
  bash scripts/check.sh
  ```
  起動したもの（捨てコンテナ、エミュレータ）があれば記録しておく

## 4. 指摘の提示（まだ投稿しない）

各指摘を次の形式で出す。

- **ファイルパス:行番号**
- **観点**（要件 / 正確性 / セキュリティ・課金 / テスト / 決定の記録）
- **問題**: 何が問題か
- **修正案**: 具体的な修正内容（必要ならコード例）

指摘がなかった観点も一言添える。最後に総評（approve / comment / request changes のどれが妥当か）を示す。
判断に迷う点は、断定せずユーザーに確認する。

## 5. 投稿（必ず許可を得る）

**ユーザーの明示的な許可なしに、PRへコメント・レビューを投稿してはならない。**

- 投稿する指摘の取捨選択と文面、投稿種別（approve / comment / request changes）を確認する
- 全体コメントのみ
  ```bash
  gh pr review <番号> --comment --body "<本文>"
  ```
- 行コメントを含めて1つのレビューとして投稿する場合
  ```bash
  gh api repos/{owner}/{repo}/pulls/<番号>/reviews --method POST --input - <<'JSON'
  {
    "body": "<総評>",
    "event": "COMMENT",
    "comments": [
      { "path": "src/foo.ts", "line": 42, "side": "RIGHT", "body": "<指摘>" }
    ]
  }
  JSON
  ```
  `line` は差分に含まれる行番号。差分外の行を指定するとエラーになる。

## 6. 指摘がなければマージする

手順 4 で**指摘が1件も残らなかった**場合（ユーザーに確認したい点も含めて0件）、このコマンドの定義がマージの許可になるので、追加の確認なしでマージしてよい。指摘が1件でもある場合、判断に迷う場合は**マージしない**。

`.claude/shared/rules.md` のマージ条件をすべて確認したうえで、

```bash
gh pr merge <番号> --squash --delete-branch
```

マージしなかったときは理由を伝える。

## 7. 後片付け

削除対象の一覧を示し、**許可を得てから**削除する。未コミットの変更がある場合は先に警告する。

- worktree（`git worktree remove ../hannari-pr-<番号>`）とローカルブランチ（`pr-<番号>-review`）
- レビュー中に起動した捨てコンテナ・エミュレータ
- その他の一時ファイル

`status::reviewing` を外す。
