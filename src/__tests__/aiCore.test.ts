import { describe, expect, it } from 'vitest';
import {
  runAnalyzeItem,
  runConfirmItemIntent,
  runMorningPropose,
  runNightOrganize,
} from '../../functions/src/application/aiUseCases';
import { cosineSimilarity } from '../../functions/src/domain/clustering';
import {
  AnalyzeItemOutputSchema,
  MorningProposeOutputSchema,
  NightOrganizeOutputSchema,
} from '../../functions/src/domain/schemas';
import {
  buildFallbackBundle,
  buildFallbackProposal,
  computeBubbleText,
  computeHeadline,
  selectItemsForNightOrganize,
} from '../domain/rules/islandRules';

describe('AI Pipeline & Domain Rules (4-Layer Architecture)', () => {
  it('computes cosine similarity accurately', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it('evaluates pure domain rules for headline, character bubble, and night selection', () => {
    const bubble = computeBubbleText({
      floatingItems: [],
      proposalStatus: 'none',
      activeBundle: null,
      phase: 'day',
      aiBusyLabel: null,
    });
    expect(bubble).toContain('＋ 保存する');

    const [enTitle, jaSub] = computeHeadline({
      floatingItems: [],
      proposalStatus: 'ready',
      phase: 'morning',
    });
    expect(enTitle).toContain("Today's");
    expect(jaSub).toContain('今日の一歩');

    const fallbackBundle = buildFallbackBundle([]);
    const fallbackProposal = buildFallbackProposal(fallbackBundle, 'ready');
    expect(fallbackProposal.minutes).toBe(15);
    expect(selectItemsForNightOrganize([])).toHaveLength(0);
  });

  it('analyzes item and returns 3 valid intent candidates matching Zod schema (F2/F3)', async () => {
    const out = await runAnalyzeItem(
      {
        url: 'https://note.com/example/n/obsidian_para',
        rawText: 'ObsidianとPARAでノートを整理する方法',
      },
      '' // キーなし時のフォールバック検証
    );
    const parsed = AnalyzeItemOutputSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.intents).toHaveLength(3);
    expect(out.kind).toBe('ARTICLE');
  });

  it('computes deterministic or Gemini embedding on intent confirmation (F3)', async () => {
    const res = await runConfirmItemIntent(
      {
        title: 'Obsidian デスク',
        intent: 'Obsidianでsecond brainを作ってみる',
      },
      ''
    );
    expect(res.embedding.length).toBeGreaterThan(0);
  });

  it('clusters similar items into a bundle during night organize (F5)', async () => {
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
      },
      ''
    );
    const parsed = NightOrganizeOutputSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.bundles.length).toBeGreaterThanOrEqual(1);
    expect(out.bundles[0].itemIds).toContain('1');
    expect(out.bundles[0].itemIds).toContain('2');
  });

  it('proposes a smaller step when previousStatus is mada (F6)', async () => {
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
      },
      ''
    );
    expect(MorningProposeOutputSchema.safeParse(normal).success).toBe(true);

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
      },
      ''
    );
    expect(MorningProposeOutputSchema.safeParse(smaller).success).toBe(true);
    expect(smaller.minutes).toBeLessThanOrEqual(normal.minutes);
  });
});
