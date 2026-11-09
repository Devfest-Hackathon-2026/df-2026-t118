import { describe, expect, it } from 'vitest';
import { buildUseCasePersonaPresets } from '../domain/constants/islandConstants';
import type { SavedItem } from '../domain/models/islandModels';
import { toIslandCard } from '../presentation/canvas/IslandCanvas';

const item: SavedItem = {
  id: 'a',
  kind: 'ARTICLE',
  title: '学習ツールの利用統計',
  source: 'example.com',
  note: '',
  color: '#fff',
  c2: '#eee',
  intents: [],
  intent: '見るだけ・参考（学習ツールの統計）',
  intentConfirmed: true,
  intentStatus: 'reference',
  para: 'Resources',
  bundleId: null,
  floating: true,
  createdAt: 0,
};

// #46: ステッカー（島のカード）を見て中身がわかるようにする
describe('島のカードのラベル', () => {
  it('意図の文ではなく、保存物のタイトルを出す', () => {
    expect(toIslandCard(item).title).toBe('学習ツールの利用統計');
  });

  it('意図が未確定のカードは「？」のまま（タイトルを出さない）', () => {
    expect(toIslandCard({ ...item, intentConfirmed: false })).toMatchObject({ unknown: true });
  });
});

describe('デモ用プリセット', () => {
  const presets = buildUseCasePersonaPresets('2026-11-10');
  // 色の #rrggbb は除き、「#23」のような番号だけを探す
  const issueNo = /#\d{1,2}(?![0-9a-fA-F])/;

  it('表示する文言（ラベル・バッジ・タイトル・メモ）にイシュー番号を出さない', () => {
    for (const p of presets) {
      expect(p.label, p.id).not.toMatch(issueNo);
      expect(p.badge, p.id).not.toMatch(issueNo);
      for (const it of p.items) {
        expect(it.title, it.id).not.toMatch(issueNo);
        expect(it.rawText || '', it.id).not.toMatch(issueNo);
        expect(it.note, it.id).not.toMatch(issueNo);
      }
    }
  });

  it('4つのプリセットが保存物つきで読み込める', () => {
    expect(presets).toHaveLength(4);
    for (const p of presets) expect(p.items.length).toBeGreaterThan(0);
  });
});
