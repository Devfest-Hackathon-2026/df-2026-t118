import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { ensureAnonymousUser, ensureFirebase, getCachedUid } from './firebaseClient';

// 画像を Cloud Storage (users/{uid}/items/{itemId}.png) に保存する
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

// 保存物削除時に Cloud Storage 上の画像も削除する（R03 / T19）
export async function deleteItemImageIfConfigured(itemId: string): Promise<boolean> {
  const fb = ensureFirebase();
  const uid = getCachedUid() || (await ensureAnonymousUser());
  if (!fb || !uid) return true;
  try {
    const storageRef = ref(fb.storage, `users/${uid}/items/${itemId}.png`);
    await deleteObject(storageRef);
    return true;
  } catch {
    // 元から Storage に画像がない場合も成功扱いとする
    return true;
  }
}
