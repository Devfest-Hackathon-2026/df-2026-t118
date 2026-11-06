import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { STORAGE_KEY } from '../../domain/constants/islandConstants';
import type {
  Bundle,
  PersistedState,
  Proposal,
  SavedItem,
} from '../../domain/models/islandModels';
import { ensureAnonymousUser, ensureFirebase, getCachedUid } from './firebaseClient';

export function readInitialLocalState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Partial<PersistedState>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveLocalState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearLocalState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Firestore の users/{uid} とサブコレクション（items / bundles / proposals）から状態を復元する
export async function loadFromFirestore(): Promise<{
  meta?: Record<string, unknown>;
  items: SavedItem[];
  bundles: Bundle[];
  proposals: Proposal[];
} | null> {
  const fb = ensureFirebase();
  const uid = await ensureAnonymousUser();
  if (!fb || !uid) return null;

  try {
    const userRef = doc(fb.db, 'users', uid);
    const [userSnap, itemsSnap, bundlesSnap, proposalsSnap] = await Promise.all([
      getDoc(userRef),
      getDocs(collection(userRef, 'items')),
      getDocs(collection(userRef, 'bundles')),
      getDocs(collection(userRef, 'proposals')),
    ]);

    const items = itemsSnap.docs
      .map((d) => d.data() as SavedItem)
      .sort((a, b) => a.createdAt - b.createdAt);
    const bundles = bundlesSnap.docs
      .map((d) => d.data() as Bundle)
      .sort((a, b) => b.createdAt - a.createdAt);
    const proposals = proposalsSnap.docs
      .map((d) => d.data() as Proposal)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (!userSnap.exists() && !items.length && !bundles.length) {
      return null;
    }

    return {
      meta: userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : undefined,
      items,
      bundles,
      proposals,
    };
  } catch {
    return null;
  }
}

// Firestore に変更を保存する（オフライン・未設定時は何もしない）
export async function syncToFirestore(payload: {
  meta: Record<string, unknown>;
  items: SavedItem[];
  bundles: Bundle[];
  proposals: Proposal[];
}): Promise<void> {
  const fb = ensureFirebase();
  const uid = getCachedUid() || (await ensureAnonymousUser());
  if (!fb || !uid) return;

  try {
    const userRef = doc(fb.db, 'users', uid);
    await setDoc(userRef, { ...payload.meta, updatedAt: Date.now() }, { merge: true });

    await Promise.all([
      ...payload.items.map((it) => {
        // Firestore の1ドキュメント上限を避けるため、大きな元画像 DataURL は Storage 側または軽量ステッカーのみ保存
        const copy = { ...it };
        if (copy.imageDataUrl && copy.imageDataUrl.length > 250000) {
          delete copy.imageDataUrl;
        }
        return setDoc(doc(userRef, 'items', it.id), copy, { merge: true });
      }),
      ...payload.bundles.map((b) => setDoc(doc(userRef, 'bundles', b.id), b, { merge: true })),
      ...payload.proposals.map((p) => setDoc(doc(userRef, 'proposals', p.id), p, { merge: true })),
    ]);
  } catch {
    // ネットワーク一時エラー時は localStorage 側で保持されているため握りつぶす
  }
}

export async function clearFirestoreUserData(): Promise<void> {
  const fb = ensureFirebase();
  const uid = getCachedUid();
  if (!fb || !uid) return;
  try {
    const userRef = doc(fb.db, 'users', uid);
    const [itemsSnap, bundlesSnap, proposalsSnap] = await Promise.all([
      getDocs(collection(userRef, 'items')),
      getDocs(collection(userRef, 'bundles')),
      getDocs(collection(userRef, 'proposals')),
    ]);
    await Promise.all([
      ...itemsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...bundlesSnap.docs.map((d) => deleteDoc(d.ref)),
      ...proposalsSnap.docs.map((d) => deleteDoc(d.ref)),
      deleteDoc(userRef),
    ]);
  } catch {
    // ignore
  }
}
