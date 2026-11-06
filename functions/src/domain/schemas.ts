import { z } from 'zod';

// F2 読み取り + F3 意図候補生成の入出力スキーマ
export const AnalyzeItemInputSchema = z.object({
  url: z.string().optional(),
  rawText: z.string().optional(),
  imageDataUrl: z.string().optional(),
  fileName: z.string().optional(),
});

export type AnalyzeItemInput = z.infer<typeof AnalyzeItemInputSchema>;

export const AnalyzeItemOutputSchema = z.object({
  kind: z.enum(['INSTAGRAM', 'ARTICLE', 'SCREENSHOT', 'PHOTO', 'VIDEO', 'NOTE']),
  title: z.string(),
  source: z.string(),
  note: z.string(),
  color: z.string(),
  c2: z.string(),
  intents: z.array(z.string()).min(3).max(3),
});

export type AnalyzeItemOutput = z.infer<typeof AnalyzeItemOutputSchema>;

// F3 意図確定 + Embedding 計算の入出力スキーマ
export const ConfirmIntentInputSchema = z.object({
  title: z.string(),
  intent: z.string(),
  note: z.string().optional(),
});

export type ConfirmIntentInput = z.infer<typeof ConfirmIntentInputSchema>;

export const ConfirmIntentOutputSchema = z.object({
  embedding: z.array(z.number()),
});

export type ConfirmIntentOutput = z.infer<typeof ConfirmIntentOutputSchema>;

// F5 夜の整理（束ねる）の入出力スキーマ
export const SavedItemSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  intent: z.string(),
  note: z.string().optional(),
  embedding: z.array(z.number()).optional(),
});

export const NightOrganizeInputSchema = z.object({
  items: z.array(SavedItemSummarySchema),
});

export type NightOrganizeInput = z.infer<typeof NightOrganizeInputSchema>;

export const BundleDraftSchema = z.object({
  intent: z.string(),
  points: z.array(z.string()).min(2).max(4),
  tool: z.string(),
  itemIds: z.array(z.string()),
  para: z.enum(['Projects', 'Areas', 'Resources', 'Archives', 'Someday']),
  readyForProposal: z.boolean(),
});

export type BundleDraft = z.infer<typeof BundleDraftSchema>;

export const NightOrganizeOutputSchema = z.object({
  bundles: z.array(BundleDraftSchema),
});

export type NightOrganizeOutput = z.infer<typeof NightOrganizeOutputSchema>;

// F6 朝の 1 日 1 提案の入出力スキーマ
export const MorningProposeInputSchema = z.object({
  bundle: z.object({
    id: z.string(),
    intent: z.string(),
    points: z.array(z.string()),
    tool: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        intent: z.string(),
      })
    ),
  }),
  previousStatus: z.enum(['none', 'mada', 'skipped']).optional(),
  characterName: z.string().optional(),
});

export type MorningProposeInput = z.infer<typeof MorningProposeInputSchema>;

export const MorningProposeOutputSchema = z.object({
  ask: z.string(),
  title: z.string(),
  detail: z.string(),
  minutes: z.number(),
});

export type MorningProposeOutput = z.infer<typeof MorningProposeOutputSchema>;
