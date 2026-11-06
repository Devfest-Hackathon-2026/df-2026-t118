// requirements.md「デザインの方向性（確定）」に合わせたカード色パレット
const COLOR_PALETTES: Array<{ color: string; c2: string }> = [
  { color: '#f7a6d6', c2: '#f9c6e4' }, // ピンク
  { color: '#2f5fd8', c2: '#5a80e2' }, // コバルト
  { color: '#9fdc3c', c2: '#b8e66e' }, // ライム
  { color: '#b9754f', c2: '#c98c6a' }, // テラコッタ
  { color: '#427c89', c2: '#5e93a0' }, // ティール
  { color: '#ad8be3', c2: '#bfa3ea' }, // ラベンダー
];

export function pickPalette(seed: string): { color: string; c2: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTES[h % COLOR_PALETTES.length];
}

export function deterministicFallbackEmbedding(text: string, dim = 64): number[] {
  const vec = new Array<number>(dim).fill(0);
  const clean = text.toLowerCase().replace(/\s+/g, '');
  for (let i = 0; i < clean.length; i++) {
    const c1 = clean.charCodeAt(i);
    const c2 = i + 1 < clean.length ? clean.charCodeAt(i + 1) : 0;
    const idx1 = c1 % dim;
    const idx2 = ((c1 * 31 + c2) >>> 0) % dim;
    vec[idx1] += 1;
    vec[idx2] += 1.5;
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export function clusterItemsBySimilarity<T extends { embedding: number[] }>(
  items: T[],
  threshold = 0.62
): T[][] {
  if (items.length < 2) return [];

  const parent = items.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (sim >= threshold) {
        union(i, j);
      }
    }
  }

  const groupsMap = new Map<number, T[]>();
  items.forEach((it, idx) => {
    const r = find(idx);
    const arr = groupsMap.get(r) || [];
    arr.push(it);
    groupsMap.set(r, arr);
  });

  let clusters = Array.from(groupsMap.values()).filter((g) => g.length >= 2);
  if (clusters.length === 0 && items.length >= 2) {
    clusters = [items.slice(0, 4)];
  }
  return clusters;
}
