---
description: レビュー待ちPRを確認したうえで、イシューを worktree で実装し、self-review のうえ commit と PR を作成する
argument-hint: "[イシュー番号]"
---

# タスク開始（対話版）

引数: `$ARGUMENTS`（イシュー番号。省略可）

不在時の一括実行は `/sleep`。こちらは**人が横にいる前提**で、着手するイシューと投稿内容を確認しながら進める。
共通規則は `.claude/shared/rules.md`、検証は `bash scripts/check.sh`。

## 0. main の最新化

メインの作業ディレクトリで main を最新にする。コマンド定義（`.claude/`）も main に含まれるため、これで常に最新の手順で動く。

- `git status --porcelain` と `git branch --show-current` を確認する
- main かつ未コミットの変更がなければ `git pull --ff-only origin main`
- それ以外は `git checkout` / `git switch` をせず `git fetch origin` だけ行い、その旨を伝える（worktree は `origin/main` を起点にするので作業自体は進められる）
- `--ff-only` が失敗した場合も merge / reset はしない
- pull で `.claude/` の内容が変わった場合は、このコマンドの定義を読み直してから続ける

## 1. レビュー待ちPRの確認

**自分の実装より先に、チームのPRを止めていないかを見る。**

```bash
ME=$(gh api user --jq .login)
gh pr list --state open --limit 200 \
  --json number,title,author,headRefName,isDraft,updatedAt,reviews \
| jq --arg me "$ME" '[.[]
    | select(.author.login != $me and (.isDraft | not))
    | {number, title, author: .author.login, updatedAt,
       myReviewAt: ([.reviews[] | select(.author.login == $me) | .submittedAt] | max)}]'
```

- `myReviewAt` が null → **レビュー対象**。`/review <番号>` を提案する
- `myReviewAt` があり `updatedAt` がそれより新しい → **マージ確認の対象**。自分の指摘が対応されたかを `.claude/sleep/merge-check.md` の手順で確認し、結果を示したうえでマージを提案する
- 自分がレビュー済みでその後の更新がないもの → 対象外
- 該当PRがあれば、番号・タイトル・作成者・更新日時・種類を表で示し、**先に処理するか、後回しにしてタスクに進むかを尋ねて待つ**
- 該当がなければ何も言わずに手順2へ進む

ユーザーの許可なしに、レビューの投稿もマージもしない。

## 2. 対象イシューの特定

```bash
gh issue list --state open --assignee @me --limit 200 --json number,title,labels,body,updatedAt
```

- 自分が担当のイシューが0件なら、担当者のいないイシューを候補にしてよいか尋ねる（他の人の担当分は候補にしない）
- **依存関係**: 各イシュー本文の `前提: #34、#38` の行から前提を抜き出す（`親イシュー:` は依存ではない）。前提のオープン判定は1回でまとめて行う
  ```bash
  gh issue list --state open --limit 200 --json number,assignees
  ```
  - **着手可能**: 前提がすべてクローズ済み
  - **自分の前提待ち**: オープンな前提がすべて自分の担当
  - **他の人待ち**: オープンな前提に、他の人が担当または担当者なしのものがある

引数が空、または指定番号が候補にない場合:

- 候補が1件 → それを選ぶ（「他の人待ち」ならその旨を伝えて続行してよいか確認する）
- 2件以上 → 番号・タイトル・ラベル・更新日時・状態・オープンな前提を表で示す。「他の人待ち」には待っている前提と担当者（`@login` / 未担当）を明記する
  - 表の後に、**いま一番やるべきタスクを1つ提案**し、理由を添える。選び方は次の順
    1. 「着手可能」なものから選ぶ（「他の人待ち」は選ばない）
    2. 他のイシューの前提になっている数が多いもの（終えると他の人の作業が解放される）
    3. 同程度なら `priority::high` > `medium` > `low`
    4. それでも並ぶなら番号が小さいもの
  - 着手可能なものがなければ、「自分の前提待ち」のうち先に片付けるべき前提イシューを提案する。それもなければ、全部が他の人待ちである旨と相手を伝える
  - 提案を示したうえで、**番号を尋ねて待つ**
- 0件 → その旨を伝えて終了

引数で番号が明示された場合は、担当者に関係なくそのイシューを対象とする（他の人の担当、または前提が他の人待ちなら、その旨を伝えて続行してよいか確認する）。

`gh issue view <番号>` で受け入れ条件を把握する。実装に影響する不明点はユーザーに尋ねる。

### モード判定

```bash
gh pr list --state open --limit 200 --json number,headRefName,closingIssuesReferences
```

- 対象イシューに紐づくPRがあり、レビュー（Gemini Code Assist を含む）が投稿されている → **レビュー対応モード**（手順4の代わりに 4' を行い、手順6は push のみ）
- PRはあるがレビューがない → 通常モード（PRが既にある旨を伝え、続行してよいか確認する）
- PRがない → 通常モード

## 3. worktree の作成

進行中の作業を壊さないため、**現在の作業ディレクトリでは `git switch` / `git checkout` をしない**。

通常モード:

```bash
git fetch origin
git worktree add -b <prefix>/<イシュー番号>-<説明> ../hannari-<イシュー番号> origin/main
```

- `prefix` は `feat` / `fix` / `docs` / `refactor`
- `<説明>` は英小文字とハイフンの短い説明（例: `feat/18-add-bookmark-api`）

レビュー対応モード: 新規ブランチは作らず、PRの head ブランチを使う。

```bash
git fetch origin <headRefName>
git worktree add ../hannari-<イシュー番号> -b <headRefName> origin/<headRefName>
```

同名の worktree・ブランチが既にある場合は、内容を確認してから再利用するか尋ねる。
以降の編集・コマンド実行はすべて worktree 内で行う。対象に `status::wip` を付ける。

## 4. 実装（通常モード）

- 受け入れ条件を満たすよう実装する。`AGENTS.md` の実装規約に従う
- できる限り、受け入れ条件をテストにして `scripts/check.sh` に含める
- `.env` は作らない・触らない。環境変数を足したら `.env.example` にキー名だけ追記する
- **技術選定が必要になったら実装を止める**。`.claude/shared/rules.md` の「技術選定が必要になったとき」に従い、候補と pro/con を出してユーザーの判断を待つ
- 実装中に決めたこと（ADR にない設計判断、複数案から選んだこと）は、手順7で記録する

## 4'. レビュー指摘の修正（レビュー対応モード）

- 未対応の指摘を、ファイル・行・内容で一覧にする（レビュー本文・行コメント・通常コメント、Gemini Code Assist の指摘を含む）
  ```bash
  gh pr view <PR番号> --json reviews,comments
  gh api repos/{owner}/{repo}/pulls/<PR番号>/comments
  ```
- 各指摘を worktree 内で修正する。指摘が誤りだと判断できる場合や方針が複数ありうる場合は、勝手に無視せず、理由とともにユーザーに伝える
- PRがコンフリクトしている場合は、先に `git merge origin/main` で解消する（両方の意図を残す。両立しない場合は解消せず相談する）

## 5. self-review

実装後、差分とコードを自分で読み直す。

```bash
git diff origin/main...HEAD   # 未コミット分も含めて確認する
bash scripts/check.sh
```

観点:

1. **要件充足**: イシューの受け入れ条件を満たしているか
2. **正確性**: バグ、考慮漏れ、エラー処理の抜け
3. **簡潔さ**: 冗長なコード、不要な抽象化、無駄なコメント
4. **セキュリティ・課金**: 機密情報の混入、外部入力の未検証利用、ループ内のAPI呼び出し
5. **テスト**: 必要なテストがあるか、check に入っているか
6. **決定の記録**: 実装中に決めたことが書かれているか

- 推測で指摘しない。コードで確認できた問題に絞る
- 指摘があれば、**ユーザーに確認せず同じブランチで自分で直す**。直したら check を再実行し、もう一度レビューする
- 指摘がなくなるまで繰り返す（目安: 最大3回。それでも残る場合は最終報告に明記する）

## 6. commit と PR

**通常モード**

- 意味のある単位で commit する（メッセージは既存の履歴の形式に揃える。日本語でよい）
- `git push -u origin <ブランチ名>`
- `gh pr create` で PR を作る
  - 本文は `.github/pull_request_template.md` に沿う。`Closes #<イシュー番号>` を含める
  - self-review で直した点、check の結果、決めたことを書く
  - ベースは `main`
- イシューの `status::wip` を外す

**レビュー対応モード**

- 修正を commit して既存PRのブランチへ push する（PRは新規作成しない）
- 対応報告の文面を作る
  - 指摘を投稿したレビュアー（自分と bot を除く）を `@<ログイン名>` でメンションする
  - 指摘ごとの対応内容（commit のハッシュを添える）、対応しなかった指摘とその理由、再レビューのお願い
- **投稿前に文面とメンション先をユーザーに提示し、許可を得る。** 許可なしに投稿しない
  ```bash
  gh pr comment <PR番号> --body "<本文>"
  ```
- `status::wip` を外す

自分が作成したPRは自分でマージしない。レビューを待つ。

## 7. 決定事項の記録

実装中に決めたことのうち、**他の実装を縛る / 後から変えにくい**ものは `docs/decisions/` に ADR として残す（テンプレート: `000-template.md`）。実装と同じ PR に含める。

それ以外の小さな判断は、PR本文の「背景・理由」に書けば足りる。ADR を新規に起こすかどうか迷う場合は、ユーザーに確認する。

## 8. 完了報告と後片付け

報告すること: PRのURL、実装の要約、記録した決定事項、self-review で直した点、未解決事項。

後片付けは一覧を示し、**許可を得てから**削除する。未コミット・未push の変更がある場合は先に警告する。

- worktree（`git worktree remove ../hannari-<イシュー番号>`）
- 起動した捨てコンテナ・エミュレータ
- その他の一時ファイル
