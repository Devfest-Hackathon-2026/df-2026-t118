# 技術選定

`docs/requirements.md` の MVP とエージェントの自律レベルが固まった後に実施する。
決定内容は `docs/decisions/001-tech-stack.md` に記録し、確定後に `.devcontainer/` と `.github/workflows/ci.yml` を構成へ合わせて更新する。

## 候補（Google 製品を起点）

> サービス名・提供状況・料金は変動するため、採用前に公式ドキュメントで確認する。

| 分野 | 候補 | 備考 |
|---|---|---|
| モデル | Gemini API（Google AI Studio / Vertex AI） | ハッカソンのクレジットは Vertex AI 側で消費 |
| エージェント基盤 | Agent Development Kit (ADK) | Python / Java |
| AI アプリ基盤 | Genkit | TypeScript / Go |
| クライアント直接呼び出し | Firebase AI Logic | バックエンド不要 |
| フロントエンド | Flutter / Angular / Next.js | Flutter はモバイルも対象にできる |
| バックエンド | Cloud Run / Cloud Functions for Firebase | いずれも従量課金 |
| データ・認証 | Firestore / Firebase Authentication | |
| 配信 | Firebase Hosting / App Hosting / Cloud Run | |

## 主要な論点

- **エージェントの実装基盤**: ADK / Genkit / Gemini API の直接呼び出し
- **URL コンテンツの取得方法**: サーバーサイドでの取得か、モデル側の機能利用か
- **言語の統一**: フロントとバックで言語が分かれた場合の分担・レビューコスト
