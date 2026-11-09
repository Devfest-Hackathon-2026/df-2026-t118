import { describe, expect, it } from 'vitest';
import type { Bundle, Proposal, SavedItem } from '../domain/models/islandModels';
import { computeBubbleText, computeHomeActions } from '../domain/rules/islandRules';

const TODAY = '2026-11-10';

function makeItem(id: string, overrides: Partial<SavedItem> = {}): SavedItem {
  return {
    id,
    kind: 'NOTE',
    title: `保存物 ${id}`,
    source: 'test',
    note: '',
    color: '#fff',
    c2: '#eee',
    intents: [],
    intent: `やりたいこと ${id}`,
    intentConfirmed: true,
    intentStatus: 'confirmed',
    para: 'Someday',
    bundleId: null,
    floating: true,
    createdAt: 0,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    id: 'b1',
    intent: '束',
    points: [],
    tool: '道具',
    itemIds: ['a'],
    para: 'Projects',
    readyForProposal: true,
    buildingLevel: 0,
    approvalStatus: 'approved',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p1',
    bundleId: 'b1',
    localDate: TODAY,
    ask: '',
    title: '',
    detail: '',
    minutes: 15,
    status: 'ready',
    createdAt: 0,
    ...overrides,
  };
}

const base = {
  items: [] as SavedItem[],
  bundles: [] as Bundle[],
  projects: [],
  proposals: [] as Proposal[],
  proposalStatus: 'none' as const,
  todayLocal: TODAY,
};

// #33: 束ねる・今日の一歩は常時ボタンにせず、意味がある日だけドックに出す
describe('computeHomeActions', () => {
  it('何もない島では、どちらの入口も出さない', () => {
    expect(computeHomeActions(base)).toEqual({ canBundle: false, canPropose: false });
  });

  it('束ねられる保存物が2件あれば「まとめる」を出す', () => {
    const items = [makeItem('a'), makeItem('b')];
    expect(computeHomeActions({ ...base, items }).canBundle).toBe(true);
  });

  it('見るだけ・参考の保存物は束ねる数に入れない', () => {
    const items = [makeItem('a'), makeItem('b', { intentStatus: 'reference' })];
    expect(computeHomeActions({ ...base, items }).canBundle).toBe(false);
  });

  it('提案できる束があれば「今日の一歩」を出す', () => {
    expect(computeHomeActions({ ...base, bundles: [makeBundle()] }).canPropose).toBe(true);
  });

  it('今日の提案がすでにあれば、もう出さない（1日1件）', () => {
    const r = computeHomeActions({
      ...base,
      bundles: [makeBundle()],
      proposals: [makeProposal({ status: 'skipped' })],
    });
    expect(r.canPropose).toBe(false);
  });

  it('昨日の提案しかなければ、今日は出す', () => {
    const r = computeHomeActions({
      ...base,
      bundles: [makeBundle()],
      proposals: [makeProposal({ localDate: '2026-11-09' })],
    });
    expect(r.canPropose).toBe(true);
  });

  it('見送った・手放した直後は出さない', () => {
    for (const proposalStatus of ['skipped', 'released', 'ready', 'doing'] as const) {
      const r = computeHomeActions({ ...base, bundles: [makeBundle()], proposalStatus });
      expect(r.canPropose).toBe(false);
    }
  });

  it('Archives の束しかなければ出さない', () => {
    const r = computeHomeActions({ ...base, bundles: [makeBundle({ para: 'Archives' })] });
    expect(r.canPropose).toBe(false);
  });
});

describe('computeBubbleText の入口の一言', () => {
  const common = { floatingItems: [], proposalStatus: 'none' as const, phase: 'day' as const };

  it('ボタンの名前（束ねる（夜）など）を文中に出さない', () => {
    const texts = [
      computeBubbleText({ ...common, canBundle: true }),
      computeBubbleText({ ...common, canPropose: true }),
      computeBubbleText({ ...common, floatingItems: [makeItem('a'), makeItem('b')] }),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/束ねる（夜）|今日の一歩（朝）/);
    }
  });
});
