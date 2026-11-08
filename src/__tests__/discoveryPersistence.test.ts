import { describe, expect, it } from 'vitest';
import {
  runPersistedDiscoveryCycle,
  type DiscoveryStore,
  type QueuedNotification,
} from '../../functions/src/application/discoveryPersistenceUseCases';
import { CuratedReferenceSearchAdapter } from '../../functions/src/infrastructure/discoverySearchAdapter';
import type {
  ConfirmedSubject,
  DiscoverySettings,
  ResearchJob,
  ResearchReport,
  RunDiscoveryCycleInput,
} from '../../functions/src/domain/proactiveDiscoverySchemas';

function makeBaseSettings(overrides: Partial<DiscoverySettings> = {}): DiscoverySettings {
  return {
    aiConsentGranted: true,
    aiConsentAt: 1700000000000,
    aiConsentVersion: 'v1',
    searchConsentGranted: false,
    searchConsentAt: null,
    searchConsentVersion: 'v1',
    notificationEnabled: false,
    notificationConsentAt: null,
    enabledProjectIds: ['proj_music_live'],
    enabledAreaIds: [],
    budgetLimitUsd: 3.0,
    estimatedUsedUsd: 0.04,
    regionPreference: '東京・関東',
    periodPreference: '2026年11月〜12月',
    timezone: 'Asia/Tokyo',
    quietHoursStart: 22,
    quietHoursEnd: 8,
    dailyReportLimit: 1,
    questionCooldownDays: 3,
    suppressionDaysForNotNow: 14,
    paused: false,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeConfirmedSubject(): ConfirmedSubject {
  return {
    id: 'subj_kotone',
    canonicalName: '蒼井ことね',
    category: 'artist',
    disambiguationHint: 'クラシックギター・シンガーソングライター（潮の記譜）',
    officialUrl: 'https://example.com/aoi-kotone/',
    frequency: 'often',
    confirmationState: 'confirmed',
    source: 'manual_input',
    projectId: 'proj_music_live',
    updatedAt: 1700000000000,
  };
}

function makeInput(overrides: Partial<RunDiscoveryCycleInput> = {}): RunDiscoveryCycleInput {
  return {
    uid: 'uid_test',
    localDate: '2026-11-07',
    currentHour: 10,
    settings: makeBaseSettings({ searchConsentGranted: true }),
    projects: [{ id: 'proj_music_live', name: '冬に行きたい音楽ライブ', status: 'active' }],
    areas: [],
    confirmedSubjects: [makeConfirmedSubject()],
    curatedSources: [],
    previousFeedbacks: [],
    alreadyNotifiedDedupeKeys: [],
    ...overrides,
  };
}

// Firestore を使わずに永続化の振る舞いだけを固定するための擬似ストア。
// settingsSequence は「読むたびに変わる同意状態」を再現する（最後の値が以降くり返される）。
function makeFakeStore(initial?: {
  settingsSequence?: Array<Partial<DiscoverySettings> | null>;
  reports?: ResearchReport[];
  jobs?: ResearchJob[];
}) {
  const reports: ResearchReport[] = [...(initial?.reports || [])];
  const jobs: ResearchJob[] = [...(initial?.jobs || [])];
  const outbox: QueuedNotification[] = [];
  const sequence = initial?.settingsSequence || [null];
  const calls = { saveJob: 0, saveReport: 0, getSettings: 0 };

  const store: DiscoveryStore = {
    async getDiscoverySettings() {
      const idx = Math.min(calls.getSettings, sequence.length - 1);
      calls.getSettings += 1;
      return sequence[idx];
    },
    async getLatestReportForDate(_uid, localDate) {
      return (
        reports
          .filter((r) => r.localDate === localDate)
          .sort((a, b) => b.executedAt - a.executedAt)[0] || null
      );
    },
    async getJobForPeriod(_uid, localDate) {
      return (
        jobs
          .filter((j) => j.periodKey === localDate)
          .sort((a, b) => b.startedAt - a.startedAt)[0] || null
      );
    },
    async listRecentDedupeKeys() {
      return reports
        .map((r) => r.card?.dedupeKey)
        .filter((k): k is string => Boolean(k));
    },
    async saveJob(_uid, job) {
      calls.saveJob += 1;
      const idx = jobs.findIndex((j) => j.jobId === job.jobId);
      if (idx >= 0) jobs[idx] = job;
      else jobs.push(job);
    },
    async saveReport(_uid, report) {
      calls.saveReport += 1;
      const idx = reports.findIndex((r) => r.id === report.id);
      if (idx >= 0) reports[idx] = report;
      else reports.push(report);
    },
    async enqueueNotification(_uid, notification) {
      outbox.push(notification);
    },
  };

  return { store, reports, jobs, outbox, calls };
}

describe('能動発見のサーバー永続化（researchJobs / researchReports / notificationOutbox）', () => {
  it('結果を保存し、同じ現地日付で2回走らせてもレポートは1件のまま（冪等）', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    const fake = makeFakeStore({
      settingsSequence: [{ searchConsentGranted: true, notificationEnabled: false }],
    });

    const first = await runPersistedDiscoveryCycle(makeInput(), fake.store, {
      searchAdapter: adapter,
    });
    expect(first.report.status).toBe('card_ready');
    expect(fake.reports).toHaveLength(1);
    expect(fake.jobs).toHaveLength(1);
    expect(fake.calls.saveReport).toBe(1);

    const second = await runPersistedDiscoveryCycle(makeInput(), fake.store, {
      searchAdapter: adapter,
    });

    // 保存済みの当日レポートに収束し、同じ doc を2件に増やさない
    expect(second.report.id).toBe(first.report.id);
    expect(fake.reports).toHaveLength(1);
    expect(fake.calls.saveReport).toBe(1);
    // 2回目は外部検索を呼び直さない
    expect(adapter.callCount).toBe(1);
    expect(second.externalSearchCalls).toBe(0);
  });

  it('サーバー保存の同意がOFFなら、クライアントがONを申告しても外部検索はゼロ', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    const fake = makeFakeStore({
      settingsSequence: [{ searchConsentGranted: false }],
    });

    const res = await runPersistedDiscoveryCycle(
      makeInput({ settings: makeBaseSettings({ searchConsentGranted: true }) }),
      fake.store,
      { searchAdapter: adapter }
    );

    expect(adapter.callCount).toBe(0);
    expect(res.externalSearchCalls).toBe(0);
    expect(res.report.status).toBe('search_off');
    expect(res.report.card).toBeNull();
    expect(fake.outbox).toHaveLength(0);
  });

  it('公開直前に同意が撤回されていたら、発見カードを公開せず通知も積まない', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    // 1回目の読み取りは同意あり、公開直前の再確認では撤回済み
    const fake = makeFakeStore({
      settingsSequence: [
        { searchConsentGranted: true, notificationEnabled: true },
        { searchConsentGranted: false, notificationEnabled: true },
      ],
    });

    const res = await runPersistedDiscoveryCycle(makeInput(), fake.store, {
      searchAdapter: adapter,
    });

    expect(res.report.card).toBeNull();
    expect(res.report.notificationState).toBe('skipped_consent_off');
    expect(fake.outbox).toHaveLength(0);
    // 中止したことは記録として残す（カードは無いので中身は公開されない）
    expect(fake.reports).toHaveLength(1);
    expect(fake.reports[0].card).toBeNull();
  });

  it('通知ONかつ静音時間外でカードが出たときだけ、連絡箱宛の通知を1件積む', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    const fake = makeFakeStore({
      settingsSequence: [{ searchConsentGranted: true, notificationEnabled: true }],
    });

    const res = await runPersistedDiscoveryCycle(makeInput({ currentHour: 10 }), fake.store, {
      searchAdapter: adapter,
    });

    expect(res.report.status).toBe('card_ready');
    expect(fake.outbox).toHaveLength(1);
    expect(fake.outbox[0].channel).toBe('inbox');
    expect(fake.outbox[0].status).toBe('queued');
    // 到達は保証しない。送ると決めた記録まで
    expect(fake.outbox[0].deliveredAt).toBeNull();
    // A04: Project 名・人物名・検索語を文面に出さない
    const text = `${fake.outbox[0].title}${fake.outbox[0].body}`;
    expect(text).not.toContain('冬に行きたい音楽ライブ');
    expect(text).not.toContain('蒼井ことね');
  });

  it('静音時間内は通知を積まない（レポートは保存する）', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    const fake = makeFakeStore({
      settingsSequence: [{ searchConsentGranted: true, notificationEnabled: true }],
    });

    const res = await runPersistedDiscoveryCycle(makeInput({ currentHour: 23 }), fake.store, {
      searchAdapter: adapter,
    });

    expect(res.report.notificationState).toBe('skipped_quiet_hours');
    expect(fake.outbox).toHaveLength(0);
    expect(fake.reports).toHaveLength(1);
  });

  it('リースが生きているジョブがあるとき、完了済みレポートを合成レポートで上書きしない', async () => {
    const adapter = new CuratedReferenceSearchAdapter();
    const nowMs = 1700000000000;
    const fake = makeFakeStore({
      settingsSequence: [{ searchConsentGranted: true }],
      jobs: [
        {
          jobId: 'job_uid_test_2026-11-07_proj_music_live_concert_discovery',
          uid: 'uid_test',
          projectId: 'proj_music_live',
          periodKey: '2026-11-07',
          kind: 'concert_discovery',
          status: 'claimed',
          leaseUntil: nowMs + 120000,
          attempt: 1,
          startedAt: nowMs,
          completedAt: null,
          failureCode: null,
          settingsVersion: 'v1',
        },
      ],
    });

    const res = await runPersistedDiscoveryCycle(makeInput(), fake.store, {
      searchAdapter: adapter,
      nowMs,
    });

    expect(adapter.callCount).toBe(0);
    expect(res.report.status).toBe('paused_or_no_project');
    expect(fake.calls.saveReport).toBe(0);
    expect(fake.calls.saveJob).toBe(0);
    expect(fake.outbox).toHaveLength(0);
  });
});
