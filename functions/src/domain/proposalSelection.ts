// 朝の提案（F6）で、どの束を今日の一歩の題材にするかを決める純粋ルール。
//
// フロント（src/domain/rules/islandRules.ts の selectTargetBundleForToday）は
// 「承認済み かつ まだ建っていない Projects 束」を優先し、無ければ Projects 束、
// 最後にアイテムを持つ Areas 束、という順で選ぶ。定時バッチ側はこの順序を持っておらず、
// `readyForProposal` で絞って Projects を先頭に寄せるだけだったため、
// 同じユーザーでも「手で押したとき」と「朝 8 時のジョブ」で別の束が選ばれ得た。
//
// requirements.md F6 は「実行可能な保存物がある**アクティブな** Project / Area について」と
// 書いているので、束の紐づけ先が archived になっている場合も対象から外す。
// フロントは Project 直紐づけの経路でしか status を見ていないが、要件に沿うのはこちら。

export interface ProposalCandidateBundle {
  id: string;
  para: string;
  readyForProposal?: boolean;
  approvalStatus?: string;
  buildingLevel?: number;
  itemIds?: string[];
  targetId?: string | null;
}

// 提案の題材にしない PARA。Someday は「意図確定・仕分け待ちの保留箱」なので対象外
const EXCLUDED_PARA = ['Archives', 'Resources', 'Someday'];

export function selectBundleForMorningProposal<T extends ProposalCandidateBundle>(
  bundles: T[],
  activeTargetIds: string[]
): T | null {
  const candidates = bundles.filter((b) => {
    if (!b.readyForProposal) return false;
    if (EXCLUDED_PARA.includes(b.para)) return false;
    // 紐づけ先が無い束は残す。紐づいている場合はアクティブなときだけ残す
    if (b.targetId && !activeTargetIds.includes(b.targetId)) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  return (
    candidates.find(
      (b) =>
        b.para === 'Projects' &&
        b.approvalStatus !== 'pending' &&
        (b.buildingLevel ?? 0) === 0
    ) ||
    candidates.find((b) => b.para === 'Projects') ||
    candidates.find((b) => b.para === 'Areas' && (b.itemIds?.length ?? 0) > 0) ||
    null
  );
}
