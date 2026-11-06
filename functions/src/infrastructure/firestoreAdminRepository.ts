import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { BundleDraft, MorningProposeOutput, SavedItemSummarySchema } from '../domain/schemas.js';
import type { z } from 'zod';

type SavedItemSummary = z.infer<typeof SavedItemSummarySchema>;

function getDb() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}

export async function listUserIds(limitCount = 100): Promise<string[]> {
  const db = getDb();
  const snap = await db.collection('users').limit(limitCount).get();
  return snap.docs.map((d) => d.id);
}

export async function getUnbundledConfirmedItemsForUser(
  uid: string
): Promise<SavedItemSummary[]> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const itemsSnap = await userRef.collection('items').where('intentConfirmed', '==', true).get();

  return itemsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((d) => !d.bundleId) as SavedItemSummary[];
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

export async function getReadyBundleForUser(uid: string): Promise<{
  id: string;
  intent: string;
  points: string[];
  tool: string;
  itemIds: string[];
} | null> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const bundlesSnap = await userRef
    .collection('bundles')
    .where('readyForProposal', '==', true)
    .limit(5)
    .get();
  if (bundlesSnap.empty) return null;

  const bDoc = bundlesSnap.docs[0];
  const bData = bDoc.data() as {
    intent: string;
    points: string[];
    tool: string;
    itemIds: string[];
  };
  return {
    id: bDoc.id,
    intent: bData.intent,
    points: bData.points || [],
    tool: bData.tool || '',
    itemIds: bData.itemIds || [],
  };
}

export async function saveMorningProposalForUser(
  uid: string,
  bundleId: string,
  step: MorningProposeOutput
): Promise<void> {
  const db = getDb();
  const userRef = db.collection('users').doc(uid);
  const propRef = await userRef.collection('proposals').add({
    bundleId,
    ...step,
    status: 'ready',
    createdAt: Date.now(),
  });

  await userRef.set(
    {
      phase: 'morning',
      proposal: 'ready',
      activeProposalId: propRef.id,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
