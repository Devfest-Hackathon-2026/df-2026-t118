# 実装状況と、するべきこと

状態: 2026-11-08 時点。**本番（https://hannari-hustlers.web.app）で実際に動かして確認した結果**をもとに書いている。

このファイルの目的は 2 つ。

1. 「ドキュメント・スライドに書いてあること」と「本番で実際に動いていること」のズレを潰す
2. 提出（2026-11-10 19:00）までに何を直すかを、優先度つきで決める

> 提出要件に「デモ動画の偽装 — 未実装の機能を実装済みに見せない」がある（[`submission.md`](submission.md)）。
> **動いていないものを動いていると書くこと自体が、審査対象外のリスク。** だからここを正とする。

---

## 1. サマリ

| 領域 | 状態 | ひとこと |
|---|---|---|
| Firebase Hosting での配信 | ✅ 動いている | 実デプロイ済み・CDN 配信 |
| Firebase Authentication（匿名） | ✅ 動いている | 本番でサインイン成功を確認 |
| Cloud Firestore | ✅ 動いている | 保存 → 再読込で復元まで確認 |
| Cloud Storage | ✅ 設定済み | ルール配信済み |
| Cloud Functions（7 関数） | ✅ デプロイ済み | callable 5 + scheduled 2 |
| Scheduled Functions（夜 23:00 / 朝 8:00 JST） | ✅ デプロイ済み | 冪等・同意チェックまで実装済み |
| **Gemini による生成** | ✅ 動いている | 2026-11-08 にモデルを差し替えて復旧（[PR #25](https://github.com/Kambara-Michiru/hannari-hustlers/pull/25)） |
| **Gemini による埋め込み** | ✅ 動いている | 同上。本番で 768 次元を確認 |
| Genkit | ❌ 使わない（決定済み） | Flow は薄いラッパで何もしていなかった。表記を「Cloud Functions + Gemini API」に統一 |
| Vertex AI | ❌ 使わない（決定済み） | Gemini API（Google AI Studio）のまま。表記を実装に合わせた |
| PWA（オフライン動作） | ❌ 対応しない（決定済み） | 「ホーム画面に追加できる」までを主張とする |
| 能動発見の外部検索 | ⚠️ 固定データ | 実際の外部 API は呼んでいない（コード上も明示） |
| 能動発見の結果の保存 | ✅ 実装済み | `researchJobs` / `researchReports` / `notificationOutbox` にサーバーが書く（2.7） |
| Callable の認証 | ✅ 実装済み | 5 関数すべて `request.auth` 必須。`/api/*` も ID トークンを付けて呼ぶ（2.7） |
| Web Push 通知 | ❌ 未実装 | 「連絡箱」で代替。`notificationOutbox` は送信キューだが送信者はいない（2.7） |

---

## 2. 詳細

### 2.1 ✅ Gemini が本番で動くようになった（2026-11-08 修正済み）

> **以下は修正前の記録。** 何が起きていたかを残す。対応は [PR #25](https://github.com/Kambara-Michiru/hannari-hustlers/pull/25)。

[`geminiClient.ts`](../functions/src/infrastructure/geminiClient.ts) がモデルを 2 つハードコードしている。

```ts
const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
```

本番のシークレット（`GEMINI_API_KEY`）で実際に叩くと、**両方 404** になる。

```
NOT_FOUND: This model models/gemini-2.5-flash is no longer available to new users.
Please update your code to use models/gemini-3.8-flash for the latest features and improvements.
```

`callGeminiJson` は失敗を `continue` と `catch {}` で握りつぶして `null` を返す設計のため、**エラーが一切表に出ないまま、全リクエストがルールベースのフォールバックに落ちている。**

実際に本番で保存したときに返ってきた意図候補は、Gemini の出力ではなく [`aiUseCases.ts`](../functions/src/application/aiUseCases.ts) のテンプレート文字列だった。

```
「{題材}を今度の休日に15分だけ試してみる」        ← aiUseCases.ts:196
「{題材}を日々の暮らしや習慣に少しずつ取り入れる」  ← aiUseCases.ts:197
「{分野}の参考資料として眺める・残しておく」        ← aiUseCases.ts:198
```

**この 1 点が直らないと、画像認識・構造化出力・キャラ別口調・束ねの意味的なまとまりが、すべてコードはあるのに一度も実行されない。**

埋め込みも同じで、`text-embedding-004` が `NOT_FOUND`。[`clustering.ts`](../functions/src/domain/clustering.ts) のコサイン類似度は、Gemini の埋め込みではなく決定論的フォールバックベクトルの上で動いている。

**動くことを確認済みの代替**（本番キーで検証した）:

| 用途 | 差し替え先 | 備考 |
|---|---|---|
| 生成 | `gemini-3.8-flash` | `responseSchema` 付きリクエストで動作確認済み。出力品質も明確に上 |
| 埋め込み | `gemini-embedding-001` | **エンドポイントは `v1`**。`v1beta` では 404 になる |

フォールバック自体は、AI 送信同意 OFF のユーザーやオフライン時に必要なので残す。消すべきなのは「失敗を黙って隠すこと」。

#### 対応した内容（PR #25・本番デプロイ済み）

- 生成を `gemini-3.8-flash` に差し替え。2 番目のフォールバックを `gemini-flash-latest`（常に最新の flash を指すエイリアス）にして、同じ事故の再発に備えた
- 埋め込みを `v1` + `gemini-embedding-001`（768 次元指定）に差し替え
- 生成・埋め込みの失敗を `console.warn` に残すようにした（API キーは出さない）
- 思考を返すモデルで `parts[0]` が text を持たない場合に備え、text を持つ最初の part を使うようにした

本番で確認した結果:

```
intent1: DIYや家具作りの参考に脚の木組みや構造を詳しく調べる
intent2: 部屋のインテリアに合わせてスツール選びのこだわりポイントとして見比べる
```

`/api/confirmItemIntent` の embedding も 768 次元（フォールバックは 64 次元）になった。

### 2.2 ❌ Vertex AI は使っていない

実際に呼んでいるのは `generativelanguage.googleapis.com`、つまり **Gemini API（Google AI Studio の API キー方式）**。Vertex AI（`aiplatform.googleapis.com`）は依存にもコードにも存在しない。

一方、以下のドキュメントは「Gemini（Vertex AI 経由）」と書いている。

- [`product-doc.md`](product-doc.md) 3.2 の技術表、3.3 の本文
- [`decisions/001-tech-stack.md`](decisions/001-tech-stack.md)（廃止済み ADR）
- [`decisions/002-web-stack.md`](decisions/002-web-stack.md)

提出要件 3「プロダクトが使う AI は Gemini に統一する」には**違反していない**（どちらも Gemini）。問題は、説明と実装が食い違っていること。

**決定（2026-11-08）: Gemini API のまま。表記を実装に合わせる。**

Vertex AI へ寄せると認証方式（API キー → サービスアカウント）とエンドポイントの両方を変えることになり、提出（11/10）までの残り時間に対して得るものが見合わない。提出要件 3「AI は Gemini に統一」はどちらでも満たす。

この決定に伴い、`product-doc.md` / ADR の「Vertex AI 経由」という記述を「Gemini API（Google AI Studio）」に直した。

### 2.3 ⚠️ Genkit は定義されているだけで通っていない

[`callableHandlers.ts`](../functions/src/presentation/callableHandlers.ts) が `ai.defineFlow` で 4 つの Flow を定義している。しかし:

- callable ハンドラは Flow を経由せず、`runAnalyzeItem` などのユースケース関数を直接呼んでいる
- Flow を `index.ts` から re-export していたところ、firebase-functions のローダーが Genkit オブジェクトを解析しようとして無限再帰し、**デプロイが失敗していた**。そのため PR #22 で re-export を外した

結果として、**Flow はどこからも実行されない**。実際の Gemini 呼び出しは `geminiClient.ts` の素の REST `fetch`。

**決定（2026-11-08）: Genkit は通さない。表記を「Cloud Functions + Gemini API」に変える。**

現状の Flow は `runAnalyzeItem` を呼ぶだけの薄いラッパで、Flow を経由させてもモデル呼び出しは `geminiClient.ts` の素の REST のまま。Genkit は実質何もしない。実態に合わせて表記を変えるのが素直。

**残っている後始末**: `genkit` / `@genkit-ai/googleai` は `functions/package.json` の依存に残っており、`callableHandlers.ts` の Flow 定義もそのまま残っている。動作には影響しないが、`index.ts` から re-export するとデプロイが壊れる地雷でもある。削除は別途判断する（下の「4. 残っている後始末」）。

### 2.4 ⚠️ PWA はインストールできるがオフラインでは開けない

あるもの: [`manifest.webmanifest`](../public/manifest.webmanifest)、`icons/`（192 / 512）、`theme-color`、`apple-mobile-web-app-capable`、[`sw.js`](../public/sw.js)（キャッシュ戦略まで実装済み）。

ないもの: **Service Worker の登録コード**。`src/` にも `index.html` にも `navigator.serviceWorker.register` が無い。本番のブラウザで確認したところ、登録数 0・キャッシュ 0 だった。sw.js は配信されているだけで、一度も動いていない。

[`decisions/002-web-stack.md`](decisions/002-web-stack.md) は `vite-plugin-pwa` を使うと書いているが、`package.json` に入っていない。実際は手書きの sw.js。

**決定（2026-11-08）: オフライン対応は入れない。主張を下げる。**

提出まで残り時間が短く、Service Worker のキャッシュは「デプロイしたのに古い画面が出る」事故を生みやすい。実際このプロジェクトでは、Hosting のキャッシュヘッダだけで一度踏んでいる（[PR #23](https://github.com/Kambara-Michiru/hannari-hustlers/pull/23)）。

主張は **「ホーム画面に追加できる」まで**とし、オフライン動作は謳わない。`public/sw.js` の扱いは下の「4. 残っている後始末」。

### 2.5 ⚠️ 能動発見の外部検索は固定データ

[`discoverySearchAdapter.ts`](../functions/src/infrastructure/discoverySearchAdapter.ts) は `adapterMode: 'curated_reference_fixture'` という固定の参照データセットを返す。実際の外部検索 API（Google Search Grounding 等）は呼んでいない。

コード上は `curated_reference_fixture` / `live_grounding_provider` を型で区別していて、モックであることを隠していない。**この設計は良い。** 問題になるのは、提出物で「公式サイトを検索して照合している」と読める書き方をした場合だけ。

### 2.6 ✅ 動いているもの

- **Hosting**: 実デプロイ済み。`/` と深いパスは `no-cache`、`/assets/**` は `immutable`
- **匿名認証**: 本番で `signUp` 成功、`request.auth.uid` 付きで Firestore に書けることを確認
- **Firestore**: 保存 → `localStorage` を消して再読込 → 復元まで確認。ルールはサーバー管理サブコレクション（`researchJobs` / `researchReports` / `notificationOutbox` / `discoveryCandidates`）へのクライアント write を禁止
- **Cloud Functions**: 7 関数が `asia-northeast1` / Node 22 で稼働
- **Scheduled Functions**: `scheduledNightOrganize`（23:00 JST）/ `scheduledMorningPropose`（08:00 JST）。ユーザー横断ループ、AI 送信同意 OFF の除外、現地日付での冪等チェックまで実装済み。**枠組みは本物**（中身の AI が 2.1 の理由で効いていないだけ）
- **SSRF 対策**: [`urlMetadataFetcher.ts`](../functions/src/infrastructure/urlMetadataFetcher.ts) がプライベートアドレスを拒否。取得本文は `<untrusted_content>` で隔離（AGENTS.md の外部コンテンツ方針どおり）

### 2.7 ✅ バックエンドの穴を埋めた（2026-11-09 修正済み）

`functions/src/` を読み直したところ、**`firestore.rules` とドキュメントが「ある」と言っているのに、書く主体がどこにもいない**ものが並んでいた。イシュー #28 で埋めた。

| 直す前 | 直したあと |
|---|---|
| `runProactiveDiscoveryCycle` は結果を返すだけで Firestore に書かず、`researchJobs` / `researchReports` / `notificationOutbox` は常に空。連絡箱は端末の localStorage だけに存在し、別端末・ストレージ削除で消えていた | [`discoveryPersistenceUseCases.ts`](../functions/src/application/discoveryPersistenceUseCases.ts) が `researchJobs` / `researchReports` を安定 doc id で upsert する。純粋関数のままのサイクル本体には `firebase-admin` を持ち込まず、`DiscoveryStore` として注入する（この関数はフロントのフォールバックからも import されている） |
| 冪等性・二重実行防止の材料（既存ジョブ・当日レポート・既通知キー）がクライアント入力しかなく、`canAcquireJobLease` が片輪だった | サーバーが自分の Firestore から読んで渡す。同じ現地日付で 2 回走らせてもレポートは 1 件のまま |
| 公開直前の同意再確認（`recheckConsentBeforePublish`）がどこからも渡っていなかった | 外部検索の直後・公開の直前に Firestore を読み直して、同意撤回と一時停止を確認する |
| 同意の判定材料がクライアント申告の `settings` だけだった | 同意・停止・静音時間は Firestore 保存値を正とする（クライアントが ON を申告しても保存が OFF なら外部検索しない） |
| AI 系 4 関数が `request.auth` を見ておらず、しかも本番の主経路（Hosting リライト経由の素の `fetch`）が ID トークンを送っていなかったため、**`request.auth` が常に `undefined`**。Gemini キーを使う関数を誰でも叩ける状態で、uid が取れないので保存もできなかった | 5 関数すべてで認証必須。[`aiFlowClient.ts`](../src/infrastructure/ai/aiFlowClient.ts) が `/api/*` に `Authorization: Bearer <IDトークン>` を付ける。万一ヘッダが落ちても 401 → `httpsCallable` → ローカルエンジンの順に落ちるのでアプリは止まらない |
| `/api/runDiscoveryCycle` の Hosting リライトが無く、`**` → `index.html` に吸われて毎回 HTML を取得して捨てていた | [`firebase.json`](../firebase.json) にリライトを追加 |

#### 本番で踏んだ不具合（同じ PR で修正済み）

デプロイして実際に叩いたところ `runDiscoveryCycle` が 500 になった。`firestoreAdminRepository.ts` の `getDb()` が
`getApps().length` で初期化済みかを判定していたが、`getApps()` は**名前付きアプリでも埋まる**。
既定アプリが無いまま `getFirestore()` に進み `app/no-app` で落ちていた。既定アプリの有無だけを見るように変えた。

`getDb()` は夜 23:00 / 朝 8:00 の定時バッチも通る経路なので、**バッチも同じ条件で落ちていた可能性が高い**（ログ上は
各実行でインスタンスが起動した記録はあるが、処理完了のログが無い）。今回の修正で同じ経路が直っている。

**Web Push は今回も実装していない。** `notificationOutbox` に積むのは「同意・静音時間・対象 Project の判定を通ったので送ると決めた」という記録で、端末への到達記録ではない。ユーザーが実際に読む場所は連絡箱（`researchReports`）のまま。

残っている既知の制約:

- 実行前に claim を書き込まないので、同一秒に 2 リクエストが来ると両方走り得る（読み取り時のリース判定のみ）。手動ボタンだけの現状では実用上問題にならない
- 能動発見の定時実行（`onSchedule`）は無い。走るのは連絡箱の「いま探す」を押したときだけ
- ローカル開発（Vite ミドルウェア）は Cloud Functions を経由しないため、保存は行われない

### 2.8 要件とバックエンド実装の突き合わせ（2026-11-09）

[`requirements.md`](requirements.md) と [`architecture.md`](architecture.md) を `functions/src/` と突き合わせた結果。

#### ✅ 直したもの

**定時バッチが書いたものをクライアントが読めなかった。** `saveNightBundlesForUser` / `saveMorningProposalForUser` が
`add()` で自動 doc id を振り、中身に `id` を入れていなかった。クライアント（[`firestoreRepository.ts`](../src/infrastructure/firebase/firestoreRepository.ts)）は
`d.data()` だけを読んで doc id を捨てるため、読み戻すと `id: undefined` になる。結果として

- `items.bundleId === bundle.id` の突合が外れる（束に保存物が入らない）
- `proposals.find(p => p.id === activeProposalId)` が永久に一致しない（朝の提案が画面に出ない）
- `Bundle.buildingLevel` が未設定のまま書かれ、振り返り（F8）の `+1` が `NaN` になる

つまり **夜 23:00 / 朝 8:00 のジョブが動いても成果が UI に出てこなかった**。2.7 の `app/no-app` でバッチ自体が
落ちていたため、この不整合は一度も表に出ていなかったと見ている。書く形を
[`firestoreDocuments.ts`](../functions/src/domain/firestoreDocuments.ts) の純粋関数に切り出し、`src/__tests__` から
フロントの `Bundle` / `Proposal` 型への代入で固定した（型が増えたら検査で落ちる）。読み側でも doc id を補う。

**バッチのループが 1 人で止まっていた。** [`scheduledBatchUseCases.ts`](../functions/src/application/scheduledBatchUseCases.ts) の
ユーザーループに `try/catch` が無く、1 人の処理で例外が出ると**以降の全員が無処理**になっていた。
ユーザー単位で握って `console.warn` に残し、次のユーザーへ進むようにした。

**朝の提案で選ぶ束が、手押しと定時ジョブで食い違っていた。** フロント（[`islandRules.ts`](../src/domain/rules/islandRules.ts)
の `selectTargetBundleForToday`）は「承認済み かつ まだ建っていない Projects 束 → Projects 束 →
アイテムを持つ Areas 束」の順で選ぶ。バッチ側は `readyForProposal` で絞って Projects を先頭に寄せるだけで、
承認状態も `buildingLevel` も見ていなかった。選択ルールを
[`proposalSelection.ts`](../functions/src/domain/proposalSelection.ts) の純粋関数にしてフロントと同じ順序にそろえた。
あわせて requirements.md F6 の「**アクティブな** Project / Area について」に合わせ、
紐づけ先が archived になった束を対象から外す（フロントは Project 直紐づけの経路でしか status を見ていないので、
ここはサーバーのほうが要件に忠実になる）。

> 補足: 当初「サーバーだけが未承認の束で提案を出す」と書いたが、正確ではない。
> フロントも承認済みが 1 つも無ければ未承認の Projects 束にフォールバックする。
> 違っていたのは**優先順位を持っていなかったこと**。

#### ⚠️ 残っているギャップ

| # | 要件 | 実装 |
|---|---|---|
| a | [`requirements.md`](requirements.md) 「定時ジョブ（夜の整理、朝の提案、**振り返り、週 1 の仕分け**）」 | 定時は夜・朝の 2 つだけ。振り返りの催促と週 1 仕分けはクライアント操作のみ。`architecture.md` は 2 つしか書いていないので、ズレているのは requirements 側 |
| d | 「『まだ』が 2 回続いたら、もっと小さな一歩に分けるか、手放すかを聞く」 | `previousStatus` は直近 1 回ぶんのみ。連続カウンタも「手放すか聞く」分岐も無い |
| e | 「通知を 2 回続けて無視されたら週 1 の仕分けに回す」 | 通知自体が未実装（2.7）。要件側を落とすのが素直 |
| f | 「エージェント用の重いフレームワークは MVP では使わない」 | `genkit` / `@genkit-ai/googleai` が依存に残っている（実行経路外・4 章の後始末） |

細かい点: `listUserIds(100)` でユーザー 100 人打ち止め。`saveNightBundlesForUser` が逐次 `await` で
`writeBatch` を使っていないため、途中で失敗すると束だけできて `items` が更新されない状態が残る。

#### 整合していたもの

F3 の意図 3 候補と `urlFetched: false` の誠実な扱い（R04）、F5 の「2 件以上かつ意図確定済み」、
Someday 束が `readyForProposal: false` で提案対象から外れること、1 日 1 提案の現地日付冪等
（クライアントも `localDate` を書くのでサーバーの `hasProposalForLocalDate` と噛み合う）、
AI 送信同意 OFF の除外、非機能「本人だけが見られる」。

---

## 3. するべきこと

提出は 2026-11-10 19:00。

### ✅ 完了（2026-11-08）

| # | やったこと | PR |
|---|---|---|
| 1 | `geminiClient.ts` の生成モデルを `gemini-3.8-flash` に差し替え | [#25](https://github.com/Kambara-Michiru/hannari-hustlers/pull/25) |
| 2 | 埋め込みを `v1` + `gemini-embedding-001` に差し替え | [#25](https://github.com/Kambara-Michiru/hannari-hustlers/pull/25) |
| 3 | Gemini 呼び出しの失敗を `console.warn` に残す | [#25](https://github.com/Kambara-Michiru/hannari-hustlers/pull/25) |
| 4 | docs の「Vertex AI」「Genkit」「オフライン」表記を実装に合わせる | [#24](https://github.com/Kambara-Michiru/hannari-hustlers/pull/24) |
| 5 | 本番で保存を通し、Gemini 出力と 768 次元の埋め込みが返ることを確認 | — |
| 6 | 検証で作った匿名ユーザーのテストデータを Firestore から削除（31 ドキュメント） | — |
| 7 | 能動発見が固定の参照データであることを UI と提出物に明示（カードのチップ・連絡箱の説明・`product-doc.md` 7.1 / 6.3） | — |
| 8 | `tech-selection.md` の未確認チェックを公式ドキュメントで確認して記入 | — |
| 9 | `architecture.md` のディレクトリ構造に能動発見まわりのファイルを追記 | — |

### ✅ 完了（2026-11-09）

| # | やったこと | PR |
|---|---|---|
| 10 | 能動発見の結果を `researchJobs` / `researchReports` / `notificationOutbox` に保存する（2.7） | [#29](https://github.com/Kambara-Michiru/hannari-hustlers/pull/29) |
| 11 | 冪等性・リース判定・公開直前の同意再確認をサーバー側で効かせる（2.7） | [#29](https://github.com/Kambara-Michiru/hannari-hustlers/pull/29) |
| 12 | callable 5 関数を認証必須にし、`/api/*` に ID トークンを付ける（2.7） | [#29](https://github.com/Kambara-Michiru/hannari-hustlers/pull/29) |
| 13 | `getDb()` が既定アプリ不在で `app/no-app` に落ちる不具合を修正（2.7） | [#29](https://github.com/Kambara-Michiru/hannari-hustlers/pull/29) |

### 残っていること

| # | やること | 優先 |
|---|---|---|
| 17 | 2.8 の残ギャップ a・d・e・f（定時ジョブ 4 つのうち 2 つ、「まだ」2 回連続、通知 2 回無視、Genkit 依存）。いずれも要件側を MVP 実態に落とすか実装するかの判断が要る | P2 |
| 14 | **本番の Firestore に実在のミュージシャン名が「好き」帳として残っている**。2026-11-09 の検証中、匿名ユーザーの `confirmedSubjects` に実在のアーティスト名と実在のアルバム名が入っているのを確認した。コードの初期値は架空名（`蒼井ことね`）なので、人手で入力されたもの。提出要件 6「テストアカウントやサンプルデータに実在の個人情報を使わない」に触れるので消す。同じ検証で増えた `researchReports` / `researchJobs` も一緒に消す | **P1** |
| 15 | **モバイル Safari の WebGL で島が 60fps を保てるかの実測** — 実機（iPhone）と Mac の Web Inspector が要る。測り方は [`tech-selection.md`](tech-selection.md) の要確認に書いた | P2 |
| 16 | Firestore ベクトル検索の**リージョン別料金**は公式に記載が見つからず未確定。ただし現状このプロジェクトはベクトルインデックスを使っていないため課金は発生しない | P3 |

---

## 4. 残っている後始末（要判断）

決定（2.2〜2.4）に沿うと不要になるが、消すこと自体に小さなリスクがあるため分けている。**提出後に回してよい。**

| 対象 | 現状 | 消す場合の影響 |
|---|---|---|
| `genkit` / `@genkit-ai/googleai` の依存と、`callableHandlers.ts` の Flow 定義 | 実行経路外。ただし `index.ts` から re-export するとデプロイが壊れる地雷 | `functions/` の依存が軽くなる。`assets.md` の OSS 一覧からも 1 行減る。動作への影響はない想定だが、デプロイして確認が要る |
| `public/sw.js` | 配信のみ。登録コードが無く未稼働 | オフライン対応を入れない決定に沿う。消さずに残すなら「未使用」とコメントを入れておく |

---

## 5. 決定の履歴

| 日付 | 決定 | 根拠 |
|---|---|---|
| 2026-11-08 | **Vertex AI ではなく Gemini API を使う** | 移行コストが提出までの残り時間に見合わない。提出要件 3 はどちらでも満たす（2.2） |
| 2026-11-08 | **Genkit は通さない。表記を「Cloud Functions + Gemini API」にする** | Flow が薄いラッパで実質何もしていない（2.3） |
| 2026-11-08 | **PWA のオフライン対応は入れない。「ホーム画面に追加できる」までを主張とする** | キャッシュ事故のリスクが残り時間に見合わない（2.4） |

ADR は決定時点の記録として本文を残し、実装との差異はこのファイルから辿れるようにしている。
