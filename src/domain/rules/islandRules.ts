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
    // 「ツール」は island-growth-story.md の B3 の分類（ツール・学び・仕事・Second Brain）に入っているが、
    // この表から漏れていた。入れないと「新しいツールを試す」が B1 に落ちる
    /obsidian|second brain|ツール|情報整理|ノート|勉強|面接|就活|スライド|プレゼン|プログラミング|読書|本|書斎|統計/.test(
      text
    )
  ) {
    return 'study_tower';
  }
  if (
    // 「さんぽ」は「あさんぽ」に部分一致させるため（日々の暮らしの側に置く）
    /バジル|栽培|プランター|植物|花|ベランダ|机|収納|模様替え|部屋|暮らし|さんぽ|散歩|日記|睡眠|温室/.test(
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
  canPropose?: boolean;
  canBundle?: boolean;
  phase: PhaseKind;
  aiBusyLabel?: string | null;
  // 提案の所要時間。S4 の「目安◯分」と吹き出しの数字をそろえるために渡す（#45）
  proposalMinutes?: number | null;
  savedReaction?: string | null;
}): string {
  if (params.aiBusyLabel) return params.aiBusyLabel;
  // 保存した直後は、前の話題より先に保存への反応を返す（#44）
  if (params.savedReaction) return params.savedReaction;
  const confirmedFloating = params.floatingItems.filter((c) => c.intentConfirmed).length;
  const hasUnknown = params.floatingItems.some((c) => !c.intentConfirmed);

  if (params.proposalStatus === 'done') {
    const label = params.activeBundle?.tool || params.activeBundle?.targetName || '新しい';
    return `建ったね。${label}の建物。`;
  }
  if (params.proposalStatus === 'doing') {
    const m = params.proposalMinutes;
    return m ? `いってらっしゃい。${m}分だけでいいよ。` : 'いってらっしゃい。少しだけでいいよ。';
  }
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
  // ドックに［今日の一歩を見る］／［まとめる］を出すときの一言。ボタン名は文中に出さない
  if (params.canPropose) return '束が育ってきたね。今日の一歩、考えてみようか？';
  if (params.canBundle) return 'たくさん集めたね。似ているものをまとめてみる？';
  if (params.phase === 'night') return 'おやすみ。集めたものを、ProjectやAreaに合わせて束ねておくね。';
  if (hasUnknown && !confirmedFloating) return '「？」のカード、決まったら教えてね。';
  if (confirmedFloating >= 2) return 'たくさん集まってきたね。';
  if (confirmedFloating === 1) return '拾っておいたよ。もう1つ集まったら束ねよう。';
  return '気になったものを「＋ 保存する」から送ってね。ここに浮かべるよ。';
}

// 提案の一歩のタイトルから「たとえば：」の前置きを外す（#45）。
// 前置きはサーバーの提案生成（functions/src/application/aiUseCases.ts）が付けている
export function stripExampleLead(title: string): string {
  return title.replace(/^\s*たとえば\s*[：:]\s*/, '');
}

// ホームのドックに「まとめる」「今日の一歩」の入口を出すかを決める純粋ルール（#33）。
// 常時ボタンにせず、実行して意味がある日だけ出す。判定は実行側（夜の整理・朝の提案）と同じルールを使う
export function computeHomeActions(params: {
  items: SavedItem[];
  bundles: Bundle[];
  projects: ProjectEntity[];
  proposals: Proposal[];
  proposalStatus: ProposalStatus;
  todayLocal: string;
}): { canBundle: boolean; canPropose: boolean } {
  const canBundle = selectItemsForNightOrganize(params.items).length >= 2;
  // 見送った・手放した日も含め、提案は1日1件まで（requirements.md S4）
  const canPropose =
    params.proposalStatus === 'none' &&
    !params.proposals.some((p) => p.localDate === params.todayLocal) &&
    selectTargetBundleForToday(params) !== null;
  return { canBundle, canPropose };
}

// 保存した直後のキャラクターの一言（#44）。どう保存したかで言い方を変える
export function computeSavedReaction(
  how: 'intent' | 'reference' | 'later',
  title: string
): string {
  const t = title.trim();
  const short = t.length > 14 ? `${t.slice(0, 14)}…` : t;
  const name = short ? `「${short}」` : 'それ';
  if (how === 'reference') return `${name}は参考に、そっと置いておくね。`;
  if (how === 'later') return `${name}、どうしたいか決まったら教えてね。`;
  return `${name}、島に浮かべたよ。やりたいこと、覚えておくね。`;
}

// 保存後の画面で「本文を取得できなかった」の案内を別枠で出すか（#44）。
// サーバーの note がすでに同じことを伝えているなら、重ねて出さない
export function shouldShowFetchNotice(params: {
  url: string;
  urlFetched?: boolean;
  note: string;
}): boolean {
  if (!params.url.trim() || params.urlFetched !== false) return false;
  return !params.note.includes('取得');
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
