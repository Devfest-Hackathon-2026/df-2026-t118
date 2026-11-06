import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  executeMorningProposeBatch,
  executeNightOrganizeBatch,
} from '../application/scheduledBatchUseCases.js';
import { geminiApiKey } from './callableHandlers.js';

export const scheduledNightOrganize = onSchedule(
  {
    schedule: 'every day 23:00',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: [geminiApiKey],
  },
  async () => {
    const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    await executeNightOrganizeBatch(key);
  }
);

export const scheduledMorningPropose = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
    secrets: [geminiApiKey],
  },
  async () => {
    const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    await executeMorningProposeBatch(key);
  }
);
