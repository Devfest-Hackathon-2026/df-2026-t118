import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import {
  AnalyzeItemInputSchema,
  AnalyzeItemOutputSchema,
  ConfirmIntentInputSchema,
  ConfirmIntentOutputSchema,
  MorningProposeInputSchema,
  MorningProposeOutputSchema,
  NightOrganizeInputSchema,
  NightOrganizeOutputSchema,
} from '../domain/schemas.js';
import {
  runAnalyzeItem,
  runConfirmItemIntent,
  runMorningPropose,
  runNightOrganize,
} from '../application/aiUseCases.js';

export const geminiApiKey = defineSecret('GEMINI_API_KEY');

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
  async (input) => runAnalyzeItem(input, process.env.GEMINI_API_KEY)
);

export const confirmItemIntentFlow = ai.defineFlow(
  {
    name: 'confirmItemIntentFlow',
    inputSchema: ConfirmIntentInputSchema,
    outputSchema: ConfirmIntentOutputSchema,
  },
  async (input) => runConfirmItemIntent(input, process.env.GEMINI_API_KEY)
);

export const nightOrganizeFlow = ai.defineFlow(
  {
    name: 'nightOrganizeFlow',
    inputSchema: NightOrganizeInputSchema,
    outputSchema: NightOrganizeOutputSchema,
  },
  async (input) => runNightOrganize(input, process.env.GEMINI_API_KEY)
);

export const morningProposeFlow = ai.defineFlow(
  {
    name: 'morningProposeFlow',
    inputSchema: MorningProposeInputSchema,
    outputSchema: MorningProposeOutputSchema,
  },
  async (input) => runMorningPropose(input, process.env.GEMINI_API_KEY)
);

// ---------- Callable Functions（フロントエンドからの呼び出し） ----------

export const analyzeItem = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request) => {
    const parsed = AnalyzeItemInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runAnalyzeItem(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const confirmItemIntent = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request) => {
    const parsed = ConfirmIntentInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runConfirmItemIntent(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const nightOrganize = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request) => {
    const parsed = NightOrganizeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runNightOrganize(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);

export const morningPropose = onCall(
  { region: 'asia-northeast1', secrets: [geminiApiKey], cors: true },
  async (request) => {
    const parsed = MorningProposeInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', '入力形式が正しくありません');
    }
    return runMorningPropose(parsed.data, geminiApiKey.value() || process.env.GEMINI_API_KEY);
  }
);
