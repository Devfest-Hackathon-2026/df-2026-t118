import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  extractReadableTitleFromInput,
  matchIntentToTargets,
  normalizeThreeAngleIntents,
  runAnalyzeItem,
  runConfirmItemIntent,
  runMorningPropose,
  runNightOrganize,
} from '../../functions/src/application/aiUseCases';
import {
  cosineSimilarity,
  deterministicFallbackEmbedding,
} from '../../functions/src/domain/clustering';
import {
  AnalyzeItemOutputSchema,
  MorningProposeOutputSchema,
  NightOrganizeOutputSchema,
} from '../../functions/src/domain/schemas';
import { parseJsonSafely } from '../../functions/src/infrastructure/geminiClient';
import { createIslandApiHandler } from '../../vite.config';
import {
  buildFallbackBundle,
  buildFallbackProposal,
  computeBubbleText,
  computeHeadline,
  computeLocalDateString,
  selectItemsForNightOrganize,
  selectTargetBundleForToday,
} from '../domain/rules/islandRules';

// Node HTTP ミドルウェア（createIslandApiHandler）をインメモリで直接実行するテストヘルパー
async function invokeBackendMiddleware(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown
): Promise<{ status: number; data: Record<string, unknown> }> {
  const handler = createIslandApiHandler('');
  const reqEmitter = new EventEmitter();
  const req = Object.assign(reqEmitter, {
    method,
    url,
    headers: { 'content-type': 'application/json' },
  }) as unknown as IncomingMessage;

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let rawBody = '';
    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(val: number) {
        statusCode = val;
      },
      setHeader() {},
      end(chunk?: string) {
        if (chunk) rawBody += chunk;
        try {
          resolve({ status: statusCode, data: rawBody ? JSON.parse(rawBody) : {} });
        } catch (err) {
          reject(err);
        }
      },
    } as unknown as ServerResponse;

    handler(req, res, () => {
      resolve({ status: 404, data: { error: 'Not handled' } });
    }).catch(reject);

    queueMicrotask(() => {
      if (body !== undefined) {
        reqEmitter.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
      }
      reqEmitter.emit('end');
    });
  });
}

describe('AI Pipeline, Backend Execution & Domain Rules (F01〜F05 & 4-Layer Architecture)', () => {
  it('computes cosine similarity and hybrid semantic embeddings accurately', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
    // 768次元と64次元が混在した場合でもゼロにならず安全に比較できる
    expect(cosineSimilarity([1, 0, 0, 0], [1, 0])).toBeCloseTo(1);

    // ハイブリッド埋め込み：表記が異なっても同ドメイン（Obsidian と Second Brainノート整理）は高類似度になる
    const embObsidian = deterministicFallbackEmbedding('Obsidianの紹介記事で知識管理を試す');
    const embSecondBrain = deterministicFallbackEmbedding('Second Brainのノート整理でフォルダを作る');
    const embCooking = deterministicFallbackEmbedding('余った野菜で朝食レシピを1品作る');
    expect(cosineSimilarity(embObsidian, embSecondBrain)).toBeGreaterThan(
      cosineSimilarity(embObsidian, embCooking) + 0.2
    );
  });

  it('safely parses Gemini JSON responses even with Markdown code fences and extracts readable URL titles', () => {
    const fenced = '```json\n{"title":"カードUIの参考","kind":"SCREENSHOT"}\n```';
    const parsed = parseJsonSafely<{ title: string; kind: string }>(fenced);
    expect(parsed).toEqual({ title: 'カードUIの参考', kind: 'SCREENSHOT' });

    const noisy = 'Here is the JSON:\n{"ask":"今日は1つ描いてみない？","minutes":15}\nThanks!';
    expect(parseJsonSafely<{ ask: string; minutes: number }>(noisy)?.minutes).toBe(15);

    // Instagram 等のランダムIDパス（/p/C12345678/）がそのままタイトルにならないことを検証
    const igTitle = extractReadableTitleFromInput(
      { url: 'https://www.instagram.com/p/C9xyz123/?img_index=1' },
      { fetched: false, domain: 'Instagram', title: '', description: '' }
    );
    expect(igTitle).toBe('Instagramの投稿アイデア');
    expect(igTitle).not.toContain('C9xyz123');

    // Gemini出力の3候補に重複がある場合やResources角度が欠けている場合でも3角度に正規化される
    const norm = normalizeThreeAngleIntents(
      ['カードUIを自分のアプリで試す', 'カードUIを自分のアプリで試す'],
      '丸みのあるカードUI',
      'UIデザインのスクショ'
    );
    expect(norm).toHaveLength(3);
    expect(new Set(norm).size).toBe(3);
    expect(norm[2]).toMatch(/参考資料|残す|眺める/);
  });

  it('executes all backend HTTP API endpoints (/api/health, /api/analyzeItem, /api/confirmItemIntent, /api/nightOrganize, /api/morningPropose)', async () => {
    const health = await invokeBackendMiddleware('GET', '/api/health');
    expect(health.status).toBe(200);
    expect(health.data.ok).toBe(true);

    const analyzeRes = await invokeBackendMiddleware('POST', '/api/analyzeItem', {
      rawText: 'かわいい配色のポスター画像。自分の作品で色の組み合わせを試したい',
      targets: [{ id: 'proj-ui', name: 'アプリのデモ画面制作', kind: 'project' }],
    });
    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.data.resourceTopic).toBe('配色・カラーパレット');
    expect((analyzeRes.data.intents as string[]).length).toBe(3);

    const confirmRes = await invokeBackendMiddleware('POST', '/api/confirmItemIntent', {
      title: 'かわいい配色のポスター画像',
      intent: '「アプリのデモ画面制作」に色の組み合わせを取り入れてみる',
      targets: [{ id: 'proj-ui', name: 'アプリのデモ画面制作', kind: 'project' }],
    });
    expect(confirmRes.status).toBe(200);
    expect((confirmRes.data.embedding as number[]).length).toBe(64);
    expect(
      (confirmRes.data.placementMatch as { targetId: string; confidence: string }).targetId
    ).toBe('proj-ui');

    const nightRes = await invokeBackendMiddleware('POST', '/api/nightOrganize', {
      items: [
        {
          id: 'i1',
          title: 'かわいいホーム画面UI',
          kind: 'SCREENSHOT',
          intent: '自分のアプリのデモ画面に取り入れる',
        },
        {
          id: 'i2',
          title: '丸みのあるカードUI',
          kind: 'SCREENSHOT',
          intent: '自分のアプリのカードデザインに使う',
        },
      ],
      targets: [{ id: 'proj-ui', name: 'アプリのデモ画面制作', kind: 'project' }],
    });
    expect(nightRes.status).toBe(200);
    const bundles = nightRes.data.bundles as Array<{ tool: string; points: string[] }>;
    expect(bundles.length).toBe(1);
    expect(bundles[0].tool).toContain('Figma');

    const morningRes = await invokeBackendMiddleware('POST', '/api/morningPropose', {
      bundle: {
        id: 'b-ui',
        intent: '自分のアプリのデモ画面に取り入れる',
        points: bundles[0].points,
        tool: bundles[0].tool,
        items: [{ title: 'かわいいホーム画面UI', intent: '自分のアプリのデモ画面に取り入れる' }],
      },
      previousStatus: 'none',
      characterName: 'ともり',
    });
    expect(morningRes.status).toBe(200);
    expect(String(morningRes.data.ask)).toContain('おはよう');
  });

  it('evaluates pure domain rules for headline, character bubble, localDate, and target selection (F05)', () => {
    const bubble = computeBubbleText({
      floatingItems: [],
      proposalStatus: 'none',
      activeBundle: null,
      phase: 'day',
      aiBusyLabel: null,
    });
    expect(bubble).toContain('＋ 保存する');

    const pendingBubble = computeBubbleText({
      floatingItems: [],
      proposalStatus: 'none',
      activeBundle: null,
      pendingBundlesCount: 2,
      phase: 'night',
      aiBusyLabel: null,
    });
    expect(pendingBubble).toContain('2つの束ね案');

    const [enTitle, jaSub] = computeHeadline({
      floatingItems: [],
      proposalStatus: 'ready',
      phase: 'morning',
    });
    expect(enTitle).toContain("Today's");
    expect(jaSub).toContain('今日の一歩');

    const dateStr = computeLocalDateString('Asia/Tokyo', Date.UTC(2026, 10, 6, 23, 30, 0));
    expect(dateStr).toBe('2026-11-07');

    // F05: 見るだけ(reference)は提案対象にせず、アクティブなProjectの確定済み保存物を選ぶ
    const selected = selectTargetBundleForToday({
      projects: [
        {
          id: 'proj-1',
          name: 'アプリのデモを完成させる',
          goal: 'ホーム画面と3D島を仕上げる',
          status: 'active',
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      bundles: [],
      items: [
        {
          id: 'item-ref',
          kind: 'PHOTO',
          title: '眺めるだけの風景',
          source: 'カメラロール',
          note: '',
          color: '#000',
          c2: '#111',
          intents: [],
          intent: '参考資料として眺める',
          intentConfirmed: true,
          intentStatus: 'reference',
          para: 'Resources',
          placementId: 'proj-1',
          bundleId: null,
          floating: true,
          createdAt: 3000,
        },
        {
          id: 'item-act',
          kind: 'SCREENSHOT',
          title: 'ホーム画面UIの参考',
          source: 'カメラロール',
          note: '',
          color: '#000',
          c2: '#111',
          intents: [],
          intent: '自分のアプリのデモ画面に取り入れる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementId: 'proj-1',
          bundleId: 'proj-1',
          floating: true,
          createdAt: 2500,
        },
      ],
    });
    expect(selected).not.toBeNull();
    expect(selected?.targetId).toBe('proj-1');
    expect(selected?.itemIds).toEqual(['item-act']);

    const fallbackBundle = buildFallbackBundle([]);
    const fallbackProposal = buildFallbackProposal(fallbackBundle, 'ready');
    expect(fallbackProposal.minutes).toBe(15);
    expect(selectItemsForNightOrganize([])).toHaveLength(0);
  });

  it('honestly marks Instagram URLs as urlFetched=false without pretending to read body (R04/F02)', async () => {
    const out = await runAnalyzeItem(
      {
        url: 'https://www.instagram.com/p/C12345678/',
      },
      ''
    );
    const parsed = AnalyzeItemOutputSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.kind).toBe('INSTAGRAM');
    expect(out.urlFetched).toBe(false);
    expect(out.note).toContain('自動取得できないため');
  });

  it('matches confirmed intent to active Projects / Areas or Resources accurately including semantic domain alignment (F03)', async () => {
    const targets = [
      {
        id: 'proj-demo',
        name: 'ハッカソンのデモ制作',
        goal: '審査員に伝わる3D画面を仕上げる',
        kind: 'project' as const,
      },
      {
        id: 'area-food',
        name: '食事・料理',
        kind: 'area' as const,
      },
    ];

    // 1. 見るだけ・参考 -> resource
    const refMatch = await matchIntentToTargets(
      'かわいいUI画像',
      '参考資料として眺める・残しておく',
      [1, 0, 0],
      targets,
      true,
      ''
    );
    expect(refMatch.targetKind).toBe('resource');

    // 2. 単語の直接一致がなくてもドメイン（UIデザイン→ハッカソンのデモ制作）が合致し、料理Areaと衝突するため proj-demo に明確一致する
    const semanticRes = await runConfirmItemIntent(
      {
        title: '丸みのあるカードUIのスクショ',
        intent: '自分の制作画面でカードの形を1つ試してみる',
        targets,
      },
      ''
    );
    expect(semanticRes.embedding.length).toBeGreaterThan(0);
    expect(semanticRes.placementMatch?.confidence).toBe('clear');
    expect(semanticRes.placementMatch?.targetId).toBe('proj-demo');
  });

  it('clusters similar items into a pending proposal bundle linked to Project/Area during night organize (F5)', async () => {
    const out = await runNightOrganize(
      {
        items: [
          {
            id: '1',
            title: 'Obsidian デスク投稿',
            kind: 'INSTAGRAM',
            intent: 'Obsidianでsecond brainを作ってみる',
          },
          {
            id: '2',
            title: 'PARA入門記事',
            kind: 'ARTICLE',
            intent: 'ObsidianでPARAフォルダを作ってみる',
          },
        ],
        targets: [
          {
            id: 'proj-sb',
            name: 'Second Brainの仕組みを作る',
            goal: 'ObsidianとPARAでノート整理',
            kind: 'project',
          },
        ],
      },
      ''
    );
    const parsed = NightOrganizeOutputSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.bundles.length).toBeGreaterThanOrEqual(1);
    expect(out.bundles[0].itemIds).toContain('1');
    expect(out.bundles[0].itemIds).toContain('2');
    expect(out.bundles[0].approvalStatus).toBe('pending');
    expect(out.bundles[0].tool).toBe('Obsidian');
  });

  it('proposes a smaller step when previousStatus is mada and adapts tone to characterName (F6/F05)', async () => {
    const normal = await runMorningPropose(
      {
        bundle: {
          id: 'b1',
          intent: 'Obsidianでsecond brainを作ってみる',
          points: ['PARAの4フォルダを作る'],
          tool: 'Obsidian',
          items: [{ title: 'PARA入門', intent: 'Obsidianでsecond brainを作ってみる' }],
        },
        previousStatus: 'none',
        characterName: 'ふみ',
      },
      ''
    );
    expect(MorningProposeOutputSchema.safeParse(normal).success).toBe(true);
    expect(normal.ask).toContain('みませんか？');

    const smaller = await runMorningPropose(
      {
        bundle: {
          id: 'b1',
          intent: 'Obsidianでsecond brainを作ってみる',
          points: ['PARAの4フォルダを作る'],
          tool: 'Obsidian',
          items: [{ title: 'PARA入門', intent: 'Obsidianでsecond brainを作ってみる' }],
        },
        previousStatus: 'mada',
        characterName: 'ぽこ',
      },
      ''
    );
    expect(MorningProposeOutputSchema.safeParse(smaller).success).toBe(true);
    expect(smaller.minutes).toBeLessThanOrEqual(normal.minutes);
    expect(smaller.minutes).toBe(5);
  });
});
