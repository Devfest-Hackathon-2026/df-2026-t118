import { describe, expect, it } from 'vitest';
import {
  buildBundleDocument,
  buildProposalDocument,
} from '../../functions/src/domain/firestoreDocuments';
import type { BundleDraft } from '../../functions/src/domain/schemas';
import type { Bundle, Proposal } from '../domain/models/islandModels';

function makeDraft(overrides: Partial<BundleDraft> = {}): BundleDraft {
  return {
    intent: 'ベランダ栽培をはじめる',
    points: ['土と鉢を用意する', '日当たりを測る', 'バジルの苗を買う'],
    tool: 'プランター',
    itemIds: ['item_1', 'item_2'],
    para: 'Projects',
    readyForProposal: true,
    targetId: 'proj_balcony',
    targetName: 'ベランダ栽培',
    approvalStatus: 'pending',
    ...overrides,
  };
}

describe('定時バッチが書くドキュメントの形', () => {
  it('束は Bundle 型をそのまま満たす（id と buildingLevel が入る）', () => {
    const nowMs = 1700000000000;
    // 型注釈が本体。Bundle に必須フィールドが増えたらここで型検査が落ちる
    const bundle: Bundle = buildBundleDocument(makeDraft(), 'bundle_abc', nowMs);

    expect(bundle.id).toBe('bundle_abc');
    // 未設定だと振り返り（F8）の buildingLevel + 1 が NaN になる
    expect(bundle.buildingLevel).toBe(0);
    expect(bundle.createdAt).toBe(nowMs);
    expect(bundle.updatedAt).toBe(nowMs);
    expect(bundle.itemIds).toEqual(['item_1', 'item_2']);
  });

  it('束は doc id を捨てて読んでも id が残る（クライアントの読み方に合わせる）', () => {
    const doc = buildBundleDocument(makeDraft(), 'bundle_abc', 1700000000000);
    // firestoreRepository.loadFromFirestore は d.data() を読む。
    // JSON 往復で doc id が失われても id が残っていることを固定する
    const roundTripped = JSON.parse(JSON.stringify(doc)) as Bundle;

    expect(roundTripped.id).toBe('bundle_abc');
    // items.bundleId との突合が成立する
    expect(roundTripped.itemIds.every((i) => i.length > 0)).toBe(true);
  });

  it('承認状態を省いた束は pending として書かれる（朝の提案が勝手に承認済みにしない）', () => {
    const doc = buildBundleDocument(
      makeDraft({ approvalStatus: undefined }),
      'bundle_abc',
      1700000000000
    );
    expect(doc.approvalStatus).toBe('pending');
  });

  it('提案は Proposal 型をそのまま満たし、activeProposalId と同じ id を持つ', () => {
    const nowMs = 1700000000000;
    const proposal: Proposal = buildProposalDocument({
      id: 'prop_xyz',
      bundleId: 'bundle_abc',
      localDate: '2026-11-09',
      timezone: 'Asia/Tokyo',
      step: {
        ask: '今日は、ベランダ栽培を始めてみない？',
        title: 'バジルの苗を見にいく',
        detail: '近所の園芸店で苗を1つ選ぶ',
        minutes: 15,
      },
      nowMs,
    });

    // users/{uid}.activeProposalId に入るのと同じ ID が中身にもある。
    // ここが一致しないと proposals.find(p => p.id === activeProposalId) が永久に外れる
    expect(proposal.id).toBe('prop_xyz');
    expect(proposal.bundleId).toBe('bundle_abc');
    expect(proposal.localDate).toBe('2026-11-09');
    expect(proposal.timezoneAtCreation).toBe('Asia/Tokyo');
    expect(proposal.status).toBe('ready');
    expect(proposal.createdAt).toBe(nowMs);
  });

  it('提案は localDate を必ず持つ（1日1提案の冪等判定に使われる）', () => {
    const doc = buildProposalDocument({
      id: 'prop_xyz',
      bundleId: 'bundle_abc',
      localDate: '2026-11-09',
      timezone: 'Asia/Tokyo',
      step: { ask: 'a', title: 't', detail: 'd', minutes: 10 },
      nowMs: 1700000000000,
    });
    // hasProposalForLocalDate が where('localDate','==',...) で引く
    expect(doc.localDate).toBe('2026-11-09');
  });
});
