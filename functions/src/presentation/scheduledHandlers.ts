import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  executeMorningProposeBatch,
  executeNightOrganizeBatch,
} from '../application/scheduledBatchUseCases.js';
import { geminiApiKey } from './callableHandlers.js';

// 定時バッチはユーザー数ぶん逐次で回るため、既定の 60 秒では途中で切られる。
// 同時に 2 本走ると同じユーザーを二重に処理するので maxInstances は 1 に固定する。
const SCHEDULED_BATCH_OPTIONS = {
  timeZone: 'Asia/Tokyo' as const,
  region: 'asia-northeast1' as const,
  secrets: [geminiApiKey],
  maxInstances: 1,
  timeoutSeconds: 540,
  memory: '512MiB' as const,
};

export const scheduledNightOrganize = onSchedule(
  {
    ...SCHEDULED_BATCH_OPTIONS,
    schedule: 'every day 23:00',
  },
  async () => {
    const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    await executeNightOrganizeBatch(key);
  }
);

export const scheduledMorningPropose = onSchedule(
  {
    ...SCHEDULED_BATCH_OPTIONS,
    schedule: 'every day 08:00',
  },
  async () => {
    const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    await executeMorningProposeBatch(key);
  }
);
