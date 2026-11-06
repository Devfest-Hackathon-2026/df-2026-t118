import {
  getReadyBundleForUser,
  getUnbundledConfirmedItemsForUser,
  listUserIds,
  saveMorningProposalForUser,
  saveNightBundlesForUser,
} from '../infrastructure/firestoreAdminRepository.js';
import { runMorningPropose, runNightOrganize } from './aiUseCases.js';

export async function executeNightOrganizeBatch(apiKey?: string): Promise<void> {
  const uids = await listUserIds(100);
  for (const uid of uids) {
    const unbundled = await getUnbundledConfirmedItemsForUser(uid);
    if (unbundled.length < 2) continue;

    const result = await runNightOrganize({ items: unbundled }, apiKey);
    await saveNightBundlesForUser(uid, result.bundles);
  }
}

export async function executeMorningProposeBatch(apiKey?: string): Promise<void> {
  const uids = await listUserIds(100);
  for (const uid of uids) {
    const bundle = await getReadyBundleForUser(uid);
    if (!bundle) continue;

    const step = await runMorningPropose(
      {
        bundle: {
          id: bundle.id,
          intent: bundle.intent,
          points: bundle.points,
          tool: bundle.tool,
          items: [],
        },
      },
      apiKey
    );
    await saveMorningProposalForUser(uid, bundle.id, step);
  }
}
