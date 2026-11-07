export interface DiscoverySettings {
  aiConsentGranted: boolean;
  aiConsentAt: number | null;
  aiConsentVersion: string;
  searchConsentGranted: boolean;
  searchConsentAt: number | null;
  searchConsentVersion: string;
  notificationEnabled: boolean;
  notificationConsentAt: number | null;
  enabledProjectIds: string[];
  enabledAreaIds?: string[];
  budgetLimitUsd?: number;
  estimatedUsedUsd?: number;
  regionPreference: string;
  periodPreference: string;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  dailyReportLimit: number;
  questionCooldownDays: number;
  suppressionDaysForNotNow: number;
  customQueryOverride?: string;
  paused: boolean;
  updatedAt: number;
}

export interface ProfileFact {
  id: string;
  kind: 'artist' | 'creator' | 'curated_source' | 'region' | 'period' | 'interest';
  value: string;
  source: 'user_confirmed' | 'ai_hypothesis';
  status: 'confirmed' | 'unconfirmed' | 'rejected' | 'deleted';
  projectId: string | null;
  updatedAt: number;
}

export interface ConfirmedSubject {
  id: string;
  canonicalName: string;
  category: 'artist' | 'author' | 'designer' | 'curator';
  disambiguationHint?: string;
  officialUrl?: string;
  workExample?: string;
  frequency: 'often' | 'sometimes' | 'no' | 'unknown';
  confirmationState:
    | 'confirmed'
    | 'pending_disambiguation'
    | 'unconfirmed'
    | 'rejected'
    | 'deleted';
  source: 'manual_input' | 'screenshot_candidate';
  projectId: string | null;
  updatedAt: number;
}

export interface CuratedSource {
  id: string;
  name: string;
  url: string;
  curatorType: 'artist_official' | 'editor_magazine' | 'verified_api';
  selectedBy: 'user' | 'operator';
  termsVerified: boolean;
  allowDisplay: boolean;
  allowStorage: boolean;
  allowAiProcessing: boolean;
}

export interface DiscoveryQuestion {
  id: string;
  projectId: string | null;
  kind: 'artist_check' | 'disambiguation' | 'region_period' | 'curated_source';
  prompt: string;
  options: string[];
  allowFreeText: boolean;
  status: 'pending' | 'answered' | 'skipped' | 'declined';
  answer?: string;
  candidateSubjectId?: string;
  createdAt: number;
  answeredAt?: number;
}

export interface VerifiedDiscoveryCard {
  candidateId: string;
  dedupeKey: string;
  projectId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  whyFound: string;
  recommendedBy: string;
  curatorType: 'artist_official' | 'editor_magazine' | 'verified_api';
  eventDate: string;
  startTime?: string;
  venue: string;
  region: string;
  sourceTitle: string;
  sourceUrl: string;
  verifiedAt: number;
  priceOrStatusNote?: string;
  score: number;
  scoreBreakdown: string[];
}

export interface DiscoveryFeedback {
  id: string;
  reportId: string;
  candidateId: string;
  subjectId: string;
  reaction: 'like' | 'dislike' | 'not_now' | 'viewed_detail' | 'closed_no_answer';
  reason?: string;
  suppressedUntil?: number | null;
  createdAt: number;
}

export interface InvestigationMemo {
  executedAt: number;
  searchPerformed: boolean;
  queryUsed: string | null;
  targetProjectId: string | null;
  targetProjectName: string | null;
  sourcesReceived: Array<{
    title: string;
    url: string;
    curatorName: string;
    verifiedAt: number;
    isOfficial: boolean;
  }>;
  summary: string;
  uncertaintyNote: string;
}

export interface ResearchReport {
  id: string;
  jobId: string;
  uid: string;
  localDate: string;
  projectId: string | null;
  status:
    | 'card_ready'
    | 'question_only'
    | 'no_candidate'
    | 'unverified_source'
    | 'search_off'
    | 'paused_or_no_project'
    | 'provider_error';
  executedAt: number;
  card: VerifiedDiscoveryCard | null;
  question: DiscoveryQuestion | null;
  investigationMemo: InvestigationMemo;
  notificationState:
    | 'not_requested'
    | 'skipped_consent_off'
    | 'skipped_quiet_hours'
    | 'provider_accepted_unverified_device'
    | 'opened_in_inbox'
    | 'failed';
  feedback: DiscoveryFeedback | null;
}

export interface NotificationSubscriptionRecord {
  id: string;
  deviceId: string;
  status: 'active' | 'revoked' | 'unsupported';
  deliveryNote: string;
  updatedAt: number;
}
