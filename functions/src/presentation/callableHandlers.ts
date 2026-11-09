import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import {
  type AnalyzeItemInput,
  AnalyzeItemInputSchema,
  AnalyzeItemOutputSchema,
  type ConfirmIntentInput,
  ConfirmIntentInputSchema,
  ConfirmIntentOutputSchema,
  type MorningProposeInput,
  MorningProposeInputSchema,
  MorningProposeOutputSchema,
  type NightOrganizeInput,
  NightOrganizeInputSchema,
  NightOrganizeOutputSchema,
} from '../domain/schemas.js';
import {
  runAnalyzeItem,
  runConfirmItemIntent,
  runMorningPropose,
  runNightOrganize,
} from '../application/aiUseCases.js';
import {
  RunDiscoveryCycleInputSchema,
} from '../domain/proactiveDiscoverySchemas.js';
import {
  runPersistedDiscoveryCycle,
} from '../application/discoveryPersistenceUseCases.js';
import {
  createFirestoreAiQuotaStore,
  createFirestoreDiscoveryStore,
} from '../infrastructure/firestoreAdminRepository.js';
import {
  checkAndConsumeAiQuota,
  describeQuotaRejection,
} from '../application/aiQuotaUseCases.js';

export const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Gemini キーを使う関数は本人のリクエストに限る。
// クライアントは httpsCallable か、Hosting リライト経由の fetch に
// Authorization: Bearer <IDトークン> を付けて呼ぶ（src/infrastructure/ai/aiFlowClient.ts）。
// 認証が通らない場合は 401 になり、クライアントは httpsCallable → ローカルエンジンへ
// 順に落ちるのでアプリ自体は止まらない。
function requireUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'サインインが必要です');
  }
  return uid;
}

// 匿名 uid は無限にタダで作れるため、requireUid だけでは課金の歯止めにならない（イシュー #38）。
// 1 uid の日次量と全体の日次量に天井を置く。入力検証のあとに呼び、件数に応じた重みで数える。
// 上限に当たったら resource-exhausted を返す。クライアントは httpsCallable → ローカルエンジンの
// 順に落ちるため画面は止まらない（src/infrastructure/ai/aiFlowClient.ts）。
async function enforceAiQuota(uid: string, flowName: string, data: unknown): Promise<void> {
  const decision = await checkAndConsumeAiQuota(
    { uid, flowName, data },
    createFirestoreAiQuotaStore()
  );
  if (!decision.allowed) {
    console.warn(
      `[quota] ${flowName} を拒否しました（uid: ${uid}, 理由: ${describeQuotaRejection(decision.reason)}）`
    );
    throw new HttpsError('resource-exhausted', 'きょうのAIの上限に達しました');
  }
}

// 不特定多数に並列で叩かれたときに関数が無制限にスケールしないよう、天井を明示する。
// concurrency は指定しない（gen2 は CPU 割り当てと連動し、誤るとデプロイが失敗する）。
const AI_CALLABLE_OPTIONS = {
  region: 'asia-northeast1' as const,
  secrets: [geminiApiKey],
  cors: true,
  maxInstances: 10,
  timeoutSeconds: 60,
  memory: '512MiB' as const,
};

// Genkit インスタンスと各 Flow の定義（ADR-002 / ADR-003）
export const ai = genkit({
  plugins: [googleAI()],
});

export const analyzeItemFlow = ai.defineFlow(
  {
    name: 'analyzeItemFlow',
    inputSchema: AnalyzeItemInputSchema,
    outputSchema: AnalyzeItemOutputSchema,
  },
  async (input: AnalyzeItemInput) => runAnalyzeItem(input, process.env.GEMINI_API_KEY)
);

export const confirmItemIntentFlow = ai.defineFlow(
  {
    name: 'confirmItemIntentFlow',
    inputSchema: ConfirmIntentInputSchema,
    outputSchema: ConfirmIntentOutputSchema,
  },
  async (input: ConfirmIntentInput) => runConfirmItemIntent(input, process.env.GEMINI_API_KEY)
);

export const nightOrganizeFlow = ai.defineFlow(
  {
    name: 'nightOrganizeFlow',
    inputSchema: NightOrganizeInputSchema,
    outputSchema: NightOrganizeOutputSchema,
  },
  async (input: NightOrganizeInput) => runNightOrganize(input, process.env.GEMINI_API_KEY)
);

export const morningProposeFlow = ai.defineFlow(
  {
    name: 'morningProposeFlow',
    inputSchema: MorningProposeInputSchema,
    outputSchema: MorningProposeOutputSchema,
  },
  async (input: MorningProposeInput) => runMorningPropose(input, process.env.GEMINI_API_KEY)
);

// ---------- Callable Functions（フロントエンドからの呼び出し） ----------

export const analyzeItem = onCall(
  AI_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = AnalyzeItemInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    await enforceAiQuota(uid, 'analyzeItem', parsed.data);
    return runAnalyzeItem(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const confirmItemIntent = onCall(
  AI_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = ConfirmIntentInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    await enforceAiQuota(uid, 'confirmItemIntent', parsed.data);
    return runConfirmItemIntent(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const nightOrganize = onCall(
  AI_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = NightOrganizeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    // 保存物 1 件につき埋め込みを 1 回呼ぶため、件数に比例した重みで数える
    await enforceAiQuota(uid, 'nightOrganize', parsed.data);
    return runNightOrganize(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const morningPropose = onCall(
  AI_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = MorningProposeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    await enforceAiQuota(uid, 'morningPropose', parsed.data);
    return runMorningPropose(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const runDiscoveryCycle = onCall(
  AI_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = RunDiscoveryCycleInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    await enforceAiQuota(uid, 'runDiscoveryCycle', parsed.data);
    // uid はクライアント申告を採らず、検証済みトークンの uid に固定する
    return runPersistedDiscoveryCycle(
      { ...parsed.data, uid },
      createFirestoreDiscoveryStore()
    );
  }
);
