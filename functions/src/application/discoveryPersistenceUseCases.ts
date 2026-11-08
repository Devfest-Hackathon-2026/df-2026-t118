// 能動発見（A01〜A04）の実行結果をサーバー側に残す層。
//
// runProactiveDiscoveryCycle は純粋関数で、ブラウザからも直接 import している
// （src/infrastructure/ai/aiFlowClient.ts のローカルフォールバック）。そこに
// firebase-admin を持ち込むとフロントのバンドルが壊れるため、永続化はこの外側の層に置き、
// Firestore へのアクセスは DiscoveryStore として注入する。
//
// この層が埋めている穴:
//  - researchJobs / researchReports / notificationOutbox に書く主体が居なかった
//    （firestore.rules は「サーバー管理」と宣言しているのに常に空だった）
//  - 冪等性・二重実行防止の材料（既存ジョブ・当日レポート・既通知キー）が
//    クライアント入力しか無く、サーバー側のリース判定が片輪だった
//  - 公開直前の同意再確認（recheckConsentBeforePublish）がどこからも渡っていなかった
import {
  DISCOVERY_NOTIFICATION_GENERIC_BODY,
  DISCOVERY_NOTIFICATION_GENERIC_TITLE,
} from '../domain/proactiveDiscoveryEngine.js';
import type {
  DiscoverySettings,
  ResearchJob,
  ResearchReport,
  RunDiscoveryCycleInput,
} from '../domain/proactiveDiscoverySchemas.js';
import type { DiscoverySearchAdapter } from '../infrastructure/discoverySearchAdapter.js';
import {
  runProactiveDiscoveryCycle,
  type RunDiscoveryCycleResult,
} from './proactiveDiscoveryUseCases.js';

// 通知キュー（users/{uid}/notificationOutbox）の 1 件。
// Web Push の送信者は未実装なので、これは「送ると決めた記録」であって到達の記録ではない。
// 実際にユーザーが読む場所は連絡箱（researchReports）。
export interface QueuedNotification {
  reportId: string;
  jobId: string;
  localDate: string;
  channel: 'inbox';
  status: 'queued';
  title: string;
  body: string;
  notificationState: ResearchReport['notificationState'];
  createdAt: number;
  deliveredAt: number | null;
}

export interface DiscoveryStore {
  // users/{uid}.discoverySettings。同意の正本はクライアント申告ではなくこちら。
  getDiscoverySettings(uid: string): Promise<Partial<DiscoverySettings> | null>;
  getLatestReportForDate(uid: string, localDate: string): Promise<ResearchReport | null>;
  getJobForPeriod(uid: string, localDate: string): Promise<ResearchJob | null>;
  listRecentDedupeKeys(uid: string, limitCount: number): Promise<string[]>;
  saveJob(uid: string, job: ResearchJob): Promise<void>;
  saveReport(uid: string, report: ResearchReport): Promise<void>;
  enqueueNotification(uid: string, notification: QueuedNotification): Promise<void>;
}

// 同意・停止・静音時間はサーバーに保存された値を正とする。
// クライアントが searchConsentGranted: true と申告しても、保存済みが OFF なら外部検索しない。
// 保存自体が無い場合（初回・同期前）は申告どおり扱う。
function applyServerSideConsent(
  claimed: DiscoverySettings,
  stored: Partial<DiscoverySettings> | null
): DiscoverySettings {
  if (!stored) return claimed;
  return {
    ...claimed,
    aiConsentGranted: stored.aiConsentGranted ?? claimed.aiConsentGranted,
    searchConsentGranted: stored.searchConsentGranted ?? claimed.searchConsentGranted,
    notificationEnabled: stored.notificationEnabled ?? claimed.notificationEnabled,
    paused: stored.paused ?? claimed.paused,
    quietHoursStart: stored.quietHoursStart ?? claimed.quietHoursStart,
    quietHoursEnd: stored.quietHoursEnd ?? claimed.quietHoursEnd,
  };
}

const RECENT_DEDUPE_KEY_LIMIT = 50;

export async function runPersistedDiscoveryCycle(
  input: RunDiscoveryCycleInput,
  store: DiscoveryStore,
  options?: {
    nowMs?: number;
    searchAdapter?: DiscoverySearchAdapter;
  }
): Promise<RunDiscoveryCycleResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const uid = input.uid;

  const [storedSettings, existingReport, existingJob, storedDedupeKeys] = await Promise.all([
    store.getDiscoverySettings(uid),
    store.getLatestReportForDate(uid, input.localDate),
    store.getJobForPeriod(uid, input.localDate),
    store.listRecentDedupeKeys(uid, RECENT_DEDUPE_KEY_LIMIT),
  ]);

  const settings = applyServerSideConsent(input.settings, storedSettings);

  // 既に通知した候補はサーバー側の履歴でも判定する（端末をまたいだ重複通知を止める）
  const alreadyNotifiedDedupeKeys = Array.from(
    new Set([...(input.alreadyNotifiedDedupeKeys || []), ...storedDedupeKeys])
  );

  // クライアントが当日レポートを渡してこなくても、サーバー側の 1 件で冪等に収束させる
  const effectiveExistingReport = input.existingReportForDate ?? existingReport;

  const result = await runProactiveDiscoveryCycle(
    {
      ...input,
      settings,
      alreadyNotifiedDedupeKeys,
      existingReportForDate: effectiveExistingReport,
    },
    {
      nowMs,
      searchAdapter: options?.searchAdapter,
      existingJob,
      // 外部検索のあと・公開の直前に、同意撤回と一時停止をもう一度確認する。
      // ここで false を返すとレポートは公開されず通知も積まれない。
      recheckConsentBeforePublish: async () => {
        const fresh = applyServerSideConsent(settings, await store.getDiscoverySettings(uid));
        return fresh.searchConsentGranted && !fresh.paused;
      },
    }
  );

  // リースで弾かれたときは、エンジンが「二重実行を防止しました」という合成レポートを返す。
  // doc id は実行済みのものと同じなので、そのまま書くと完了済みの本物を潰す。だから書かない。
  // 既存ジョブをそのまま返したかどうかで判別する。
  const blockedByLease = Boolean(existingJob) && result.job === existingJob;
  if (blockedByLease) {
    return result;
  }

  await store.saveJob(uid, result.job);

  // 当日レポートで短絡したときは中身が既存と同一なので書き直さない
  const reusedExistingReport =
    Boolean(effectiveExistingReport) && result.report === effectiveExistingReport;
  if (!reusedExistingReport) {
    await store.saveReport(uid, result.report);
  }

  // 同意・静音時間・対象 Project の判定を通ったときだけ通知キューに積む。
  // 判定そのものは evaluateNotificationDispatch が report.notificationState に落としている。
  if (result.report.notificationState === 'provider_accepted_unverified_device') {
    await store.enqueueNotification(uid, {
      reportId: result.report.id,
      jobId: result.job.jobId,
      localDate: result.report.localDate,
      channel: 'inbox',
      status: 'queued',
      // A04: ロック画面に Project 名・質問の回答・検索内容を出さない汎用文面
      title: DISCOVERY_NOTIFICATION_GENERIC_TITLE,
      body: DISCOVERY_NOTIFICATION_GENERIC_BODY,
      notificationState: result.report.notificationState,
      createdAt: nowMs,
      deliveredAt: null,
    });
  }

  return result;
}
