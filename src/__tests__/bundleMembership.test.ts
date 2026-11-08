import { describe, expect, it } from 'vitest';
import { archiveItemsOfBundle, isItemInBundle } from '../domain/rules/islandRules';
import type { Bundle, SavedItem } from '../domain/models/islandModels';

function makeItem(patch: Partial<SavedItem> & { id: string }): SavedItem {
  return {
    kind: 'NOTE',
    title: patch.id,
    source: 'メモ',
    note: '',
    color: '#fff',
    c2: '#eee',
    intent: '',
    intentConfirmed: true,
    para: 'Someday',
    bundleId: null,
    floating: true,
    createdAt: 0,
    ...patch,
  } as SavedItem;
}

function makeBundle(patch: Partial<Bundle> & { id: string }): Bundle {
  return {
    intent: '束',
    points: [],
    tool: '',
    itemIds: [],
    para: 'Projects',
    readyForProposal: true,
    buildingLevel: 0,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  } as Bundle;
}

describe('束の所属判定（isItemInBundle）', () => {
  // 所属は itemIds / bundleId / placementId の3通りで表されうる。
  // どれか1つでしか紐づいていない保存物を取りこぼすと「手放す」で島に残る。
  it('item.bundleId だけで紐づいていても属していると判定する', () => {
    const b = makeBundle({ id: 'b1' });
    expect(isItemInBundle(makeItem({ id: 'i1', bundleId: 'b1' }), b)).toBe(true);
  });

  it('bundle.itemIds だけで紐づいていても属していると判定する', () => {
    const b = makeBundle({ id: 'b1', itemIds: ['i1'] });
    expect(isItemInBundle(makeItem({ id: 'i1', bundleId: null }), b)).toBe(true);
  });

  it('item.placementId だけで紐づいていても属していると判定する', () => {
    const b = makeBundle({ id: 'b1' });
    expect(isItemInBundle(makeItem({ id: 'i1', placementId: 'b1' }), b)).toBe(true);
  });

  it('どれとも紐づいていなければ属していないと判定する', () => {
    const b = makeBundle({ id: 'b1', itemIds: ['other'] });
    expect(isItemInBundle(makeItem({ id: 'i1', bundleId: 'b2' }), b)).toBe(false);
  });
});

describe('束のアーカイブ（archiveItemsOfBundle）', () => {
  it('3通りのどの紐づき方でも Archives に移し、島から降ろす', () => {
    const bundle = makeBundle({ id: 'b1', itemIds: ['byItemIds'] });
    const items = [
      makeItem({ id: 'byItemIds', bundleId: null }),
      makeItem({ id: 'byBundleId', bundleId: 'b1' }),
      makeItem({ id: 'byPlacementId', placementId: 'b1' }),
      makeItem({ id: 'unrelated', bundleId: 'b2' }),
    ];

    const next = archiveItemsOfBundle(items, bundle);

    for (const id of ['byItemIds', 'byBundleId', 'byPlacementId']) {
      const it = next.find((x) => x.id === id)!;
      expect(it.para, `${id} が Archives に移っていない`).toBe('Archives');
      expect(it.floating, `${id} が島に浮いたまま`).toBe(false);
    }
    const unrelated = next.find((x) => x.id === 'unrelated')!;
    expect(unrelated.para).toBe('Someday');
    expect(unrelated.floating).toBe(true);
  });

  it('復元できるように previousPara を残す', () => {
    const bundle = makeBundle({ id: 'b1', itemIds: ['i1'] });
    const next = archiveItemsOfBundle([makeItem({ id: 'i1', para: 'Projects' })], bundle);
    expect(next[0].previousPara).toBe('Projects');
  });
});
