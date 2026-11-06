// 画像のリサイズと window.Island.makeSticker を使った3Dカード用ステッカー生成
export async function processUploadedImage(file: File): Promise<{
  imageDataUrl: string;
  stickerDataUrl: string;
  aspect: number;
}> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const resizedDataUrl = await resizeImageDataUrl(rawDataUrl, 900);

  if (window.Island?.makeSticker) {
    try {
      const stk = await window.Island.makeSticker(resizedDataUrl, { removeBg: true });
      return {
        imageDataUrl: resizedDataUrl,
        stickerDataUrl: stk.url,
        aspect: stk.aspect || 1,
      };
    } catch {
      // makeSticker が失敗した場合はリサイズ画像をそのまま使う
    }
  }

  return {
    imageDataUrl: resizedDataUrl,
    stickerDataUrl: resizedDataUrl,
    aspect: 1,
  };
}

// 画像なしで URL やメモだけ保存されたとき、3D の島に浮かべる手続き型ステッカーを生成する
export async function makeProceduralSticker(opts: {
  shape?: 'cutout' | 'rect';
  color: string;
  label: string;
}): Promise<{ stickerDataUrl: string; aspect: number } | null> {
  if (!window.Island?.makeSticker) return null;
  try {
    const stk = await window.Island.makeSticker(null, {
      shape: opts.shape || 'rect',
      color: opts.color,
      label: opts.label.slice(0, 8),
    });
    return { stickerDataUrl: stk.url, aspect: stk.aspect || 1 };
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function resizeImageDataUrl(dataUrl: string, maxEdge: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
