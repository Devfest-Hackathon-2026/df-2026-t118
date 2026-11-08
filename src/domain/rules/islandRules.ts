import type {
  BuildingKind,
  Bundle,
  PhaseKind,
  ProjectEntity,
  Proposal,
  ProposalStatus,
  SavedItem,
} from '../models/islandModels';

export interface BuildingLibraryEntry {
  kind: BuildingKind;
  code: string;
  nameJa: string;
  nameEn: string;
  signText: string;
  description: string;
}

export const BUILDING_LIBRARY_CATALOG: BuildingLibraryEntry[] = [
  {
    kind: 'atelier',
    code: 'B1',
    nameJa: '制作アトリエ',
    nameEn: 'Atelier Studio',
    signText: '制作',
    description: 'デモ① デザイン・UI・ものづくり（#1〜#10）：パステルドーム屋根と大きな天窓・画架のあるアトリエ',
  },
  {
    kind: 'kitchen_cafe',
    code: 'B2',
    nameJa: '小さなベーカリー＆キッチン',
    nameEn: 'Kitchen & Cafe',
    signText: '珈琲',
    description: 'デモ② 料理・食べもの（#11〜#16）：しましまオーニングと煙突・丸テーブルのあるキッチンハウス',
  },
  {
    kind: 'study_tower',
    code: 'B3',
    nameJa: '知恵の書斎タワー',
    nameEn: 'Second Brain Library',
    signText: '書斎',
    description: 'デモ③ ツール・学び・仕事（#23〜#32）：2段重ねのネイビー＆ウッド調タワーと積み重なった本のモチーフ',
  },
  {
    kind: 'greenhouse',
    code: 'B4',
    nameJa: 'ガラスの温室＆プランター',
    nameEn: 'Greenhouse Garden',
    signText: '温室',
    description: '日常・暮らし・ベランダ栽培（#33〜#38）：半透明ミントのかまぼこ型ドーム屋根と双葉プランター',
  },
  {
    kind: 'boutique',
    code: 'B5',
    nameJa: 'ドレッサー・ブティック',
    nameEn: 'Boutique Salon',
    signText: '装い',
    description: 'ファッション・美容（#17〜#22）：ラベンダー＆ピーチのアーチ窓とリボン屋根飾りのサロン',
  },
  {
    kind: 'pavilion',
    code: 'B6',
    nameJa: 'カルチャー＆フォトテント',
    nameEn: 'Hobby Pavilion',
    signText: '写真',
    description: '趣味・撮影・お出かけ・音楽（#39〜#48）：多角錐サーカステント屋根とカメラレンズ風丸窓',
  },
];

export function inferBuildingKindFromBundle(
  bundle?: Pick<Bundle, 'intent' | 'tool' | 'targetName' | 'buildingKind'> | null
): BuildingKind {
  if (!bundle) return 'atelier';
  if (bundle.buildingKind) return bundle.buildingKind;
  const text = `${bundle.intent || ''} ${bundle.tool || ''} ${bundle.targetName || ''}`.toLowerCase();

  if (
    /レシピ|料理|朝食|おやつ|弁当|カフェ|ドリンク|野菜|作り置き|キッチン|食/.test(text)
  ) {
    return 'kitchen_cafe';
  }
  if (
    /obsidian|second brain|情報整理|ノート|勉強|面接|就活|スライド|プレゼン|プログラミング|読書|本|書斎|統計/.test(
      text
    )
  ) {
    return 'study_tower';
  }
  if (
    /バジル|栽培|プランター|植物|花|ベランダ|机|収納|模様替え|部屋|暮らし|日記|睡眠|温室/.test(
      text
    )
  ) {
    return 'greenhouse';
  }
  if (/コーデ|服|ファッション|髪型|ヘア|ネイル|メイク|リップ|美容|ブティック/.test(text)) {
    return 'boutique';
  }
  if (
    /写真|撮影|ポーズ|カメラ|音楽|ライブ|プレイリスト|お出かけ|旅行|運動|ストレッチ|筋トレ/.test(
      text
    )
  ) {
    return 'pavilion';
  }
  return 'atelier';
}

// F05: ユーザーの IANA タイムゾーンに基づき現地暦日（YYYY-MM-DD）を算出する純粋関数
export function computeLocalDateString(
  timezone = 'Asia/Tokyo',
  nowMs = Date.now()
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(nowMs));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // 無効なタイムゾーン指定時は Asia/Tokyo にフォールバック
  }
  const d = new Date(nowMs + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// キャラクターの吹き出しテキストをドメイン状態から算出する純粋ルール
export function computeBubbleText(params: {
  floatingItems: SavedItem[];
  proposalStatus: ProposalStatus;
  activeBundle?: Bundle | null;
  pendingBundlesCount?: number;
  pendingQuestionCount?: number;
  phase: PhaseKind;
  aiBusyLabel?: string | null;
}): string {
  if (params.aiBusyLabel) return params.aiBusyLabel;
  const confirmedFloating = params.floatingItems.filter((c) => c.intentConfirmed).length;
  const hasUnknown = params.floatingItems.some((c) => !c.intentConfirmed);

  if (params.proposalStatus === 'done') {
    const label = params.activeBundle?.tool || params.activeBundle?.targetName || '新しい';
    return `建ったね。${label}の建物。`;
  }
  if (params.proposalStatus === 'doing') return 'いってらっしゃい。15分だけでいいよ。';
  if (params.proposalStatus === 'ready') return 'おはよう。今日の一歩、見てみる？';
  if (params.proposalStatus === 'skipped') return 'うん、また明日ね。今日はゆっくりしよう。';
  if (params.proposalStatus === 'released') return '手放したよ。海にそっと流しておくね。';
  if (params.proposalStatus === 'mada') return 'だいじょうぶ。次はもう少し小さくしてみるね。';
  if ((params.pendingBundlesCount || 0) > 0) {
    return `夜に${params.pendingBundlesCount}つの束ね案を作ったよ。タップして確認してね。`;
  }
  // しつもんカードは連絡箱の中だけだと気づかれにくいので、ドックからも拾えるようにする
  if ((params.pendingQuestionCount || 0) > 0) {
    return 'ちょっとだけ聞きたいことがあるんだ。こたえてくれる？';
  }
  if (params.phase === 'night') return 'おやすみ。集めたものを、ProjectやAreaに合わせて束ねておくね。';
  if (hasUnknown && !confirmedFloating) return '「？」のカード、決まったら教えてね。';
  if (confirmedFloating >= 2) return 'たくさん集めたね。「束ねる（夜）」でまとめられるよ。';
  if (confirmedFloating === 1) return '拾っておいたよ。もう1つ集まったら束ねよう。';
  return '気になったものを「＋ 保存する」から送ってね。ここに浮かべるよ。';
}

// ホーム画面の英語見出しと日本語サブタイトルを算出する純粋ルール
export function computeHeadline(params: {
  floatingItems: SavedItem[];
  proposalStatus: ProposalStatus;
  phase: PhaseKind;
}): [string, string] {
  const n = params.floatingItems.filter((c) => c.intentConfirmed).length;
  if (params.proposalStatus === 'done') return ["It's built.", '島に、新しい建物が建ちました'];
  if (params.proposalStatus === 'doing') return ['In progress.', '今日の一歩、進行中'];
  if (params.proposalStatus === 'ready') return ["Today's\none step", '今日の一歩が届いています'];
  if (params.phase === 'night') return ['Good night.', 'おやすみの時間'];
  if (n > 0) return [`Today,\n${n} ${n === 1 ? 'thing.' : 'things.'}`, `今日は${n}つ浮かんでいます`];
  return ['A quiet\nisland.', '島はまだ静か'];
}

// 夜の整理（F5）の対象となる確定済み保存物を抽出するルール（見るだけ・参考およびArchivesは除外）
export function selectItemsForNightOrganize(items: SavedItem[]): SavedItem[] {
  const actionable = items.filter(
    (i) =>
      i.intentConfirmed &&
      i.intentStatus !== 'reference' &&
      i.para !== 'Resources' &&
      i.para !== 'Archives'
  );
  const unbundled = actionable.filter((i) => !i.bundleId);
  if (unbundled.length >= 2) return unbundled;
  if (actionable.length >= 2) return actionable.slice(-4);
  return [];
}

// F05: 今日の一歩の対象となるアクティブな Project または Bundle を選ぶ純粋ルール
// 条件:
// - 見るだけ（reference / Resources）・保留（pending / Someday）・Archive は除外
// - アクティブな Project に紐づく確定済み保存物があれば、最新更新の Project を優先選択
// - なければ承認済み（または提案可能）な Bundle を選択
export function selectTargetBundleForToday(params: {
  projects: ProjectEntity[];
  bundles: Bundle[];
  items: SavedItem[];
}): Bundle | null {
  const activeProjects = params.projects.filter((p) => p.status === 'active');

  // アクティブな Project ごとに、行動可能な確定意図を持つ保存物を収集
  let bestProject: { project: ProjectEntity; items: SavedItem[]; latestAt: number } | null = null;
  for (const proj of activeProjects) {
    const projItems = params.items.filter(
      (i) =>
        i.intentConfirmed &&
        i.intentStatus !== 'reference' &&
        i.para === 'Projects' &&
        (i.placementId === proj.id || i.bundleId === proj.id)
    );
    if (projItems.length > 0) {
      const latestAt = Math.max(...projItems.map((i) => i.createdAt), proj.updatedAt);
      if (!bestProject || latestAt > bestProject.latestAt) {
        bestProject = { project: proj, items: projItems, latestAt };
      }
    }
  }

  if (bestProject) {
    // 既存の対応 Bundle があればそれを返し、なければ Project から仮想 Bundle を構成
    const existingBundle = params.bundles.find(
      (b) =>
        (b.targetId === bestProject!.project.id || b.id === bestProject!.project.id) &&
        b.para !== 'Archives'
    );
    if (existingBundle) {
      return existingBundle;
    }
    return {
      id: `proj-bundle-${bestProject.project.id}`,
      intent: bestProject.project.name,
      points: [
        bestProject.project.goal || `${bestProject.project.name}に向けた一歩`,
        ...bestProject.items.slice(0, 2).map((i) => i.intent || i.title),
      ],
      tool: bestProject.project.name.slice(0, 12),
      itemIds: bestProject.items.map((i) => i.id),
      para: 'Projects',
      readyForProposal: true,
      buildingLevel: 0,
      targetId: bestProject.project.id,
      targetName: bestProject.project.name,
      approvalStatus: 'approved',
      createdAt: bestProject.project.createdAt,
      updatedAt: bestProject.latestAt,
    };
  }

  // Project 直紐づけがない場合は、既存の Projects 束を優先し、なければアイテムを持つ Areas 束から選択
  const readyBundle =
    params.bundles.find(
      (b) =>
        b.para === 'Projects' &&
        b.readyForProposal &&
        b.approvalStatus !== 'pending' &&
        b.buildingLevel === 0
    ) ||
    params.bundles.find((b) => b.para === 'Projects' && b.readyForProposal) ||
    params.bundles.find(
      (b) => b.para === 'Areas' && b.readyForProposal && b.itemIds.length > 0
    ) ||
    null;

  return readyBundle;
}

export function buildFallbackProposal(
  activeBundle: Bundle | null,
  proposalStatus: ProposalStatus
): Proposal {
  return {
    id: 'default-prop',
    bundleId: activeBundle?.id || 'default-bundle',
    ask: activeBundle
      ? `今日は、${activeBundle.intent}をやってみない？`
      : '集めた束から、今日の一歩を提案するよ',
    title: activeBundle
      ? `${activeBundle.tool || '最初'}のステップを15分だけ試す`
      : '最初の一歩',
    detail: activeBundle?.points[0] || 'まずは15分だけ、小さく始めてみよう。',
    minutes: 15,
    status: proposalStatus,
    createdAt: Date.now(),
  };
}

export function buildFallbackBundle(items: SavedItem[]): Bundle {
  return {
    id: 'default-bundle',
    intent: '保存したインスピレーションの束',
    points: ['集めた保存物の要点がここにまとまります'],
    tool: '',
    itemIds: items.map((i) => i.id),
    para: 'Projects',
    readyForProposal: true,
    buildingLevel: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// 保存物がその束に属しているかを判定する。
//
// このアプリは束の所属を 3 通りで表している:
//   - bundle.itemIds（束の側が持つ保存物 ID の配列）
//   - item.bundleId（保存物の側が持つ束 ID）
//   - item.placementId（Project / Area への配置先。束 ID が入ることがある）
//
// 片方しか見ないと取り残しが出る。実際、「手放す」が item.bundleId だけを見ていたため、
// itemIds だけで紐づいた保存物が Archives に移らず島に浮いたまま残っていた。
// 所属の判定は必ずこの関数を通すこと。
export function isItemInBundle(
  item: Pick<SavedItem, 'id' | 'bundleId' | 'placementId'>,
  bundle: Pick<Bundle, 'id' | 'itemIds'>
): boolean {
  if (item.bundleId === bundle.id) return true;
  if (item.placementId === bundle.id) return true;
  return bundle.itemIds.includes(item.id);
}

// 束を Archives に移すときに、その束に属する保存物へ当てる差分。
// 戻す先が分かるように previousPara を残し、島からは降ろす（floating: false）。
export function archiveItemsOfBundle(
  items: SavedItem[],
  bundle: Pick<Bundle, 'id' | 'itemIds'>
): SavedItem[] {
  return items.map((it) =>
    isItemInBundle(it, bundle)
      ? { ...it, previousPara: it.para, para: 'Archives' as const, floating: false }
      : it
  );
}
