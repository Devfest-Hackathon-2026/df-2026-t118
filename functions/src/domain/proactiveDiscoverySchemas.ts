import { z } from 'zod';

// A02 / A04: 個別同意・対象Project・時間帯・制限設定（検索・通知のデフォルトは OFF）
export const DiscoverySettingsSchema = z.object({
  aiConsentGranted: z.boolean().default(false),
  aiConsentAt: z.number().nullable().default(null),
  aiConsentVersion: z.string().default('v1'),
  searchConsentGranted: z.boolean().default(false),
  searchConsentAt: z.number().nullable().default(null),
  searchConsentVersion: z.string().default('v1'),
  notificationEnabled: z.boolean().default(false),
  notificationConsentAt: z.number().nullable().default(null),
  enabledProjectIds: z.array(z.string()).default([]),
  enabledAreaIds: z.array(z.string()).optional(),
  budgetLimitUsd: z.number().min(0.5).max(50).optional(),
  estimatedUsedUsd: z.number().min(0).optional(),
  regionPreference: z.string().default(''),
  periodPreference: z.string().default(''),
  timezone: z.string().default('Asia/Tokyo'),
  quietHoursStart: z.number().min(0).max(23).default(22),
  quietHoursEnd: z.number().min(0).max(23).default(8),
  dailyReportLimit: z.number().min(0).max(3).default(1),
  questionCooldownDays: z.number().min(1).max(30).default(3),
  suppressionDaysForNotNow: z.number().min(1).max(90).default(14),
  customQueryOverride: z.string().optional(),
  paused: z.boolean().default(false),
  updatedAt: z.number().default(0),
});

export type DiscoverySettings = z.infer<typeof DiscoverySettingsSchema>;

// A01: 本人回答（確認済み情報）と AI推測（未確認仮説）を明確に分離する ProfileFact
export const ProfileFactSchema = z.object({
  id: z.string(),
  kind: z.enum(['artist', 'creator', 'curated_source', 'region', 'period', 'interest']),
  value: z.string(),
  source: z.enum(['user_confirmed', 'ai_hypothesis']),
  status: z.enum(['confirmed', 'unconfirmed', 'rejected', 'deleted']),
  projectId: z.string().nullable().default(null),
  updatedAt: z.number(),
});

export type ProfileFact = z.infer<typeof ProfileFactSchema>;

// A01: 本人確認済みのアーティスト／作家（AI候補や同名未解決とは区別）
export const ConfirmedSubjectSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  category: z.enum(['artist', 'author', 'designer', 'curator']).default('artist'),
  disambiguationHint: z.string().optional(),
  officialUrl: z.string().optional(),
  workExample: z.string().optional(),
  frequency: z.enum(['often', 'sometimes', 'no', 'unknown']).default('unknown'),
  confirmationState: z
    .enum(['confirmed', 'pending_disambiguation', 'unconfirmed', 'rejected', 'deleted'])
    .default('unconfirmed'),
  source: z.enum(['manual_input', 'screenshot_candidate']).default('manual_input'),
  projectId: z.string().nullable().default(null),
  updatedAt: z.number(),
});

export type ConfirmedSubject = z.infer<typeof ConfirmedSubjectSchema>;

// A02: 信頼する人・編集媒体・公式情報源（利用条件と本人同意を別管理）
export const CuratedSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  curatorType: z.enum(['artist_official', 'editor_magazine', 'verified_api']),
  selectedBy: z.enum(['user', 'operator']),
  termsVerified: z.boolean().default(false),
  allowDisplay: z.boolean().default(false),
  allowStorage: z.boolean().default(false),
  allowAiProcessing: z.boolean().default(false),
});

export type CuratedSource = z.infer<typeof CuratedSourceSchema>;

// A01: 選択式の質問カード（未回答・辞退を区別し、自由会話チャットにはしない）
export const DiscoveryQuestionSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  kind: z.enum(['artist_check', 'disambiguation', 'region_period', 'curated_source']),
  prompt: z.string(),
  options: z.array(z.string()),
  allowFreeText: z.boolean().default(true),
  status: z.enum(['pending', 'answered', 'skipped', 'declined']).default('pending'),
  answer: z.string().optional(),
  candidateSubjectId: z.string().optional(),
  createdAt: z.number(),
  answeredAt: z.number().optional(),
});

export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestionSchema>;

// A02 / A03: 外部検索アダプタから返る生候補（検証前）
export const RawDiscoveryCandidateSchema = z.object({
  candidateId: z.string(),
  officialEventId: z.string().optional(),
  subjectName: z.string(),
  disambiguationHint: z.string().optional(),
  eventName: z.string(),
  eventDate: z.string(), // YYYY-MM-DD
  startTime: z.string().optional(), // HH:mm（昼夜公演の区別用）
  venue: z.string(),
  region: z.string(),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
  curatorName: z.string(),
  curatorType: z.enum(['artist_official', 'editor_magazine', 'verified_api']),
  officialVerified: z.boolean(),
  termsPermitted: z.boolean().default(true),
  eventStatus: z.enum(['scheduled', 'postponed', 'cancelled', 'past']).default('scheduled'),
  priceOrStatusNote: z.string().optional(),
  recommendationReason: z.string(),
  fetchedAt: z.number(),
});

export type RawDiscoveryCandidate = z.infer<typeof RawDiscoveryCandidateSchema>;

// A03: 検証を通過した発見カード（最大1件）
export const VerifiedDiscoveryCardSchema = z.object({
  candidateId: z.string(),
  dedupeKey: z.string(),
  projectId: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  title: z.string(),
  whyFound: z.string(),
  recommendedBy: z.string(),
  curatorType: z.enum(['artist_official', 'editor_magazine', 'verified_api']),
  eventDate: z.string(),
  startTime: z.string().optional(),
  venue: z.string(),
  region: z.string(),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
  verifiedAt: z.number(),
  priceOrStatusNote: z.string().optional(),
  score: z.number(),
  scoreBreakdown: z.array(z.string()),
});

export type VerifiedDiscoveryCard = z.infer<typeof VerifiedDiscoveryCardSchema>;

// A03: 発見カードに対する本人反応（好き / 違う / 今は不要 / 無回答を分離）
export const DiscoveryFeedbackSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  candidateId: z.string(),
  subjectId: z.string(),
  reaction: z.enum(['like', 'dislike', 'not_now', 'viewed_detail', 'closed_no_answer']),
  reason: z.string().optional(),
  suppressedUntil: z.number().nullable().optional(),
  createdAt: z.number(),
});

export type DiscoveryFeedback = z.infer<typeof DiscoveryFeedbackSchema>;

// A02: 調査メモ（検索の透明性・出典・不確かさの記録）
export const InvestigationMemoSchema = z.object({
  executedAt: z.number(),
  searchPerformed: z.boolean(),
  queryUsed: z.string().nullable(),
  targetProjectId: z.string().nullable(),
  targetProjectName: z.string().nullable(),
  sourcesReceived: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      curatorName: z.string(),
      verifiedAt: z.number(),
      isOfficial: z.boolean(),
    })
  ),
  summary: z.string(),
  uncertaintyNote: z.string(),
});

export type InvestigationMemo = z.infer<typeof InvestigationMemoSchema>;

// A02 / A03 / A04: 連絡箱に保存されるレポート（1日最大1件）
export const ResearchReportSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  uid: z.string(),
  localDate: z.string(),
  projectId: z.string().nullable(),
  status: z.enum([
    'card_ready',
    'question_only',
    'no_candidate',
    'unverified_source',
    'search_off',
    'paused_or_no_project',
    'provider_error',
  ]),
  executedAt: z.number(),
  card: VerifiedDiscoveryCardSchema.nullable(),
  question: DiscoveryQuestionSchema.nullable(),
  investigationMemo: InvestigationMemoSchema,
  notificationState: z
    .enum([
      'not_requested',
      'skipped_consent_off',
      'skipped_quiet_hours',
      'provider_accepted_unverified_device',
      'opened_in_inbox',
      'failed',
    ])
    .default('not_requested'),
  feedback: DiscoveryFeedbackSchema.nullable().default(null),
});

export type ResearchReport = z.infer<typeof ResearchReportSchema>;

// Section 4: 重複・中断制御用ジョブ（claim / lease 管理）
export const ResearchJobSchema = z.object({
  jobId: z.string(),
  uid: z.string(),
  projectId: z.string(),
  periodKey: z.string(),
  kind: z.enum(['concert_discovery', 'curated_discovery']),
  status: z.enum(['claimed', 'completed', 'failed', 'aborted_no_consent']),
  leaseUntil: z.number(),
  attempt: z.number(),
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  failureCode: z.string().nullable(),
  settingsVersion: z.string(),
});

export type ResearchJob = z.infer<typeof ResearchJobSchema>;

// Callable / HTTP API 入出力スキーマ
export const RunDiscoveryCycleInputSchema = z.object({
  uid: z.string().default('local-dev-user'),
  localDate: z.string(),
  currentHour: z.number().min(0).max(23).default(10),
  settings: DiscoverySettingsSchema,
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      goal: z.string().optional(),
      status: z.enum(['active', 'archived']),
    })
  ),
  areas: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(['active', 'archived']),
      })
    )
    .optional(),
  confirmedSubjects: z.array(ConfirmedSubjectSchema),
  curatedSources: z.array(CuratedSourceSchema).default([]),
  previousFeedbacks: z.array(DiscoveryFeedbackSchema).default([]),
  alreadyNotifiedDedupeKeys: z.array(z.string()).default([]),
  existingReportForDate: ResearchReportSchema.nullable().optional(),
  simulateProviderError: z.boolean().optional(),
});

export type RunDiscoveryCycleInput = z.infer<typeof RunDiscoveryCycleInputSchema>;
