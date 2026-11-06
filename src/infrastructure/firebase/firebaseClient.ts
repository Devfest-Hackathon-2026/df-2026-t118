import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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
    db = getFirestore(app);
    storage = getStorage(app);
    const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'asia-northeast1';
    fns = getFunctions(app, region);
  }
  return { app, db: db!, storage: storage!, fns: fns! };
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
