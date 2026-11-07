import {
  getReadyBundleForUser,
  getUnbundledConfirmedItemsForUser,
  getUserBatchContext,
  hasProposalForLocalDate,
  listUserIds,
  saveMorningProposalForUser,
  saveNightBundlesForUser,
} from '../infrastructure/firestoreAdminRepository.js';
import { runMorningPropose, runNightOrganize } from './aiUseCases.js';

function formatLocalDate(timezone = 'Asia/Tokyo', nowMs = Date.now()): string {
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
    // fallback to JST
  }
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function executeNightOrganizeBatch(apiKey?: string): Promise<void> {
  const uids = await listUserIds(100);
  for (const uid of uids) {
    const ctx = await getUserBatchContext(uid);
    // R02: AI送信同意がオフのユーザーは自動バッチ処理の対象外にする
    if (!ctx.aiConsentGranted) continue;

    const unbundled = await getUnbundledConfirmedItemsForUser(uid);
    if (unbundled.length < 2) continue;

    const result = await runNightOrganize(
      { items: unbundled, targets: ctx.targets },
      apiKey
    );
    await saveNightBundlesForUser(uid, result.bundles);
  }
}

export async function executeMorningProposeBatch(apiKey?: string): Promise<void> {
  const uids = await listUserIds(100);
  for (const uid of uids) {
    const ctx = await getUserBatchContext(uid);
    if (!ctx.aiConsentGranted) continue;

    const localDate = formatLocalDate(ctx.timezone);
    // F05: 現地日付で既に当日の提案がある場合は新規生成しない（1日1件の冪等性）
    const alreadyHasToday = await hasProposalForLocalDate(uid, localDate);
    if (alreadyHasToday) continue;

    const bundle = await getReadyBundleForUser(uid);
    if (!bundle) continue;

    const step = await runMorningPropose(
      {
        bundle: {
          id: bundle.id,
          intent: bundle.intent,
          points: bundle.points,
          tool: bundle.tool,
          items: bundle.items,
        },
        previousStatus: ctx.previousStatus,
        characterName: ctx.characterName,
      },
      apiKey
    );
    await saveMorningProposalForUser(uid, bundle.id, localDate, ctx.timezone, step);
  }
}
