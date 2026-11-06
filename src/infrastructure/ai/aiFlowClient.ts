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
import { ensureFirebase } from '../firebase/firebaseClient';

async function invokeFlow<TIn, TOut>(flowName: string, input: TIn): Promise<TOut | null> {
  // 1. まず開発サーバー / Hosting リライトの /api/<flowName> を試す
  try {
    const res = await fetch(`/api/${flowName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      return (await res.json()) as TOut;
    }
  } catch {
    // Cloud Functions へフォールバック
  }

  // 2. Firebase Cloud Functions (httpsCallable) が設定されていれば呼ぶ
  const fb = ensureFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<TIn, TOut>(fb.fns, flowName);
      const res = await fn(input);
      if (res.data) return res.data;
    } catch {
      // クライアントフォールバックへ
    }
  }

  return null;
}

export async function apiAnalyzeItem(input: AnalyzeItemInput): Promise<AnalyzeItemOutput> {
  const remote = await invokeFlow<AnalyzeItemInput, AnalyzeItemOutput>('analyzeItem', input);
  if (remote && remote.intents?.length >= 3) {
    return remote;
  }
  const raw = (input.rawText || input.fileName || input.url || '気になったアイデア').trim();
  const title = raw.replace(/^https?:\/\/[^/]+\/?/, '').slice(0, 22) || '気になったアイデア';
  const isUrl = Boolean(input.url);
  const isImg = Boolean(input.imageDataUrl);
  return {
    kind: isUrl
      ? input.url?.includes('instagram')
        ? 'INSTAGRAM'
        : 'ARTICLE'
      : isImg
        ? 'SCREENSHOT'
        : 'NOTE',
    title,
    source: isUrl
      ? new URL(input.url!).hostname.replace(/^www\./, '')
      : isImg
        ? 'カメラロール'
        : 'メモ',
    note: isImg
      ? '画像の文字と雰囲気から読み取ったよ'
      : isUrl
        ? 'リンク先のタイトルから読み取ったよ'
        : '書いてくれたメモから読み取ったよ',
    color: '#2f5fd8',
    c2: '#5a80e2',
    intents: [
      `${title.slice(0, 14)}を試してみる`,
      `${title.slice(0, 14)}を15分だけ調べてみる`,
      `${title.slice(0, 14)}を次の制作の参考にする`,
    ],
  };
}

export async function apiConfirmIntent(input: ConfirmIntentInput): Promise<ConfirmIntentOutput> {
  const remote = await invokeFlow<ConfirmIntentInput, ConfirmIntentOutput>(
    'confirmItemIntent',
    input
  );
  if (remote?.embedding?.length) return remote;
  return { embedding: [] };
}

export async function apiNightOrganize(input: NightOrganizeInput): Promise<NightOrganizeOutput> {
  const remote = await invokeFlow<NightOrganizeInput, NightOrganizeOutput>('nightOrganize', input);
  if (remote && remote.bundles) return remote;
  if (input.items.length < 2) return { bundles: [] };
  const primary = input.items[0];
  return {
    bundles: [
      {
        intent: primary.intent,
        points: [
          `「${primary.title}」など${input.items.length}件の保存が集まっている`,
          'まずは15分だけ形にしてみる',
          '気負わず入り口の1ステップから始める',
        ],
        tool: primary.title.slice(0, 12),
        itemIds: input.items.map((x) => x.id),
        para: 'Projects',
        readyForProposal: true,
      },
    ],
  };
}

export async function apiMorningPropose(input: MorningProposeInput): Promise<MorningProposeOutput> {
  const remote = await invokeFlow<MorningProposeInput, MorningProposeOutput>(
    'morningPropose',
    input
  );
  if (remote && remote.title) return remote;
  const isMada = input.previousStatus === 'mada';
  return {
    ask: isMada
      ? `「${input.bundle.intent}」、今日は5分だけ入り口を作ってみない？`
      : `今日は、${input.bundle.intent.replace(/してみる$/, '')}してみない？`,
    title: isMada
      ? `${input.bundle.tool}を開いて最初の1つだけ試す`
      : `${input.bundle.tool}の最初の準備を15分だけやる`,
    detail: input.bundle.points[0] || 'まずは小さな一歩だけで大丈夫だよ。',
    minutes: isMada ? 5 : 15,
  };
}
