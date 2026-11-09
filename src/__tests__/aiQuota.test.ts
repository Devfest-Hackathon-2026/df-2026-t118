import { describe, expect, it, vi } from 'vitest';
import {
  checkAndConsumeAiQuota,
  describeQuotaRejection,
  estimateFlowCost,
  formatQuotaDate,
  DEFAULT_GLOBAL_DAILY_LIMIT,
  DEFAULT_USER_DAILY_LIMIT,
  NIGHT_ORGANIZE_COST_CAP,
  type AiQuotaGuardConfig,
  type AiQuotaStore,
} from '../../functions/src/application/aiQuotaUseCases';

// Firestore を使わずに判定だけを固定する。
// 実装（createFirestoreAiQuotaStore）は admin SDK に依存するため、ここでは注入で代用する。
function makeStore(
  initial: {
    config?: AiQuotaGuardConfig | null;
    userUsed?: Record<string, number>;
    globalUsed?: Record<string, number>;
  } = {}
) {
  const userUsed: Record<string, number> = { ...(initial.userUsed || {}) };
  const globalUsed: Record<string, number> = { ...(initial.globalUsed || {}) };

  const store: AiQuotaStore = {
    async getGuardConfig() {
      return initial.config ?? null;
    },
    async consumeUserDaily(uid, localDate, cost) {
      const key = `${uid}/${localDate}`;
      userUsed[key] = (userUsed[key] || 0) + cost;
      return userUsed[key];
    },
    async getGlobalDaily(localDate) {
      return globalUsed[localDate] || 0;
    },
    async addGlobalDaily(localDate, cost) {
      globalUsed[localDate] = (globalUsed[localDate] || 0) + cost;
    },
  };

  return { store, userUsed, globalUsed };
}

const BASE = { uid: 'u1', flowName: 'analyzeItem', localDate: '2026-11-09' };

describe('AI クォータの判定', () => {
  it('上限内なら通し、使用量を進める', async () => {
    const { store, userUsed, globalUsed } = makeStore();

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision).toEqual({ allowed: true, usedAfter: 1 });
    expect(userUsed['u1/2026-11-09']).toBe(1);
    expect(globalUsed['2026-11-09']).toBe(1);
  });

  it('ユーザーごとの日次上限を超えたら拒否する', async () => {
    const { store } = makeStore({
      userUsed: { 'u1/2026-11-09': DEFAULT_USER_DAILY_LIMIT },
    });

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision).toEqual({ allowed: false, reason: 'user_daily' });
  });

  it('弾いた呼び出しでは全体の天井を削らない', async () => {
    const { store, globalUsed } = makeStore({
      userUsed: { 'u1/2026-11-09': DEFAULT_USER_DAILY_LIMIT },
    });

    await checkAndConsumeAiQuota(BASE, store);

    expect(globalUsed['2026-11-09']).toBeUndefined();
  });

  it('全体の日次上限を超えたら、ユーザーのカウンタを進めずに拒否する', async () => {
    const { store, userUsed } = makeStore({
      globalUsed: { '2026-11-09': DEFAULT_GLOBAL_DAILY_LIMIT },
    });

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision).toEqual({ allowed: false, reason: 'global_daily' });
    expect(userUsed['u1/2026-11-09']).toBeUndefined();
  });

  it('キルスイッチが入っていたら、上限に関係なく拒否する', async () => {
    const { store, userUsed, globalUsed } = makeStore({ config: { disabled: true } });

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision).toEqual({ allowed: false, reason: 'killswitch' });
    expect(userUsed['u1/2026-11-09']).toBeUndefined();
    expect(globalUsed['2026-11-09']).toBeUndefined();
  });

  it('設定ドキュメントの上限がコードの既定値を上書きする', async () => {
    const { store } = makeStore({
      config: { userDailyLimit: 2 },
      userUsed: { 'u1/2026-11-09': 2 },
    });

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision).toEqual({ allowed: false, reason: 'user_daily' });
  });

  it('上限が 0 や負数でも全停止しない（止めるのは disabled だけ）', async () => {
    const { store } = makeStore({ config: { userDailyLimit: 0, globalDailyLimit: -1 } });

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision.allowed).toBe(true);
  });

  it('日付が変わると別のカウンタになり、前日ぶんを持ち越さない', async () => {
    const { store } = makeStore({
      userUsed: { 'u1/2026-11-09': DEFAULT_USER_DAILY_LIMIT },
    });

    const decision = await checkAndConsumeAiQuota({ ...BASE, localDate: '2026-11-10' }, store);

    expect(decision.allowed).toBe(true);
  });

  it('ストアが落ちても通す（フェイルオープン）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store: AiQuotaStore = {
      async getGuardConfig() {
        throw new Error('firestore unavailable');
      },
      async consumeUserDaily() {
        return 0;
      },
      async getGlobalDaily() {
        return 0;
      },
      async addGlobalDaily() {},
    };

    const decision = await checkAndConsumeAiQuota(BASE, store);

    expect(decision.allowed).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('フローごとのコスト', () => {
  it('単発のフローは 1、能動発見は 2 として数える', () => {
    expect(estimateFlowCost('analyzeItem', {})).toBe(1);
    expect(estimateFlowCost('confirmItemIntent', {})).toBe(1);
    expect(estimateFlowCost('morningPropose', {})).toBe(1);
    expect(estimateFlowCost('runDiscoveryCycle', {})).toBe(2);
  });

  it('夜の整理は保存物の件数に比例する（埋め込みを件数ぶん呼ぶため）', () => {
    expect(estimateFlowCost('nightOrganize', { items: [] })).toBe(1);
    expect(estimateFlowCost('nightOrganize', { items: new Array(5).fill({}) })).toBe(6);
  });

  it('夜の整理のコストは実処理の上限で頭打ちになる', () => {
    const cost = estimateFlowCost('nightOrganize', { items: new Array(500).fill({}) });

    expect(cost).toBe(1 + NIGHT_ORGANIZE_COST_CAP);
  });

  it('items が配列でなくても落ちない', () => {
    expect(estimateFlowCost('nightOrganize', { items: 'ずるい入力' })).toBe(1);
    expect(estimateFlowCost('nightOrganize', null)).toBe(1);
  });
});

describe('クォータの日付', () => {
  it('日本時間で日付を切る（UTC では前日でも JST の当日になる）', () => {
    // 2026-11-09T16:30:00Z = 2026-11-10 01:30 JST
    const nowMs = Date.parse('2026-11-09T16:30:00Z');

    expect(formatQuotaDate(nowMs)).toBe('2026-11-10');
  });
});

describe('拒否理由の説明', () => {
  it('ログに出す理由が理由ごとに違う', () => {
    const reasons = (['killswitch', 'user_daily', 'global_daily'] as const).map(
      describeQuotaRejection
    );

    expect(new Set(reasons).size).toBe(3);
  });
});
