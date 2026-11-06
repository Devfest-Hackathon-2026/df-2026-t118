import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ensureAnonymousUser, ensureFirebase, getCachedUid } from './firebaseClient';

// 画像を Cloud Storage (users/{uid}/items/{itemId}) に保存する
export async function uploadItemImageIfConfigured(
  itemId: string,
  imageDataUrl: string
): Promise<string | null> {
  const fb = ensureFirebase();
  const uid = getCachedUid() || (await ensureAnonymousUser());
  if (!fb || !uid || !imageDataUrl.startsWith('data:')) return null;
  try {
    const storageRef = ref(fb.storage, `users/${uid}/items/${itemId}.png`);
    await uploadString(storageRef, imageDataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}
