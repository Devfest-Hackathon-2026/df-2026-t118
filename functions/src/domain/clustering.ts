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

// 全6分野・48ユースケースのトピック概念辞書（汎用動詞を含めず、純粋なドメイン概念のみを先頭18次元に割り当てる）
const SEMANTIC_CONCEPT_PATTERNS: RegExp[] = [
  // 0..3: デザイン・ものづくり (#1〜#10)
  /ui|ux|ホーム画面|カードui|オンボーディング|アプリ画面|画面デザイン|figma|プロトタイプ/i,
  /配色|カラーパレット|色合わせ|文字組み|タイポグラフィ|雑誌の表紙|タイトル|フォント|ポスター/i,
  /キャラクター|ステッカー|アイコン|イラスト|グラフィック/i,
  /3d|ジオラマ|島|アニメーション|動き|モデリング|ポートフォリオ|作品例|デモ制作|ハッカソン/i,
  // 4..5: 料理・食べもの (#11〜#16)
  /レシピ|朝食|野菜|おやつ|電子レンジ|作り置き|料理|自炊|ごはん|食材|ジェノベーゼ|バジル|献立/i,
  /カフェ風|ドリンク|盛りつけ|お弁当|おうちカフェ|彩り|キッチン/i,
  // 6..7: ファッション・美容 (#17〜#22)
  /コーデ|服|小物|ファッション|着回し|スタイル/i,
  /髪型|ヘア|ネイル|メイク|リップ|コスメ|美容|身だしなみ/i,
  // 8..11: ツール・学び・仕事 (#23〜#32)
  /obsidian|second brain|情報整理|情報管理|メモ|知識管理|フォルダ|zettel|notion|ノート/i,
  /aiツール|生成ai|gemini|便利ツール|作業効率|自動化|プログラミング|コード|実装|開発|技術/i,
  /勉強法|図解|授業|学習|読書|本|資格|集中/i,
  /就活|面接|質問集|キャリア|発表|スライド|プレゼン|統計|データ|調査|進学|考え方|教訓/i,
  // 12..14: 日常・暮らし (#33〜#40)
  /机まわり|作業スペース|デスク|収納|模様替え|部屋|インテリア|花を飾|季節感|片付け|プランター|菜園/i,
  /日記|スマホを見すぎない|寝る前|睡眠|デジタルデトックス|リラックス/i,
  /行きたい場所|お出かけ|旅行|休日|週末|散歩|イベント|訪れる|カフェ/i,
  // 15..17: 趣味・創作・思い出 (#41〜#48)
  /写真|ポーズ|構図|撮影|カメラ|思い出|友達と/i,
  /アクセサリー|手作り|ハンドメイド|工作|創作|展示|美術|アート|音楽|プレイリスト/i,
  /筋トレ|ストレッチ|運動|体を動かす|ヨガ|フィットネス/i,
];

// 助詞や定型語尾による擬似相関を抑えるためのストップワード除去
function stripFunctionalStopwords(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /してみる|してみたい|やってみる|やってみたい|を取り入れる|の参考にする|として残す|ておく|たい|ため|こと|もの|よう/g,
      ' '
    )
    .replace(/[、。・！？!?,./()（）「」『』【】[\]\s]+/g, '');
}

// セマンティック概念次元（18次元）＋文字N-gram特徴ハッシュ（46次元）のハイブリッド決定論的埋め込み（計64次元）
export function deterministicFallbackEmbedding(text: string, dim = 64): number[] {
  const vec = new Array<number>(dim).fill(0);
  const rawLower = (text || '').toLowerCase();

  // 1. 先頭 18 次元にドメイン概念の活性値を入れる
  const conceptDims = Math.min(SEMANTIC_CONCEPT_PATTERNS.length, Math.floor(dim * 0.35));
  for (let c = 0; c < conceptDims; c++) {
    if (SEMANTIC_CONCEPT_PATTERNS[c].test(rawLower)) {
      vec[c] += 4.5;
    }
  }

  // 2. 残りの次元にストップワード除去後の文字 2-gram / 3-gram ハッシュを入れる（1-gram衝突を除外し意味差を鮮明にする）
  const clean = stripFunctionalStopwords(rawLower);
  const ngramSpace = Math.max(1, dim - conceptDims);
  for (let i = 0; i < clean.length; i++) {
    const c1 = clean.charCodeAt(i);
    const c2 = i + 1 < clean.length ? clean.charCodeAt(i + 1) : 0;
    const c3 = i + 2 < clean.length ? clean.charCodeAt(i + 2) : 0;
    const idx2 = conceptDims + (((c1 * 131 + c2) >>> 0) % ngramSpace);
    const idx3 = conceptDims + (((c1 * 257 + c2 * 31 + c3) >>> 0) % ngramSpace);
    if (c2) vec[idx2] += 1.0;
    if (c3) vec[idx3] += 0.9;
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  // オンライン(768次元)とローカル(64次元)が混在した場合でも先頭次元で安全に比較できるようにする
  let va = a;
  let vb = b;
  if (a.length !== b.length) {
    const minLen = Math.min(a.length, b.length);
    va = a.slice(0, minLen);
    vb = b.slice(0, minLen);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

// 同じ題材でも意図（目的）が異なる場合は別クラスタとして扱うための意図ドメイン判定（ユースケース7「同じ題材でも、意図が違えば分ける」）
export function detectIntentGoalCategories(intentText: string): string[] {
  const s = (intentText || '').toLowerCase();
  const cats: string[] = [];
  if (/行く|行ってみたい|訪れる|お出かけ|旅行|散歩|食べに行く/.test(s)) {
    cats.push('visit_outing');
  }
  if (
    /ui|ux|画面|デザイン|配色|文字組み|タイポグラフィ|内装を.*参考|アプリ|サイト|カード|オンボーディング|制作|作品|ポートフォリオ|3d|ジオラマ|キャラクター|デモ|ハッカソン|ビジュアル/.test(
      s
    )
  ) {
    cats.push('design_build');
  }
  if (
    /作る|作ってみたい|レシピ|料理|朝食|おやつ|弁当|盛りつけ|作り置き|ジェノベーゼ|食材|カフェっぽ|自炊|ごはん|食事/.test(
      s
    )
  ) {
    cats.push('cooking_food');
  }
  if (/コーデ|服|髪型|ヘア|ネイル|メイク|リップ|見比べる|身だしなみ|ファッション/.test(s)) {
    cats.push('fashion_beauty');
  }
  if (
    /obsidian|second brain|ノート|メモ|情報整理|情報管理|整理|勉強|面接|就活|発表|プレゼン|スライド|プログラミング|実装|aiツール|統計|学習|知識|フォルダ/.test(
      s
    )
  ) {
    cats.push('study_work_tool');
  }
  if (
    /机|収納|模様替え|部屋|花を飾|日記|寝る前|作業スペース|プランター|栽培|育てる|インテリア|暮らし/.test(
      s
    )
  ) {
    cats.push('living_space');
  }
  if (
    /写真|ポーズ|撮影|イラスト|絵を描|アクセサリー|音楽|プレイリスト|読書|本|筋トレ|ストレッチ|運動/.test(
      s
    )
  ) {
    cats.push('hobby_wellness');
  }
  return cats;
}

export function areIntentsConflicting(intentA?: string, intentB?: string): boolean {
  if (!intentA || !intentB) return false;
  const catsA = detectIntentGoalCategories(intentA);
  const catsB = detectIntentGoalCategories(intentB);
  if (catsA.length === 0 || catsB.length === 0) return false;
  // 共通する目的カテゴリが1つもない場合は「題材が同じでも意図が異なる」と判定して分離する
  const hasOverlap = catsA.some((c) => catsB.includes(c));
  return !hasOverlap;
}

export function clusterItemsBySimilarity<T extends { embedding: number[]; intent?: string }>(
  items: T[],
  threshold = 0.58
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
      // 同じ題材でも意図（目的カテゴリ）が明確に異なる場合は束ねない
      if (areIntentsConflicting(items[i].intent, items[j].intent)) {
        continue;
      }
      const catsI = detectIntentGoalCategories(items[i].intent || '');
      const catsJ = detectIntentGoalCategories(items[j].intent || '');
      const sameGoalCategory =
        catsI.length > 0 && catsJ.length > 0 && catsI.some((c) => catsJ.includes(c));
      const sim =
        cosineSimilarity(items[i].embedding, items[j].embedding) + (sameGoalCategory ? 0.15 : 0);
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
    // 意図が衝突していないペアで、緩い類似度（>= 0.35）を満たす組だけフォールバック束ねを行う
    const compatibleGroup: T[] = [items[0]];
    for (let k = 1; k < items.length && compatibleGroup.length < 4; k++) {
      if (
        !areIntentsConflicting(items[0].intent, items[k].intent) &&
        cosineSimilarity(items[0].embedding, items[k].embedding) >= 0.35
      ) {
        compatibleGroup.push(items[k]);
      }
    }
    if (compatibleGroup.length >= 2) {
      clusters = [compatibleGroup];
    }
  }
  return clusters;
}
