import type {
  Bundle,
  PhaseKind,
  Proposal,
  ProposalStatus,
  SavedItem,
} from '../models/islandModels';

// キャラクターの吹き出しテキストをドメイン状態から算出する純粋ルール
export function computeBubbleText(params: {
  floatingItems: SavedItem[];
  proposalStatus: ProposalStatus;
  activeBundle?: Bundle | null;
  phase: PhaseKind;
  aiBusyLabel?: string | null;
}): string {
  if (params.aiBusyLabel) return params.aiBusyLabel;
  const confirmedFloating = params.floatingItems.filter((c) => c.intentConfirmed).length;
  const hasUnknown = params.floatingItems.some((c) => !c.intentConfirmed);

  if (params.proposalStatus === 'done') {
    const label = params.activeBundle?.tool || '新しい';
    return `建ったね。${label}の建物。`;
  }
  if (params.proposalStatus === 'doing') return 'いってらっしゃい。15分だけでいいよ。';
  if (params.proposalStatus === 'ready') return 'おはよう。今日の一歩、見てみる？';
  if (params.proposalStatus === 'skipped') return 'うん、また明日ね。';
  if (params.proposalStatus === 'released') return '手放したよ。海にそっと流しておくね。';
  if (params.proposalStatus === 'mada') return 'だいじょうぶ。次はもう少し小さくしてみるね。';
  if (params.phase === 'night') return 'おやすみ。集めたものを、ひとつに束ねておくね。';
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

// 夜の整理（F5）の対象となる確定済み保存物を抽出するルール（2件以上必要）
export function selectItemsForNightOrganize(items: SavedItem[]): SavedItem[] {
  const confirmedUnbundled = items.filter((i) => i.intentConfirmed && !i.bundleId);
  const confirmedAll = items.filter((i) => i.intentConfirmed && i.para !== 'Archives');
  if (confirmedUnbundled.length >= 2) return confirmedUnbundled;
  if (confirmedAll.length >= 2) return confirmedAll.slice(-4);
  return [];
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
