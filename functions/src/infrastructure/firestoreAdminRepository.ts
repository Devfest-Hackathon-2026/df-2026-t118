import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  BundleDraft,
  MorningProposeOutput,
  ProjectAreaTarget,
  SavedItemSummarySchema,
} from '../domain/schemas.js';
import type { z } from 'zod';

type SavedItemSummary = z.infer<typeof SavedItemSummarySchema>;

export interface UserBatchContext {
  aiConsentGranted: boolean;
  timezone: string;
  characterName: string;
  previousStatus: 'none' | 'mada' | 'skipped';
  targets: ProjectAreaTarget[];
}

function getDb() {
  if (!getApps().length) {
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

  for (const b of bundles) {
    const bundleRef = await userRef.collection('bundles').add({
      ...b,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
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

export async function getReadyBundleForUser(uid: string): Promise<{
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

  // Archives を除外し、Projects を優先して選択
  const candidates: Array<Record<string, unknown> & { id: string }> = bundlesSnap.docs
    .map(
      (d: QueryDocumentSnapshot): Record<string, unknown> & { id: string } => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
      })
    )
    .filter((b) => b.para !== 'Archives' && b.para !== 'Resources');
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.para === 'Projects' ? -1 : b.para === 'Projects' ? 1 : 0));
  const chosen = candidates[0];
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
  const propRef = await userRef.collection('proposals').add({
    bundleId,
    localDate,
    timezoneAtCreation: timezone,
    ...step,
    status: 'ready',
    createdAt: Date.now(),
  });

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
