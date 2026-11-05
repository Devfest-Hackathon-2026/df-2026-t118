# 役割: レビュー（メンバーのPR）

対象: 自分がまだレビューしていない、メンバーのオープンなPR 1件。

前提: `.claude/shared/rules.md` のマージ条件とレビュー観点に従う。質問はしない。破壊的操作はしない。投稿してよいのは対象PRへのレビュー1件だけ。

## 手順

1. 対象PRに `status::reviewing` を付ける。
2. PRの情報を取る。
   ```bash
   gh pr view <番号> --json title,body,author,headRefName,headRefOid,files,additions,deletions
   gh pr diff <番号>
   ```
   Gemini Code Assist のレビューがあれば読む（重複指摘を避ける）。
   ```bash
   gh pr view <番号> --json reviews,comments
   ```
3. 差分が大きい、または実際に動かさないと判断できない場合は worktree を作って確認する。小さな差分（ドキュメントのみ、数十行）なら diff だけで判断してよい。
   ```bash
   git fetch origin pull/<番号>/head:pr-<番号>-review
   git worktree add ../hannari-review-<番号> pr-<番号>-review
   ```
   `pull/<番号>/head` を使うのは、fork からのPRでも取得できるため。
   worktree を作ったら検証も通す（`bash scripts/check.sh`）。
   確認が終わったら必ず削除する（`git worktree remove ../hannari-review-<番号>`、ブランチ `pr-<番号>-review` も削除）。
4. レビュー観点の順に見る。要件・ADR との整合は `docs/requirements.md` と `docs/decisions/` を参照して判断する。
5. レビューを投稿する。日本語で、指摘は `.claude/shared/rules.md` の「指摘の書き方」に従う。
   - 指摘がある場合: 行コメント付きで1つのレビューとして投稿する（`rules.md` の投稿例）。`--request-changes` は使わない（作成者が不在のため、ブロックせずコメントで残す）
   - 指摘がない場合: `gh pr review <番号> --approve --body "<総評>"`
6. **指摘がない場合のみ**、`.claude/shared/rules.md` のマージ条件を確認し、満たしていればマージする。
   ```bash
   gh pr merge <番号> --squash --delete-branch
   ```
   条件を満たさない場合はマージせず、理由を報告に書く。
7. `status::reviewing` を外す。worktree が残っていないか確認する。

## 返す報告

- PR番号・URL・作成者・head SHA
- 指摘の要約（箇条書き。なければ「指摘なし」）
- 総評（1〜2行）
- マージしたか / しなかった理由
- 削除できなかった worktree があればそのパス
