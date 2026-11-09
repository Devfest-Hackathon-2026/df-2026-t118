import { describe, expect, it } from 'vitest';
import {
  selectBundleForMorningProposal,
  type ProposalCandidateBundle,
} from '../../functions/src/domain/proposalSelection';

function makeBundle(
  overrides: Partial<ProposalCandidateBundle> & { id: string }
): ProposalCandidateBundle {
  return {
    para: 'Projects',
    readyForProposal: true,
    approvalStatus: 'approved',
    buildingLevel: 0,
    itemIds: ['item_1', 'item_2'],
    targetId: null,
    ...overrides,
  };
}

describe('朝の提案で選ぶ束（F6）', () => {
  it('承認済みでまだ建っていない Projects 束を最優先する', () => {
    const chosen = selectBundleForMorningProposal(
      [
        makeBundle({ id: 'b_area', para: 'Areas' }),
        makeBundle({ id: 'b_pending', approvalStatus: 'pending' }),
        makeBundle({ id: 'b_ready' }),
      ],
      []
    );
    expect(chosen?.id).toBe('b_ready');
  });

  it('承認済みが無ければ未承認の Projects 束にフォールバックする（フロントと同じ順序）', () => {
    const chosen = selectBundleForMorningProposal(
      [
        makeBundle({ id: 'b_area', para: 'Areas' }),
        makeBundle({ id: 'b_pending', approvalStatus: 'pending' }),
      ],
      []
    );
    expect(chosen?.id).toBe('b_pending');
  });

  it('Projects が無ければアイテムを持つ Areas 束を選ぶ', () => {
    const chosen = selectBundleForMorningProposal(
      [
        makeBundle({ id: 'b_area_empty', para: 'Areas', itemIds: [] }),
        makeBundle({ id: 'b_area', para: 'Areas' }),
      ],
      []
    );
    expect(chosen?.id).toBe('b_area');
  });

  it('紐づけ先が archived になった束は対象から外す（F6: アクティブな Project / Area）', () => {
    const chosen = selectBundleForMorningProposal(
      [
        makeBundle({ id: 'b_archived_target', targetId: 'proj_old' }),
        makeBundle({ id: 'b_active_target', targetId: 'proj_now' }),
      ],
      ['proj_now']
    );
    expect(chosen?.id).toBe('b_active_target');
  });

  it('紐づけ先が無い束はアクティブ判定を素通りする', () => {
    const chosen = selectBundleForMorningProposal(
      [makeBundle({ id: 'b_unbound', targetId: null })],
      ['proj_now']
    );
    expect(chosen?.id).toBe('b_unbound');
  });

  it('Archives・Resources・Someday は提案の題材にしない', () => {
    for (const para of ['Archives', 'Resources', 'Someday']) {
      const chosen = selectBundleForMorningProposal(
        [makeBundle({ id: `b_${para}`, para })],
        []
      );
      expect(chosen).toBeNull();
    }
  });

  it('readyForProposal が立っていない束は選ばない（意図未確定の束は対象外）', () => {
    const chosen = selectBundleForMorningProposal(
      [makeBundle({ id: 'b_not_ready', readyForProposal: false })],
      []
    );
    expect(chosen).toBeNull();
  });

  it('すべて archived な紐づけ先なら提案を出さない', () => {
    const chosen = selectBundleForMorningProposal(
      [makeBundle({ id: 'b1', targetId: 'proj_old' })],
      ['proj_now']
    );
    expect(chosen).toBeNull();
  });
});
