export type ParaCategory = 'Projects' | 'Areas' | 'Resources' | 'Archives' | 'Someday';

export type ItemKind = 'INSTAGRAM' | 'ARTICLE' | 'SCREENSHOT' | 'PHOTO' | 'VIDEO' | 'NOTE';

export type CharacterKind = 'poko' | 'tomori' | 'fumi';
export type IslandStyleKind = 'puffy' | 'clay' | 'diorama';
export type ProposalStyleKind = 'sheet' | 'letter';
export type PhaseKind = 'day' | 'morning' | 'night';

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
  para: ParaCategory;
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
  createdAt: number;
  updatedAt: number;
}

export type ProposalStatus = 'none' | 'ready' | 'doing' | 'done' | 'mada' | 'skipped' | 'released';

export interface Proposal {
  id: string;
  bundleId: string;
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
  items: SavedItem[];
  bundles: Bundle[];
  proposals: Proposal[];
  activeProposalId: string | null;
  activeBundleId: string | null;
  proposalStatus: ProposalStatus;
}
