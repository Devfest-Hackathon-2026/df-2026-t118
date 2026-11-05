# チーム開発ルール（AI エージェント共通）

Claude Code / Gemini CLI / Codex など、このリポジトリで動くすべての AI エージェントが従うルール。
`CLAUDE.md` と `GEMINI.md` はこのファイルを参照している。ルールの変更はこのファイルのみで行う。

## プロジェクト

- Google ハッカソン参加作品
- プロダクト: ブックマークを構造化し、次にとるべきアクションを提案・支援する自律エージェント
- 要件: 未確定 → `docs/requirements.md`
- 技術スタック: 未確定 → `docs/decisions/001-tech-stack.md`

## 技術選定の方針

1. Google の製品・言語を優先する（Gemini API, Vertex AI, Firebase, Cloud Run, ADK, Genkit, Flutter, Go, Angular など）
2. 実装速度と期間内の完成可能性を同等に重視する
3. Google 以外を採用する場合は、Google の候補と並べて比較し、選ぶ理由を示す
4. アイドル時も課金される常時起動型サービス（Cloud SQL, Compute Engine, GKE など）は原則提案しない。必要な場合は課金リスクを明記する

## 技術的判断の手順

ライブラリ・フレームワーク・設計・データモデル・外部サービスを決める場面では、実装前に次を提示する。

1. 候補を 2〜3 個
2. pro/con 表。観点は 学習コスト / 実装速度 / Google 製品との相性 / コスト / デプロイ容易性 / 情報量
3. 推奨案とその根拠
4. 料金・サービス名・提供状況など確証のない情報は「要確認」と明記するか、公式ドキュメントで確認する
5. 決定後、`docs/decisions/` に ADR を追加する（テンプレート: `000-template.md`）

**人間が決定するまで実装を始めない。**

## 参照ドキュメント

| 作業 | 参照先 |
|---|---|
| 機能実装・スコープ判断 | `docs/requirements.md` |
| 構成・設計に関わる変更 | `docs/architecture.md` |
| 技術・依存の追加変更 | `docs/decisions/` の既存 ADR、`docs/tech-selection.md` |
| イシュー・PR・レビューの運用 | `docs/workflow.md`、`.claude/shared/rules.md` |

作業前に、参照したドキュメントを明示する。

## 実装規約

- 変更は小さく保つ。1 PR = 1 目的
- コメントは意図（なぜ）を書く。処理内容はコードで示す
- 機密情報はコードに書かず `.env` から読む。環境変数を追加したらキー名のみ `.env.example` に追記する
- 依存を追加する場合は理由を示す
- `docs/architecture.md` と矛盾する変更は、着手前に指摘する
- 変更後、何を・なぜ変えたかを簡潔に説明する

## Git

- `main` への直接 push と force push は禁止
- ブランチ名: `feat/*` / `fix/*` / `docs/*`
- PR は `.github/pull_request_template.md` に従う
- コミットメッセージは日本語でよい
