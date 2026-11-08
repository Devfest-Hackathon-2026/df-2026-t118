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
  AreaEntity,
  Bundle,
  PersistedState,
  ProjectEntity,
  Proposal,
  SavedItem,
} from '../../domain/models/islandModels';
import type {
  ConfirmedSubject,
  DiscoveryFeedback,
  ResearchReport,
} from '../../domain/models/proactiveDiscoveryModels';
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

// Firestore の users/{uid} とサブコレクション（items / bundles / proposals / projects / areas）から状態を復元する
export async function loadFromFirestore(): Promise<{
  meta?: Record<string, unknown>;
  items: SavedItem[];
  bundles: Bundle[];
  proposals: Proposal[];
  projects: ProjectEntity[];
  areas: AreaEntity[];
  confirmedSubjects: ConfirmedSubject[];
  researchReports: ResearchReport[];
  discoveryFeedbacks: DiscoveryFeedback[];
} | null> {
  const fb = ensureFirebase();
  const uid = await ensureAnonymousUser();
  if (!fb || !uid) return null;

  try {
    const userRef = doc(fb.db, 'users', uid);
    const [
      userSnap,
      itemsSnap,
      bundlesSnap,
      proposalsSnap,
      projectsSnap,
      areasSnap,
      subjectsSnap,
      reportsSnap,
      feedbacksSnap,
    ] = await Promise.all([
      getDoc(userRef),
      getDocs(collection(userRef, 'items')),
      getDocs(collection(userRef, 'bundles')),
      getDocs(collection(userRef, 'proposals')),
      getDocs(collection(userRef, 'projects')),
      getDocs(collection(userRef, 'areas')),
      // 連絡箱の「好き」帳とフィードバック。端末内にしか無いと別端末・ストレージ削除で消える。
      // researchReports は firestore.rules でクライアントからの write を禁じている
      // （サーバー管理のため）ので読むだけにする。発見カードは再生成できる。
      getDocs(collection(userRef, 'confirmedSubjects')),
      getDocs(collection(userRef, 'researchReports')),
      getDocs(collection(userRef, 'discoveryFeedbacks')),
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
    const projects = projectsSnap.docs
      .map((d) => d.data() as ProjectEntity)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const areas = areasSnap.docs
      .map((d) => d.data() as AreaEntity)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const confirmedSubjects = subjectsSnap.docs
      .map((d) => d.data() as ConfirmedSubject)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const researchReports = reportsSnap.docs
      .map((d) => d.data() as ResearchReport)
      .sort((a, b) => b.executedAt - a.executedAt);
    const discoveryFeedbacks = feedbacksSnap.docs
      .map((d) => d.data() as DiscoveryFeedback)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (
      !userSnap.exists() &&
      !items.length &&
      !bundles.length &&
      !projects.length &&
      !areas.length
    ) {
      return null;
    }

    return {
      meta: userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : undefined,
      items,
      bundles,
      proposals,
      projects,
      areas,
      confirmedSubjects,
      researchReports,
      discoveryFeedbacks,
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
  projects?: ProjectEntity[];
  areas?: AreaEntity[];
  confirmedSubjects?: ConfirmedSubject[];
  discoveryFeedbacks?: DiscoveryFeedback[];
}): Promise<boolean> {
  const fb = ensureFirebase();
  const uid = getCachedUid() || (await ensureAnonymousUser());
  if (!fb || !uid) return true;

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
      ...(payload.projects || []).map((pr) =>
        setDoc(doc(userRef, 'projects', pr.id), pr, { merge: true })
      ),
      ...(payload.areas || []).map((ar) =>
        setDoc(doc(userRef, 'areas', ar.id), ar, { merge: true })
      ),
      ...(payload.confirmedSubjects || []).map((sub) =>
        setDoc(doc(userRef, 'confirmedSubjects', sub.id), sub, { merge: true })
      ),
      ...(payload.discoveryFeedbacks || []).map((fb2) =>
        setDoc(doc(userRef, 'discoveryFeedbacks', fb2.id), fb2, { merge: true })
      ),
    ]);
    return true;
  } catch (err) {
    // 握りつぶすと「クラウド同期に一時失敗しました」の原因が追えなくなるため、理由だけ残す
    console.warn('[firestore] 同期に失敗しました', err);
    return false;
  }
}

// 保存物の単体削除（R03 / T19）
export async function deleteItemFromFirestore(itemId: string): Promise<boolean> {
  const fb = ensureFirebase();
  const uid = getCachedUid() || (await ensureAnonymousUser());
  if (!fb || !uid) return true;
  try {
    const userRef = doc(fb.db, 'users', uid);
    await deleteDoc(doc(userRef, 'items', itemId));
    return true;
  } catch {
    return false;
  }
}

export async function clearFirestoreUserData(): Promise<void> {
  const fb = ensureFirebase();
  const uid = getCachedUid();
  if (!fb || !uid) return;
  try {
    const userRef = doc(fb.db, 'users', uid);
    const [itemsSnap, bundlesSnap, proposalsSnap, projectsSnap, areasSnap] =
      await Promise.all([
        getDocs(collection(userRef, 'items')),
        getDocs(collection(userRef, 'bundles')),
        getDocs(collection(userRef, 'proposals')),
        getDocs(collection(userRef, 'projects')),
        getDocs(collection(userRef, 'areas')),
      ]);
    await Promise.all([
      ...itemsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...bundlesSnap.docs.map((d) => deleteDoc(d.ref)),
      ...proposalsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...projectsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...areasSnap.docs.map((d) => deleteDoc(d.ref)),
      deleteDoc(userRef),
    ]);
  } catch {
    // ignore
  }
}
