import { z } from 'zod';

// ユーザーが登録した Project / Area ターゲット（F01 / F03）
export const ProjectAreaTargetSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().optional(),
  kind: z.enum(['project', 'area']),
});

export type ProjectAreaTarget = z.infer<typeof ProjectAreaTargetSchema>;

// 保存直後の Project / Area 照合結果（F03: 明らか / 迷う（複数） / わからない（保留））
export const PlacementMatchSchema = z.object({
  confidence: z.enum(['clear', 'multiple', 'unknown']),
  targetKind: z.enum(['project', 'area', 'resource', 'someday']),
  targetId: z.string().nullable(),
  candidateIds: z.array(z.string()),
  resourceTopic: z.string().optional(),
  reason: z.string(),
});

export type PlacementMatch = z.infer<typeof PlacementMatchSchema>;

// F2 読み取り + F3 意図候補生成の入出力スキーマ
export const AnalyzeItemInputSchema = z.object({
  url: z.string().optional(),
  rawText: z.string().optional(),
  imageDataUrl: z.string().optional(),
  fileName: z.string().optional(),
  targets: z.array(ProjectAreaTargetSchema).optional(),
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
  urlFetched: z.boolean().optional(),
  resourceTopic: z.string().optional(),
});

export type AnalyzeItemOutput = z.infer<typeof AnalyzeItemOutputSchema>;

// F3 意図確定 + Embedding 計算 + F03 Project/Area 照合の入出力スキーマ
export const ConfirmIntentInputSchema = z.object({
  title: z.string(),
  intent: z.string(),
  note: z.string().optional(),
  isReference: z.boolean().optional(),
  targets: z.array(ProjectAreaTargetSchema).optional(),
});

export type ConfirmIntentInput = z.infer<typeof ConfirmIntentInputSchema>;

export const ConfirmIntentOutputSchema = z.object({
  embedding: z.array(z.number()),
  placementMatch: PlacementMatchSchema.optional(),
});

export type ConfirmIntentOutput = z.infer<typeof ConfirmIntentOutputSchema>;

// F5 夜の整理（束ねる・Project/Area クラスター提案）の入出力スキーマ
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
  targets: z.array(ProjectAreaTargetSchema).optional(),
});

export type NightOrganizeInput = z.infer<typeof NightOrganizeInputSchema>;

export const BundleDraftSchema = z.object({
  intent: z.string(),
  points: z.array(z.string()).min(2).max(4),
  tool: z.string(),
  itemIds: z.array(z.string()),
  para: z.enum(['Projects', 'Areas', 'Resources', 'Archives', 'Someday']),
  readyForProposal: z.boolean(),
  targetId: z.string().nullable().optional(),
  targetName: z.string().optional(),
  approvalStatus: z.enum(['pending', 'approved']).optional(),
});

export type BundleDraft = z.infer<typeof BundleDraftSchema>;

export const NightOrganizeOutputSchema = z.object({
  bundles: z.array(BundleDraftSchema),
});

export type NightOrganizeOutput = z.infer<typeof NightOrganizeOutputSchema>;

// F6 / F05 今日の一歩提案の入出力スキーマ
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
