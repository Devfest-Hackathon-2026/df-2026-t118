// 定時バッチ（夜の束ね・朝の提案）が Firestore に書くドキュメントの形を決める純粋関数。
//
// ここを分けている理由:
// クライアントは users/{uid}/bundles と proposals を `d.data()` だけで読み、**doc id を捨てている**
// （src/infrastructure/firebase/firestoreRepository.ts）。そのため中身に `id` が入っていないと、
// 読み戻した時点で `id: undefined` になり、束と保存物の突合（items.bundleId === bundle.id）も、
// 提案の特定（proposals.find(p => p.id === activeProposalId)）も永久に外れる。
// さらに Bundle は buildingLevel が必須で、これも書かれていなかった。
//
// 「サーバーが書く形」と「クライアントが期待する型」がズレていても今までは気づけなかったので、
// 純粋関数に切り出して src/__tests__ から Bundle / Proposal 型への代入で固定する。
import type { BundleDraft, MorningProposeOutput } from './schemas.js';

export interface BundleDocument {
  id: string;
  intent: string;
  points: string[];
  tool: string;
  itemIds: string[];
  para: BundleDraft['para'];
  readyForProposal: boolean;
  buildingLevel: number;
  targetId?: string | null;
  targetName?: string;
  approvalStatus?: 'pending' | 'approved';
  createdAt: number;
  updatedAt: number;
}

export interface ProposalDocument {
  id: string;
  bundleId: string;
  localDate: string;
  timezoneAtCreation: string;
  ask: string;
  title: string;
  detail: string;
  minutes: number;
  status: 'ready';
  createdAt: number;
}

export function buildBundleDocument(
  draft: BundleDraft,
  id: string,
  nowMs: number
): BundleDocument {
  return {
    id,
    intent: draft.intent,
    points: draft.points,
    tool: draft.tool,
    itemIds: draft.itemIds,
    para: draft.para,
    readyForProposal: draft.readyForProposal,
    // 建物はまだ建っていない。未設定のまま書くと振り返り（F8）の +1 が NaN になる
    buildingLevel: 0,
    targetId: draft.targetId ?? null,
    targetName: draft.targetName,
    approvalStatus: draft.approvalStatus ?? 'pending',
    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

export function buildProposalDocument(params: {
  id: string;
  bundleId: string;
  localDate: string;
  timezone: string;
  step: MorningProposeOutput;
  nowMs: number;
}): ProposalDocument {
  return {
    id: params.id,
    bundleId: params.bundleId,
    localDate: params.localDate,
    timezoneAtCreation: params.timezone,
    ask: params.step.ask,
    title: params.step.title,
    detail: params.step.detail,
    minutes: params.step.minutes,
    status: 'ready',
    createdAt: params.nowMs,
  };
}
