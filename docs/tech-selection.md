# 技術選定の進め方

技術はAIと一緒に、pro/con を比べて決めます。**要件（docs/requirements.md）がある程度決まってから**やるのがおすすめです。

## 進め方

1. `docs/requirements.md` の「必須（MVP）」と「エージェントのレベル」を決める
2. 下の「AIへの頼み方」をAIに投げて、構成案を2〜3個出してもらう
3. チームで1つ選ぶ（迷ったら「初心者が一番早く動かせるもの」）
4. AIに `docs/decisions/001-tech-stack.md` を埋めてもらう
5. `.devcontainer/` と `.github/workflows/ci.yml` を、選んだ構成に合わせてAIに直してもらう

## Google製品の候補（出発点）

> サービス名や提供状況は変わることがあります。AIには公式ドキュメントで確認させてください。

| 分野 | 候補 | メモ |
|---|---|---|
| AIモデル | Gemini API（Google AI Studio / Vertex AI） | アプリの中核。クレジットはVertex AI側で使える |
| エージェント | Agent Development Kit（ADK） | Google製のエージェント開発フレームワーク（Python / Java など） |
| AIアプリ全般 | Genkit | Google製。TypeScript / Go などでAI機能を組める |
| アプリから直接AI | Firebase AI Logic | サーバーなしでアプリからGeminiを呼べる |
| フロント | Flutter（Dart） / Angular / Next.js（React） | Flutterならスマホアプリも作れる |
| バックエンド | Cloud Run（Python / Go / Node.js） / Cloud Functions for Firebase | どちらも使った分だけ課金 |
| DB・認証 | Firestore / Firebase Authentication | 初心者でも扱いやすい |
| 配信 | Firebase Hosting / App Hosting / Cloud Run | |

このアプリ（ブックマーク → 構造化 → 行動支援エージェント）で特に比較すべき論点：

- **エージェント部分を何で作るか**：ADK / Genkit / Gemini API を直接呼ぶ
- **URLの中身をどう取ってくるか**：サーバー側で取得するか、Geminiの機能を使うか
- **言語をチームで1つに絞れるか**：フロントとバックで言語が分かれると初心者には負担

## AIへの頼み方（コピペ用）

```
AGENTS.md、docs/requirements.md、docs/tech-selection.md を読んで。
このアプリの技術構成を決めたい。

- チーム：〇人（経験：〇〇）
- 期間：〇日
- 使ったことがある言語：〇〇

Google製品を優先して、構成案を2〜3個出して。
それぞれ AGENTS.md の観点で pro/con 表にして、最後におすすめと理由を書いて。
サービス名や料金など不確かな点は「要確認」と書くこと。
```
