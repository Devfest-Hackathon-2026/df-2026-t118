import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalyzeItemInputSchema,
  ConfirmIntentInputSchema,
  MorningProposeInputSchema,
  NightOrganizeInputSchema,
  NIGHT_ORGANIZE_ITEM_LIMIT,
} from '../../functions/src/domain/schemas';

// Gemini を呼ばずに「何回呼ぼうとしたか」だけを数える。
// 無制限の Promise.all に戻ってしまったときに、このテストが気づけるようにしている。
const computeEmbedding = vi.fn(async () => [0.1, 0.2, 0.3]);
const callGeminiJson = vi.fn(async () => null);

vi.mock('../../functions/src/infrastructure/geminiClient', () => ({
  computeEmbedding: (...args: unknown[]) => computeEmbedding(...(args as [])),
  callGeminiJson: (...args: unknown[]) => callGeminiJson(...(args as [])),
  parseJsonSafely: () => null,
}));

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `保存物 ${i}`,
    kind: 'ARTICLE',
    intent: '参考にする',
  }));
}

describe('入力の上限（イシュー #38）', () => {
  it('正常な入力はそのまま通る', () => {
    const parsed = NightOrganizeInputSchema.safeParse({
      items: makeItems(40),
      targets: [{ id: 'p1', name: 'ポートフォリオ', kind: 'project' }],
    });

    expect(parsed.success).toBe(true);
  });

  it('保存物の件数が上限を超えたら弾く', () => {
    const ok = NightOrganizeInputSchema.safeParse({ items: makeItems(NIGHT_ORGANIZE_ITEM_LIMIT) });
    const tooMany = NightOrganizeInputSchema.safeParse({
      items: makeItems(NIGHT_ORGANIZE_ITEM_LIMIT + 1),
    });

    expect(ok.success).toBe(true);
    expect(tooMany.success).toBe(false);
  });

  it('画像は正規クライアントの縮小後サイズを通し、巨大なものは弾く', () => {
    // 長辺 900px に縮小した PNG は実測 1〜2MB 相当
    const realistic = `data:image/png;base64,${'A'.repeat(2_000_000)}`;
    const abusive = `data:image/png;base64,${'A'.repeat(4_000_000)}`;

    expect(AnalyzeItemInputSchema.safeParse({ imageDataUrl: realistic }).success).toBe(true);
    expect(AnalyzeItemInputSchema.safeParse({ imageDataUrl: abusive }).success).toBe(false);
  });

  it('本文・URL・ターゲット数にも上限がある', () => {
    expect(AnalyzeItemInputSchema.safeParse({ rawText: 'あ'.repeat(50_001) }).success).toBe(false);
    expect(AnalyzeItemInputSchema.safeParse({ url: `https://e.com/${'a'.repeat(2_048)}` }).success).toBe(
      false
    );
    expect(
      AnalyzeItemInputSchema.safeParse({
        targets: Array.from({ length: 51 }, (_, i) => ({
          id: `t${i}`,
          name: 'a',
          kind: 'project' as const,
        })),
      }).success
    ).toBe(false);
  });

  it('意図確定と朝の提案にも上限がある', () => {
    expect(
      ConfirmIntentInputSchema.safeParse({ title: 'a', intent: 'あ'.repeat(501) }).success
    ).toBe(false);
    expect(
      MorningProposeInputSchema.safeParse({
        bundle: {
          id: 'b1',
          intent: 'a',
          points: ['a', 'b'],
          tool: 'a',
          items: makeItems(NIGHT_ORGANIZE_ITEM_LIMIT + 1).map((it) => ({
            title: it.title,
            intent: it.intent,
          })),
        },
      }).success
    ).toBe(false);
  });

  it('埋め込みのベクトルの長さにも上限がある', () => {
    const parsed = NightOrganizeInputSchema.safeParse({
      items: [{ ...makeItems(1)[0], embedding: new Array(3073).fill(0) }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe('夜の整理が実際に回す量', () => {
  beforeEach(() => {
    computeEmbedding.mockClear();
    callGeminiJson.mockClear();
  });

  it('スキーマの上限いっぱいを渡されても、埋め込みの呼び出しは実処理の上限で止まる', async () => {
    const { runNightOrganize, NIGHT_ORGANIZE_ITEM_CAP } = await import(
      '../../functions/src/application/aiUseCases'
    );

    await runNightOrganize({ items: makeItems(NIGHT_ORGANIZE_ITEM_LIMIT) });

    expect(computeEmbedding).toHaveBeenCalledTimes(NIGHT_ORGANIZE_ITEM_CAP);
  });

  it('埋め込み済みの保存物には Gemini を呼ばない', async () => {
    const { runNightOrganize } = await import('../../functions/src/application/aiUseCases');

    await runNightOrganize({
      items: makeItems(6).map((it) => ({ ...it, embedding: [0.1, 0.2, 0.3] })),
    });

    expect(computeEmbedding).not.toHaveBeenCalled();
  });
});
