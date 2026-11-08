import { httpsCallable } from 'firebase/functions';
import type {
  AnalyzeItemInput,
  AnalyzeItemOutput,
  ConfirmIntentInput,
  ConfirmIntentOutput,
  MorningProposeInput,
  MorningProposeOutput,
  NightOrganizeInput,
  NightOrganizeOutput,
} from '../../../functions/src/domain/schemas';
import {
  buildHeuristicAnalysis,
  runConfirmItemIntent,
  runMorningPropose,
  runNightOrganize,
} from '../../../functions/src/application/aiUseCases';
import type { RunDiscoveryCycleInput } from '../../../functions/src/domain/proactiveDiscoverySchemas';
import {
  runProactiveDiscoveryCycle,
  type RunDiscoveryCycleResult,
} from '../../../functions/src/application/proactiveDiscoveryUseCases';
import { ensureFirebase } from '../firebase/firebaseClient';

export type AiExecutionSource = 'backend-api' | 'cloud-functions' | 'local-engine';

let lastExecutionSource: AiExecutionSource = 'local-engine';

export function getLastAiExecutionSource(): AiExecutionSource {
  return lastExecutionSource;
}

async function invokeFlow<TIn, TOut>(flowName: string, input: TIn): Promise<TOut | null> {
  // 1. まず開発サーバー（Vite Node ミドルウェア） / Hosting リライトの /api/<flowName> を試す。
  // Hosting のリライト先は onCall 関数なので、ボディは onCall の規約どおり { data: ... } で包む。
  // 包まないと onCall が "Request body is missing data." で 400 を返し、毎回 httpsCallable への
  // フォールバックに1往復ぶん余計な時間がかかる。Vite 側のミドルウェアも data を外して読む。
  try {
    const res = await fetch(`/api/${flowName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: input }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = (await res.json()) as TOut & { result?: TOut };
      lastExecutionSource = 'backend-api';
      // Cloud Functions onCall 互換レスポンス ({ result: ... }) と直接 JSON の両方に対応
      if (json && typeof json === 'object' && 'result' in json && json.result) {
        return json.result;
      }
      return json;
    }
  } catch {
    // Cloud Functions SDK へフォールバック
  }

  // 2. Firebase Cloud Functions (httpsCallable) が設定されていれば呼ぶ
  const fb = ensureFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<TIn, TOut>(fb.fns, flowName);
      const res = await fn(input);
      if (res.data) {
        lastExecutionSource = 'cloud-functions';
        return res.data;
      }
    } catch {
      // クライアント共通エンジンへフォールバック
    }
  }

  lastExecutionSource = 'local-engine';
  return null;
}

export async function apiAnalyzeItem(input: AnalyzeItemInput): Promise<AnalyzeItemOutput> {
  const remote = await invokeFlow<AnalyzeItemInput, AnalyzeItemOutput>('analyzeItem', input);
  if (remote && remote.intents?.length >= 3) {
    return remote;
  }
  let domain = 'Web';
  if (input.url) {
    try {
      domain = new URL(input.url).hostname.replace(/^www\./, '');
    } catch {
      domain = 'Web';
    }
  }
  return buildHeuristicAnalysis(input, {
    fetched: false,
    domain,
    title: '',
    description: '',
  });
}

export async function apiConfirmIntent(input: ConfirmIntentInput): Promise<ConfirmIntentOutput> {
  const remote = await invokeFlow<ConfirmIntentInput, ConfirmIntentOutput>(
    'confirmItemIntent',
    input
  );
  if (remote?.embedding?.length) return remote;
  return runConfirmItemIntent(input);
}

export async function apiNightOrganize(input: NightOrganizeInput): Promise<NightOrganizeOutput> {
  const remote = await invokeFlow<NightOrganizeInput, NightOrganizeOutput>('nightOrganize', input);
  if (remote && remote.bundles) return remote;
  return runNightOrganize(input);
}

export async function apiMorningPropose(input: MorningProposeInput): Promise<MorningProposeOutput> {
  const remote = await invokeFlow<MorningProposeInput, MorningProposeOutput>(
    'morningPropose',
    input
  );
  if (remote && remote.title) return remote;
  return runMorningPropose(input);
}

export async function apiRunDiscoveryCycle(
  input: RunDiscoveryCycleInput
): Promise<RunDiscoveryCycleResult> {
  const remote = await invokeFlow<RunDiscoveryCycleInput, RunDiscoveryCycleResult>(
    'runDiscoveryCycle',
    input
  );
  if (remote && remote.report) return remote;
  return runProactiveDiscoveryCycle(input);
}
