import type {
  ConfirmedSubject,
  DiscoveryFeedback,
  DiscoverySettings,
  ResearchReport,
} from './proactiveDiscoveryModels';

export type ParaCategory = 'Projects' | 'Areas' | 'Resources' | 'Archives' | 'Someday';

export type ItemKind = 'INSTAGRAM' | 'ARTICLE' | 'SCREENSHOT' | 'PHOTO' | 'VIDEO' | 'NOTE';

export type CharacterKind = 'poko' | 'tomori' | 'fumi' | 'mofu';
export type IslandStyleKind = 'puffy' | 'clay' | 'diorama';
export type ProposalStyleKind = 'sheet' | 'letter';
export type PhaseKind = 'day' | 'morning' | 'night';

// B1〜B6: ユースケース連動の3D建物ライブラリ種別
export type BuildingKind =
  | 'atelier'
  | 'kitchen_cafe'
  | 'study_tower'
  | 'greenhouse'
  | 'boutique'
  | 'pavilion';

// F01 / F03 / F04: ユーザーが取り組む具体的な Project
export interface ProjectEntity {
  id: string;
  name: string;
  goal: string;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

// F01 / F03: 継続して大切にしたい Area
export interface AreaEntity {
  id: string;
  name: string;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

// F01 / F02 / F05: 初回アンケート・AI同意・タイムゾーン設定
export interface UserSurveyProfile {
  onboardingCompleted: boolean;
  aiConsentGranted: boolean;
  aiConsentAt: number | null;
  timezone: string;
  pendingTimezone: string | null;
  interests: string[];
  expectations: string[];
}

// F03: 保存直後の Project / Area 照合結果
export type PlacementConfidence = 'clear' | 'multiple' | 'unknown';

export interface PlacementMatchResult {
  confidence: PlacementConfidence;
  targetKind: 'project' | 'area' | 'resource' | 'someday';
  targetId: string | null;
  candidateIds: string[];
  resourceTopic?: string;
  reason: string;
}

export interface SavedItem {
  id: string;
  kind: ItemKind;
  url?: string;
  rawText?: string;
  imageDataUrl?: string;
  stickerDataUrl?: string;
  aspect?: number;
  title: string;
  source: string;
  note: string;
  color: string;
  c2: string;
  intents: string[];
  intent: string | null;
  intentConfirmed: boolean;
  intentStatus?: 'pending' | 'confirmed' | 'reference';
  para: ParaCategory;
  previousPara?: ParaCategory;
  placementKind?: 'project' | 'area' | 'resource' | 'someday' | 'archive';
  placementId?: string | null;
  resourceTopic?: string;
  urlFetched?: boolean;
  bundleId: string | null;
  floating: boolean;
  embedding?: number[];
  createdAt: number;
}

export interface Bundle {
  id: string;
  intent: string;
  points: string[];
  tool: string;
  itemIds: string[];
  para: ParaCategory;
  readyForProposal: boolean;
  buildingLevel: number;
  buildingKind?: BuildingKind;
  targetId?: string | null;
  targetName?: string;
  approvalStatus?: 'pending' | 'approved';
  createdAt: number;
  updatedAt: number;
}

export type ProposalStatus = 'none' | 'ready' | 'doing' | 'done' | 'mada' | 'skipped' | 'released';

export interface Proposal {
  id: string;
  bundleId: string;
  projectId?: string | null;
  sourceItemIds?: string[];
  localDate?: string;
  timezoneAtCreation?: string;
  ask: string;
  title: string;
  detail: string;
  minutes: number;
  status: ProposalStatus;
  reflectWord?: string | null;
  reflectPhotoDataUrl?: string | null;
  createdAt: number;
}

export interface PersistedState {
  screen: 's1' | 'home';
  phase: PhaseKind;
  day: number;
  character: CharacterKind;
  islandStyle: IslandStyleKind;
  proposalStyle: ProposalStyleKind;
  buildingProgress: number | null;
  buildingKind?: BuildingKind;
  builtBuildings?: BuildingKind[];
  items: SavedItem[];
  bundles: Bundle[];
  proposals: Proposal[];
  projects?: ProjectEntity[];
  areas?: AreaEntity[];
  profile?: UserSurveyProfile;
  discoverySettings?: DiscoverySettings;
  confirmedSubjects?: ConfirmedSubject[];
  researchReports?: ResearchReport[];
  discoveryFeedbacks?: DiscoveryFeedback[];
  activeProposalId: string | null;
  activeBundleId: string | null;
  proposalStatus: ProposalStatus;
}
