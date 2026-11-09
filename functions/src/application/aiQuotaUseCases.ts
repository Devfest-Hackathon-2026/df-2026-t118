// AI 呼び出しの日次クォータ（イシュー #38）。
//
// 本番は匿名認証で誰でも入れる。uid はタダで無限に作れるため、callable の requireUid は
// 課金の歯止めにならない。ここで「1 uid が 1 日に使える量」と「プロジェクト全体が 1 日に
// 使える量」に天井を置く。
//
// 設計の前提は 2 つあり、どちらも提出要件 4（デプロイ URL を 11/14 まで稼働）から来ている。
//
//  1. 止めるのではなく劣化させる
//     上限に当たった呼び出しは resource-exhausted で弾くが、クライアントは
//     /api → httpsCallable → ローカルエンジン の順に落ちる（src/infrastructure/ai/aiFlowClient.ts）。
//     画面は止まらず、AI の文面がテンプレートに替わるだけになる。
//
//  2. フェイルオープン
//     カウンタの読み書きが失敗したら通す。ガードが壊れたせいで本番の AI が全滅するほうが、
//     多少の課金より損が大きい。実際の防波堤は maxInstances と入力上限と合わせた多層で持つ。
//
// このファイルは firebase-admin を import しない。functions/src はフロントエンドからも
// import されるため（aiFlowClient.ts）、admin SDK を持ち込むとブラウザ側のバンドルが壊れる。
// Firestore 実装は infrastructure/firestoreAdminRepository.ts の createFirestoreAiQuotaStore()。

export interface AiQuotaGuardConfig {
  // true にすると全ユーザーの AI 呼び出しを即止める（人間がコンソールで操作するキルスイッチ）
  disabled?: boolean;
  userDailyLimit?: number;
  globalDailyLimit?: number;
}

export interface AiQuotaStore {
  // 設定ドキュメント。無ければ null を返し、このファイルの既定値が使われる
  getGuardConfig(): Promise<AiQuotaGuardConfig | null>;
  // uid の当日カウンタを cost ぶん進め、進めた後の累計を返す
  consumeUserDaily(uid: string, localDate: string, cost: number): Promise<number>;
  // 全体の当日カウンタ。read と write を分けているのは、write を厳密にしないため（下記）
  getGlobalDaily(localDate: string): Promise<number>;
  addGlobalDaily(localDate: string, cost: number): Promise<void>;
}

// 審査員が熱心に触っても届かない線にしている。ここに当たるとテンプレート文が出て
// 「AI が動いていない」ように見えるため、低く絞りすぎるほうが危ない。
export const DEFAULT_USER_DAILY_LIMIT = 300;
// 全体の天井。ここに当たると全員がローカルエンジンに落ちる（自分のデモを人質に取られうる）が、
// 請求が無限に伸びるほうを避ける。止まったことはログと config/aiGuard で分かる。
export const DEFAULT_GLOBAL_DAILY_LIMIT = 20000;

// 夜の整理は保存物 1 件につき埋め込みを 1 回呼ぶため、コストを件数に比例させる。
// 実際に AI を回す件数は aiUseCases.ts 側で頭打ちにしてあるので、同じ値で止める。
export const NIGHT_ORGANIZE_COST_CAP = 40;

export type QuotaRejectionReason = 'killswitch' | 'user_daily' | 'global_daily';

export type QuotaDecision =
  | { allowed: true; usedAfter: number }
  | { allowed: false; reason: QuotaRejectionReason };

// フロー 1 回あたりの重み。Gemini の呼び出し回数に合わせる
export function estimateFlowCost(flowName: string, data: unknown): number {
  if (flowName === 'nightOrganize') {
    const items = (data as { items?: unknown } | null | undefined)?.items;
    const count = Array.isArray(items) ? items.length : 0;
    return 1 + Math.min(count, NIGHT_ORGANIZE_COST_CAP);
  }
  // 能動発見は生成を複数回踏む
  if (flowName === 'runDiscoveryCycle') return 2;
  return 1;
}

// クォータの 1 日の境目は日本時間で切る（定時バッチと同じ基準にそろえる）。
// scheduledBatchUseCases.ts にも同等の実装があるが、あちらは admin SDK に依存した
// モジュールにあるため、純粋さを保つためにここでは持たない。
export function formatQuotaDate(nowMs = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(nowMs));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Intl が使えない環境では UTC+9 で代替する
  }
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 設定ドキュメントの値が壊れていてもサービスを止めない。
// 0 や負数・NaN は「未設定」として扱う（全停止は disabled フラグで明示的に行う）
function positiveOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function checkAndConsumeAiQuota(
  params: {
    uid: string;
    flowName: string;
    data?: unknown;
    cost?: number;
    localDate?: string;
    nowMs?: number;
  },
  store: AiQuotaStore
): Promise<QuotaDecision> {
  const cost = params.cost ?? estimateFlowCost(params.flowName, params.data);
  const localDate = params.localDate ?? formatQuotaDate(params.nowMs);

  try {
    const config = await store.getGuardConfig();
    if (config?.disabled === true) {
      return { allowed: false, reason: 'killswitch' };
    }

    const userDailyLimit = positiveOr(config?.userDailyLimit, DEFAULT_USER_DAILY_LIMIT);
    const globalDailyLimit = positiveOr(config?.globalDailyLimit, DEFAULT_GLOBAL_DAILY_LIMIT);

    // 全体の天井から先に見る。ここで止まるなら per-uid のカウンタを無駄に進めない。
    // 全体カウンタは単一ドキュメントで、毎回トランザクションで読み書きすると
    // Firestore の 1 ドキュメントあたりの書き込み制約に当たる。多少の超過を許して
    // キャッシュ付きの読み取り＋increment で済ませる（粗い天井なので実害がない）。
    const globalUsed = await store.getGlobalDaily(localDate);
    if (globalUsed >= globalDailyLimit) {
      return { allowed: false, reason: 'global_daily' };
    }

    // per-uid は競合しないので、読んで比較して書くところまで厳密に行う
    const usedAfter = await store.consumeUserDaily(params.uid, localDate, cost);
    if (usedAfter > userDailyLimit) {
      return { allowed: false, reason: 'user_daily' };
    }

    // 許可した分だけ全体に足す（弾いた呼び出しで全体の天井を削らない）
    await store.addGlobalDaily(localDate, cost);
    return { allowed: true, usedAfter };
  } catch (err) {
    // フェイルオープン。握りつぶすと「ガードが動いていない」ことに気づけないため理由は残す
    const detail = err instanceof Error ? err.message : '不明なエラー';
    console.warn(`[quota] 判定に失敗したため通します（${params.flowName}）: ${detail}`);
    return { allowed: true, usedAfter: 0 };
  }
}

// 拒否理由をログ向けの日本語にする
export function describeQuotaRejection(reason: QuotaRejectionReason): string {
  switch (reason) {
    case 'killswitch':
      return 'config/aiGuard の disabled が true';
    case 'global_daily':
      return 'プロジェクト全体の日次上限';
    case 'user_daily':
      return 'ユーザーごとの日次上限';
  }
}
