import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let fns: Functions | null = null;
let currentUser: User | null = null;

export function ensureFirebase() {
  if (!isFirebaseConfigured) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    // 画面の状態には未設定のフィールド（activeProposalId など）が undefined のまま混ざる。
    // 既定の Firestore は undefined を含む書き込みを例外にするため、同期がまるごと失敗する。
    // ここで無視する設定にして、未設定のフィールドは単に書かない扱いにする。
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    storage = getStorage(app);
    const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'asia-northeast1';
    fns = getFunctions(app, region);
    initializeAppCheckIfConfigured(app);
  }
  return { app, db: db!, storage: storage!, fns: fns! };
}

// App Check（イシュー #38）。匿名 uid は無限に作れるため、課金ガードとして最後に効くのは
// 「自分のアプリから来たリクエストか」の検証になる。
//
// ただし、いまは**計測だけ**で、サーバー側は検証していない（callable に enforceAppCheck を付けていない）。
// 提出直前に適用すると、設定の取りこぼしで本番の AI が全滅する。Firebase コンソールで
// 「未適用」のまま計測データを溜め、適用は提出後に切り替える（docs/decisions/005-ai-cost-guard.md）。
//
// reCAPTCHA のサイトキーが未設定の環境では何もしない＝これまでと完全に同じ挙動にする。
function initializeAppCheckIfConfigured(firebaseApp: FirebaseApp): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY as string | undefined;
  if (!siteKey) return;
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // App Check の初期化失敗でアプリを止めない（検証は未適用なので、落ちても機能は変わらない）
    console.warn('[appcheck] 初期化に失敗しました', err);
  }
}

export function getCachedUid(): string | null {
  return currentUser?.uid || null;
}

// 匿名認証で自動サインインし、UID を返す（ADR-003）
export async function ensureAnonymousUser(): Promise<string | null> {
  const fb = ensureFirebase();
  if (!fb) return null;
  const auth = getAuth(fb.app);
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return currentUser.uid;
  }
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsub();
      if (u) {
        currentUser = u;
        resolve(u.uid);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
          resolve(cred.user.uid);
        } catch {
          resolve(null);
        }
      }
    });
  });
}

// Hosting リライト経由の素の fetch（/api/*）でも Cloud Functions の onCall が
// request.auth を埋められるように、callable の規約どおり ID トークンを取り出す。
// これが無いと本番では常に未認証扱いになり、uid に紐づく保存が一切できない。
export async function getIdToken(): Promise<string | null> {
  const fb = ensureFirebase();
  if (!fb) return null;
  const uid = await ensureAnonymousUser();
  if (!uid) return null;
  try {
    const auth = getAuth(fb.app);
    return (await auth.currentUser?.getIdToken()) || null;
  } catch {
    return null;
  }
}
