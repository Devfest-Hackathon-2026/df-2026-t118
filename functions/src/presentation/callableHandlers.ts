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
  createFirestoreDiscoveryStore,
} from '../infrastructure/firestoreAdminRepository.js';

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
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request: CallableRequest<unknown>) => {
    requireUid(request);
    const parsed = AnalyzeItemInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runAnalyzeItem(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const confirmItemIntent = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request: CallableRequest<unknown>) => {
    requireUid(request);
    const parsed = ConfirmIntentInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runConfirmItemIntent(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const nightOrganize = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request: CallableRequest<unknown>) => {
    requireUid(request);
    const parsed = NightOrganizeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runNightOrganize(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const morningPropose = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request: CallableRequest<unknown>) => {
    requireUid(request);
    const parsed = MorningProposeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runMorningPropose(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const runDiscoveryCycle = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request: CallableRequest<unknown>) => {
    const uid = requireUid(request);
    const parsed = RunDiscoveryCycleInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    // uid はクライアント申告を採らず、検証済みトークンの uid に固定する
    return runPersistedDiscoveryCycle(
      { ...parsed.data, uid },
      createFirestoreDiscoveryStore()
    );
  }
);
