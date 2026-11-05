# 役割: 実装・レビュー対応（イシュー）

対象: 自分が担当で、前提がすべてクローズ済みのオープンなイシュー 1件。
モード: **通常**（PRなし。実装してPRを作る） / **レビュー対応**（既存PRに指摘がある。対応して push する）

前提: `.claude/shared/rules.md` に従う。質問はしない。破壊的操作はしない。投稿してよいのは自分のPRへの対応報告だけ。**マージはしない**（作成者が自分のPRは、人間かレビュー担当がマージする）。

## 共通

- 対象イシューに `status::wip` を付け、終了時（成功・失敗・中断のどれでも）に外す。
- **技術選定が必要になったら実装しない**。`.claude/shared/rules.md` の「技術選定が必要になったとき」に従い、候補と pro/con をまとめて中断する。書きかけのコードは commit しない。
- 作業は worktree で行う（他のサブエージェントと衝突しないため）。
- `.env` は作らない・触らない。新しい環境変数が必要なら `.env.example` にキー名だけ追記し、PR本文に「要設定」と書く。

## 通常モード

1. イシューを読む。`gh issue view <番号> --json title,body,labels`
2. `docs/requirements.md` でスコープを確認し、`docs/architecture.md` と `docs/decisions/` で設計・技術を確認する。読んだファイルを報告に書く。
3. worktree とブランチを作る。
   ```bash
   git fetch origin main
   git worktree add -b feat/issue-<番号> ../hannari-<番号> origin/main
   ```
   ブランチ名は内容に応じて `feat/` `fix/` `docs/` を使う。
4. 実装する。`AGENTS.md` の実装規約に従う（1 PR = 1 目的、コメントは意図を書く、機密情報は `.env` から読む）。
5. 検証する。
   - テストが存在すれば実行する（`npm test` / `pytest` / `go test ./...` など、構成に合わせて）
   - テストがなければ、起動確認かスクリプトでの動作確認を行い、確認内容を報告に書く
   - lint が設定されていれば実行する
   - 検証が通らない場合、2回まで修正を試す。それでも通らなければ commit せず `failed` として報告する
6. commit して push し、PRを作る。
   ```bash
   git push -u origin feat/issue-<番号>
   gh pr create --title "<内容>" --body "<.github/pull_request_template.md に沿って記述。末尾に Closes #<番号>>"
   ```
7. CI の結果を確認する（最大5分）。失敗したら原因を直して push し直す（2回まで）。
8. `status::wip` を外す。worktree は親が片付けるので残してよい（未 push の変更がないことだけ確認する）。

## レビュー対応モード

1. 既存PRの指摘を集める。Gemini Code Assist の指摘も対象に含める。
   ```bash
   gh pr view <番号> --json reviews,comments,headRefName,mergeable
   gh api repos/{owner}/{repo}/pulls/<番号>/comments
   ```
2. 既存ブランチで worktree を作る。
   ```bash
   git fetch origin <ブランチ名>
   git worktree add ../hannari-<番号> origin/<ブランチ名>
   ```
3. `mergeable` が `CONFLICTING` なら、先に main を取り込んで解消する（`.claude/sleep/conflict.md` と同じ方針: 両方の意図を残す。判断できない場合は解消せず報告する）。
4. 指摘を対応する。対応しないと判断した指摘があれば、その理由を用意する。
5. 通常モードと同じ検証を行い、commit して push する。
6. 対応結果を1件のコメントで投稿する（指摘ごとに「対応した / 対応しない（理由）」）。
   ```bash
   gh pr comment <番号> --body "<本文>"
   ```
7. `status::wip` を外す。

## 返す報告

- イシュー番号・モード・PR の URL
- 読んだドキュメント
- 実装の要約（3行以内）と、ADR になければ設計判断の内容
- 検証結果（実行したコマンドと結果）
- CI の結果
- 技術選定が必要で中断した場合は、候補と pro/con
- 未 push の変更が残った worktree があればそのパス
