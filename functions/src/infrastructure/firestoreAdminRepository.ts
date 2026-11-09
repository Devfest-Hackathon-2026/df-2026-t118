import { initializeApp, getApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  BundleDraft,
  MorningProposeOutput,
  ProjectAreaTarget,
  SavedItemSummarySchema,
} from '../domain/schemas.js';
import type { z } from 'zod';
import type {
  DiscoverySettings,
  ResearchJob,
  ResearchReport,
} from '../domain/proactiveDiscoverySchemas.js';
import type { DiscoveryStore } from '../application/discoveryPersistenceUseCases.js';
import type {
  AiQuotaGuardConfig,
  AiQuotaStore,
} from '../application/aiQuotaUseCases.js';
import {
  buildBundleDocument,
  buildProposalDocument,
} from '../domain/firestoreDocuments.js';
import {
  selectBundleForMorningProposal,
  type ProposalCandidateBundle,
} from '../domain/proposalSelection.js';

type SavedItemSummary = z.infer<typeof SavedItemSummarySchema>;

export interface UserBatchContext {
  aiConsentGranted: boolean;
  timezone: string;
  characterName: string;
  previousStatus: 'none' | 'mada' | 'skipped';
  targets: ProjectAreaTarget[];
}

// getApps() は名前付きアプリでも埋まるため、「1つでもあるなら初期化済み」と判断すると
// 既定アプリが無いまま getFirestore() に進み、app/no-app で落ちる。
// 本番で実際に踏んだ（この関数と同じ経路を使う夜/朝の定時バッチも巻き込まれていた）。
// 既定アプリの有無だけを見る。
function getDb() {
  try {
    getApp();
  } catch {
    initializeApp();
  }
  return getFirestore();
}

export async function listUserIds(limitCount = 100): Promise<string[]> {
  const db = getDb();
  const snap = await db.collection('users').limit(limitCount).get();
  return snap.docs.map((d: QueryDocumentSnapshot) => d.id);
}

export async function getUserBatchContext(uid: string): Promise<UserBatchContext> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const [userSnap, projectsSnap, areasSnap] = await Promise.all([
    userRef.get(),
    userRef.collection('projects').get(),
    userRef.collection('areas').get(),
  ]);

  const meta = (userSnap.exists ? userSnap.data() : {}) || {};
  const profile = (meta.profile as Record<string, unknown> | undefined) || {};
  const aiConsentGranted = profile.aiConsentGranted !== false;
  const timezone = typeof profile.timezone === 'string' ? profile.timezone : 'Asia/Tokyo';
  const charCode = typeof meta.character === 'string' ? meta.character : 'poko';
  const characterName =
    charCode === 'tomori' ? 'ともり' : charCode === 'fumi' ? 'ふみ' : 'ぽこ';
  const rawPrev = typeof meta.proposalStatus === 'string' ? meta.proposalStatus : 'none';
  const previousStatus: 'none' | 'mada' | 'skipped' =
    rawPrev === 'mada' || rawPrev === 'skipped' ? rawPrev : 'none';

  const targets: ProjectAreaTarget[] = [
    ...projectsSnap.docs
      .map((d: QueryDocumentSnapshot) => d.data())
      .filter((p) => p.status !== 'archived' && typeof p.name === 'string')
      .map((p) => ({
        id: String(p.id || ''),
        name: String(p.name),
        goal: typeof p.goal === 'string' ? p.goal : undefined,
        kind: 'project' as const,
      })),
    ...areasSnap.docs
      .map((d: QueryDocumentSnapshot) => d.data())
      .filter((a) => a.status !== 'archived' && typeof a.name === 'string')
      .map((a) => ({
        id: String(a.id || ''),
        name: String(a.name),
        kind: 'area' as const,
      })),
  ];

  return {
    aiConsentGranted,
    timezone,
    characterName,
    previousStatus,
    targets,
  };
}

export async function getUnbundledConfirmedItemsForUser(
  uid: string
): Promise<SavedItemSummary[]> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const itemsSnap = await userRef.collection('items').where('intentConfirmed', '==', true).get();

  // requirements.md: 「見るだけ・参考（Resources）」および「Archives」は夜の束ね（行動提案用）から除外する
  return itemsSnap.docs
    .map((d: QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter(
      (d: Record<string, unknown>) =>
        !d.bundleId &&
        d.intentStatus !== 'reference' &&
        d.para !== 'Resources' &&
        d.para !== 'Archives'
    ) as SavedItemSummary[];
}

export async function saveNightBundlesForUser(
  uid: string,
  bundles: BundleDraft[]
): Promise<void> {
  if (bundles.length === 0) return;
  const db = getDb();
  const userRef = db.collection('users').doc(uid);

  const nowMs = Date.now();
  for (const b of bundles) {
    // doc() で先に ID を採ってから中身に入れる。add() のままだと doc id だけが ID になり、
    // doc id を捨てて読むクライアント側で id: undefined になる（firestoreDocuments.ts 参照）
    const bundleRef = userRef.collection('bundles').doc();
    await bundleRef.set(buildBundleDocument(b, bundleRef.id, nowMs));

    for (const itemId of b.itemIds) {
      await userRef.collection('items').doc(itemId).update({
        bundleId: bundleRef.id,
        floating: false,
        para: b.para,
      });
    }
  }

  await userRef.set(
    { phase: 'night', bundle: true, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function hasProposalForLocalDate(
  uid: string,
  localDate: string
): Promise<boolean> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef
    .collection('proposals')
    .where('localDate', '==', localDate)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function getReadyBundleForUser(
  uid: string,
  activeTargetIds: string[] = []
): Promise<{
  id: string;
  intent: string;
  points: string[];
  tool: string;
  items: Array<{ title: string; intent: string }>;
} | null> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const bundlesSnap = await userRef
    .collection('bundles')
    .where('readyForProposal', '==', true)
    .limit(10)
    .get();
  if (bundlesSnap.empty) return null;

  // 選び方はフロント（islandRules.selectTargetBundleForToday）と同じ順序にそろえる。
  // 手で押したときと朝 8 時のジョブで別の束が選ばれないようにするため。
  const candidates = bundlesSnap.docs.map(
    (d: QueryDocumentSnapshot): ProposalCandidateBundle & Record<string, unknown> => ({
      ...(d.data() as Record<string, unknown>),
      id: d.id,
      para: String((d.data() as Record<string, unknown>).para || ''),
    })
  );

  const chosen = selectBundleForMorningProposal(candidates, activeTargetIds);
  if (!chosen) return null;

  const itemIds = Array.isArray(chosen.itemIds) ? (chosen.itemIds as string[]) : [];

  const itemsSnap = await userRef.collection('items').where('intentConfirmed', '==', true).get();
  const allItems: Array<Record<string, unknown> & { id: string }> = itemsSnap.docs.map(
    (d: QueryDocumentSnapshot) => ({
      ...(d.data() as Record<string, unknown>),
      id: d.id,
    })
  );
  const bundleItems = allItems
    .filter((it) => itemIds.includes(it.id) || it.bundleId === chosen.id)
    .map((it) => ({
      title: String(it.title || ''),
      intent: String(it.intent || it.title || ''),
    }));

  return {
    id: String(chosen.id),
    intent: String(chosen.intent || ''),
    points: Array.isArray(chosen.points) ? (chosen.points as string[]) : [],
    tool: String(chosen.tool || ''),
    items: bundleItems,
  };
}

export async function saveMorningProposalForUser(
  uid: string,
  bundleId: string,
  localDate: string,
  timezone: string,
  step: MorningProposeOutput
): Promise<void> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const propRef = userRef.collection('proposals').doc();
  await propRef.set(
    buildProposalDocument({
      id: propRef.id,
      bundleId,
      localDate,
      timezone,
      step,
      nowMs: Date.now(),
    })
  );

  await userRef.set(
    {
      phase: 'morning',
      proposalStatus: 'ready',
      activeProposalId: propRef.id,
      activeBundleId: bundleId,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

// ---------- 能動発見（A01〜A04）のサーバー管理サブコレクション ----------
// firestore.rules が researchJobs / researchReports / notificationOutbox を
// 「クライアント write 禁止・サーバー管理」と宣言している。その書く主体がここ。

// Firestore は undefined を含む書き込みを例外にする。レポートやカードには
// Zod の optional（question.answer, feedback.reason など）が未設定のまま混ざるため、
// undefined のキーだけ落としてから書く。
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createFirestoreDiscoveryStore(): DiscoveryStore {
  return {
    async getDiscoverySettings(uid) {
      const snap = await getDb().collection('users').doc(uid).get();
      if (!snap.exists) return null;
      const stored = (snap.data() || {}).discoverySettings;
      if (!stored || typeof stored !== 'object') return null;
      return stored as Partial<DiscoverySettings>;
    },

    async getLatestReportForDate(uid, localDate) {
      // localDate の等価条件に executedAt の並び替えを足すと複合インデックスが必要になる。
      // 1 日あたり数件なので、取得してからメモリ上で最新を選ぶ。
      const snap = await getDb()
        .collection('users')
        .doc(uid)
        .collection('researchReports')
        .where('localDate', '==', localDate)
        .limit(5)
        .get();
      if (snap.empty) return null;
      const reports = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as ResearchReport);
      return reports.sort((a, b) => b.executedAt - a.executedAt)[0] || null;
    },

    async getJobForPeriod(uid, localDate) {
      const snap = await getDb()
        .collection('users')
        .doc(uid)
        .collection('researchJobs')
        .where('periodKey', '==', localDate)
        .limit(5)
        .get();
      if (snap.empty) return null;
      const jobs = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as ResearchJob);
      return jobs.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
    },

    async listRecentDedupeKeys(uid, limitCount) {
      const snap = await getDb()
        .collection('users')
        .doc(uid)
        .collection('researchReports')
        .orderBy('executedAt', 'desc')
        .limit(limitCount)
        .get();
      return snap.docs
        .map((d: QueryDocumentSnapshot) => (d.data() as ResearchReport).card?.dedupeKey)
        .filter((k): k is string => Boolean(k));
    },

    async saveJob(uid, job) {
      // doc id は buildStableResearchJobId の安定 ID。同じ日・同じ Project なら上書きになる（冪等）
      await getDb()
        .collection('users')
        .doc(uid)
        .collection('researchJobs')
        .doc(job.jobId)
        .set(stripUndefined(job), { merge: true });
    },

    async saveReport(uid, report) {
      await getDb()
        .collection('users')
        .doc(uid)
        .collection('researchReports')
        .doc(report.id)
        .set(stripUndefined(report), { merge: true });
    },

    async enqueueNotification(uid, notification) {
      await getDb()
        .collection('users')
        .doc(uid)
        .collection('notificationOutbox')
        .add(stripUndefined(notification));
    },
  };
}

// ---------- AI クォータ（イシュー #38） ----------

// 設定と全体カウンタの読み取りをインスタンス内で使い回す時間。
// 関数インスタンスは再利用されるので、AI 呼び出しごとに Firestore を読まずに済む。
// この分だけ全体の天井が甘くなるが、粗い天井なので実害はない。
const QUOTA_CACHE_MS = 30000;

let guardConfigCache: { at: number; value: AiQuotaGuardConfig | null } | null = null;
let globalDailyCache: { at: number; localDate: string; value: number } | null = null;

function readCalls(data: Record<string, unknown> | undefined): number {
  const raw = Number(data?.calls ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

// クライアントから触れない場所にカウンタとキルスイッチを置く。
// config / aiUsageDaily はルート直下のコレクションで、firestore.rules は /users/{uid} しか
// match していないため既定で拒否される。aiUsage は users 配下なので rules 側で明示的に塞ぐ。
export function createFirestoreAiQuotaStore(): AiQuotaStore {
  return {
    async getGuardConfig() {
      const now = Date.now();
      if (guardConfigCache && now - guardConfigCache.at < QUOTA_CACHE_MS) {
        return guardConfigCache.value;
      }
      const snap = await getDb().collection('config').doc('aiGuard').get();
      const value = snap.exists ? ((snap.data() || {}) as AiQuotaGuardConfig) : null;
      guardConfigCache = { at: now, value };
      return value;
    },

    async consumeUserDaily(uid, localDate, cost) {
      const db = getDb();
      const ref = db.collection('users').doc(uid).collection('aiUsage').doc(localDate);
      // per-uid は同時実行がほぼ無いので、読んで足して書くところまで厳密にやる
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const next = readCalls(snap.exists ? snap.data() : undefined) + cost;
        tx.set(ref, { calls: next, localDate, updatedAt: Date.now() }, { merge: true });
        return next;
      });
    },

    async getGlobalDaily(localDate) {
      const now = Date.now();
      if (
        globalDailyCache &&
        globalDailyCache.localDate === localDate &&
        now - globalDailyCache.at < QUOTA_CACHE_MS
      ) {
        return globalDailyCache.value;
      }
      const snap = await getDb().collection('aiUsageDaily').doc(localDate).get();
      const value = readCalls(snap.exists ? snap.data() : undefined);
      globalDailyCache = { at: now, localDate, value };
      return value;
    },

    async addGlobalDaily(localDate, cost) {
      // 単一ドキュメントへの書き込みなのでトランザクションにしない（1 doc あたりの書き込み制約に当たる）
      await getDb()
        .collection('aiUsageDaily')
        .doc(localDate)
        .set({ calls: FieldValue.increment(cost), updatedAt: Date.now() }, { merge: true });
      // 同じインスタンスが続けて処理する分は、読み直さずに自分の消費を反映させる
      if (globalDailyCache && globalDailyCache.localDate === localDate) {
        globalDailyCache.value += cost;
      }
    },
  };
}
