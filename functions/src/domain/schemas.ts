import { z } from 'zod';

// ---------- 入力の上限（イシュー #38: 不特定多数に叩かれたときの単価を縛る） ----------
// 匿名認証は無限に uid を作れるため「認証済み」だけでは課金の歯止めにならない。
// 1 リクエストで動かせる AI 呼び出しの量そのものに天井を置く。
// 値は「正当なクライアントが絶対に踏まない線」に取り、超えたら invalid-argument で弾く。
// 出力側のスキーマには上限を付けない（Gemini の応答を弾いて機能を落とすほうが損）。
//
// .transform() での切り詰めは使わない。ZodEffects になると Genkit の inputSchema 変換に通らない恐れがある。
const LIMIT_ID = 200;
const LIMIT_SHORT_TEXT = 500;
const LIMIT_URL = 2048;
const LIMIT_FILE_NAME = 300;
// 貼り付けでも現実的に届かない長さ。本文はこの先 aiUseCases 側でさらに切り詰められる
const LIMIT_RAW_TEXT = 50000;
// 正規クライアントは長辺 900px に縮小して送る（src/infrastructure/media/stickerMaker.ts）。
// 実測 1〜2MB 相当なので、その倍を上限にする。callable の 10MB まで積まれるのを防ぐのが目的
const LIMIT_IMAGE_DATA_URL = 3000000;
const LIMIT_TARGETS = 50;
// 夜の整理で受け取る保存物の最大件数。これを超える要求は正当な利用ではない。
// 実際に AI を回す件数の上限は別（aiUseCases.ts の NIGHT_ORGANIZE_ITEM_CAP）
export const NIGHT_ORGANIZE_ITEM_LIMIT = 200;
// gemini-embedding-001 の最大次元
const LIMIT_EMBEDDING_DIMENSIONS = 3072;

// ユーザーが登録した Project / Area ターゲット（F01 / F03）
export const ProjectAreaTargetSchema = z.object({
  id: z.string().max(LIMIT_ID),
  name: z.string().max(LIMIT_SHORT_TEXT),
  goal: z.string().max(LIMIT_SHORT_TEXT).optional(),
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
  url: z.string().max(LIMIT_URL).optional(),
  rawText: z.string().max(LIMIT_RAW_TEXT).optional(),
  imageDataUrl: z.string().max(LIMIT_IMAGE_DATA_URL).optional(),
  fileName: z.string().max(LIMIT_FILE_NAME).optional(),
  targets: z.array(ProjectAreaTargetSchema).max(LIMIT_TARGETS).optional(),
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
  title: z.string().max(LIMIT_SHORT_TEXT),
  intent: z.string().max(LIMIT_SHORT_TEXT),
  note: z.string().max(LIMIT_SHORT_TEXT).optional(),
  isReference: z.boolean().optional(),
  targets: z.array(ProjectAreaTargetSchema).max(LIMIT_TARGETS).optional(),
});

export type ConfirmIntentInput = z.infer<typeof ConfirmIntentInputSchema>;

export const ConfirmIntentOutputSchema = z.object({
  embedding: z.array(z.number()),
  placementMatch: PlacementMatchSchema.optional(),
});

export type ConfirmIntentOutput = z.infer<typeof ConfirmIntentOutputSchema>;

// F5 夜の整理（束ねる・Project/Area クラスター提案）の入出力スキーマ
export const SavedItemSummarySchema = z.object({
  id: z.string().max(LIMIT_ID),
  title: z.string().max(LIMIT_SHORT_TEXT),
  kind: z.string().max(LIMIT_ID),
  intent: z.string().max(LIMIT_SHORT_TEXT),
  note: z.string().max(LIMIT_SHORT_TEXT).optional(),
  embedding: z.array(z.number()).max(LIMIT_EMBEDDING_DIMENSIONS).optional(),
});

export const NightOrganizeInputSchema = z.object({
  items: z.array(SavedItemSummarySchema).max(NIGHT_ORGANIZE_ITEM_LIMIT),
  targets: z.array(ProjectAreaTargetSchema).max(LIMIT_TARGETS).optional(),
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
    id: z.string().max(LIMIT_ID),
    intent: z.string().max(LIMIT_SHORT_TEXT),
    points: z.array(z.string().max(LIMIT_SHORT_TEXT)).max(10),
    tool: z.string().max(LIMIT_SHORT_TEXT),
    items: z
      .array(
        z.object({
          title: z.string().max(LIMIT_SHORT_TEXT),
          intent: z.string().max(LIMIT_SHORT_TEXT),
        })
      )
      .max(NIGHT_ORGANIZE_ITEM_LIMIT),
  }),
  previousStatus: z.enum(['none', 'mada', 'skipped']).optional(),
  characterName: z.string().max(LIMIT_SHORT_TEXT).optional(),
});

export type MorningProposeInput = z.infer<typeof MorningProposeInputSchema>;

export const MorningProposeOutputSchema = z.object({
  ask: z.string(),
  title: z.string(),
  detail: z.string(),
  minutes: z.number(),
});

export type MorningProposeOutput = z.infer<typeof MorningProposeOutputSchema>;
