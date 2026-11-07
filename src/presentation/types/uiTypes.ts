import type {
  BuildingKind,
  CharacterKind,
  IslandStyleKind,
  ItemKind,
  PhaseKind,
} from '../../domain/models/islandModels';

export type SheetKind =
  | null
  | 'save'
  | 'proposal'
  | 'letter'
  | 'bundle'
  | 'reflect'
  | 'item'
  | 'search'
  | 'sort'
  | 'inbox'
  | 'settings';

export interface SaveDraft {
  url: string;
  rawText: string;
  imageDataUrl?: string;
  stickerDataUrl?: string;
  aspect?: number;
  fileName?: string;
  selectedTargetId?: string | null;
  analyzed?: {
    kind: ItemKind;
    title: string;
    source: string;
    note: string;
    color: string;
    c2: string;
    intents: string[];
    urlFetched?: boolean;
    resourceTopic?: string;
  };
}

export function emptyDraft(): SaveDraft {
  return {
    url: '',
    rawText: '',
    selectedTargetId: null,
  };
}

// window.Island の型定義（src/vendor/island.js）
export interface IslandCardOpt {
  unknown?: boolean;
  kind: string;
  title?: string;
  color?: string;
  sticker?: string;
  aspect?: number;
}

export interface IslandMountOpts {
  style: IslandStyleKind;
  character: CharacterKind;
  phase: PhaseKind;
  cards: IslandCardOpt[];
  bundle: boolean;
  building: number | null;
  buildingKind?: BuildingKind;
  extraBuildings?: BuildingKind[];
  empty: boolean;
  anim: string | null;
  charAt: string;
  onCardTap: (index: number) => void;
  onCharTap: () => void;
}

export interface IslandController {
  set: (opts: IslandMountOpts) => void;
}

declare global {
  interface Window {
    THREE?: unknown;
    Island?: {
      mount: (el: HTMLElement, opts: IslandMountOpts) => IslandController;
      makeSticker: (
        dataUrl: string | null,
        opts?: {
          removeBg?: boolean;
          shape?: string;
          color?: string;
          label?: string;
        }
      ) => Promise<{ url: string; aspect: number }>;
    };
  }
}
