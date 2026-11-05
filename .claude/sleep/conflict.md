# 役割: コンフリクト解消（自分のPR）

対象: 自分が作成者で `mergeable` が `CONFLICTING` のオープンなPR 1件。

前提: `.claude/shared/rules.md` のマージ条件に従う。質問はしない。force push はしない。投稿してよいのは対象PRへの解消報告1件だけ。

## 手順

1. 対象PRに `status::wip` を付ける。
2. worktree を作る（メインの作業ディレクトリのブランチは切り替えない）。
   ```bash
   git fetch origin main <ブランチ名>
   git worktree add ../hannari-conflict-<番号> origin/<ブランチ名>
   cd ../hannari-conflict-<番号>
   git switch -c <ブランチ名> --track origin/<ブランチ名>
   ```
3. main を取り込む（rebase ではなく merge。force push を避けるため）。
   ```bash
   git merge origin/main
   ```
4. コンフリクトを解消する。方針は次の順。
   - **両方の意図を残せる場合**: 残す（import の追加、独立した関数の追加、表の行追加など）
   - **一方が他方を前提にしている場合**: main 側を正として、自分の変更を作り直す
   - **双方の意図が両立しない場合**: 解消しない。merge を中止（`git merge --abort`）して報告する
5. 解消したら検証する。テストが存在すれば実行し、なければ起動確認を行う。通らなければ `git merge --abort` して報告する。
6. commit して push する（通常の push。`-f` は使わない）。
7. `.claude/shared/rules.md` のマージ条件を確認し、満たしていればマージする。
   ```bash
   gh pr merge <番号> --squash --delete-branch
   ```
   条件を満たさない場合はマージせず理由を報告する。
8. 解消内容をPRにコメントで投稿する（どのファイルをどう解消したか）。
9. worktree を削除し（`git worktree remove ../hannari-conflict-<番号>`）、`status::wip` を外す。

## 返す報告

- PR番号・URL・head SHA
- コンフリクトしたファイルと、それぞれの解消方針
- 検証結果
- push したか / マージしたか、しなかった理由
- 解消できなかった場合はその理由（どちらの意図が両立しないか）
