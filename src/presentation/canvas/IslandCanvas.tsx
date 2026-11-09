import React, { useEffect, useRef, useState } from 'react';
import type {
  BuildingKind,
  CharacterKind,
  IslandStyleKind,
  PhaseKind,
  SavedItem,
} from '../../domain/models/islandModels';
import type {
  IslandCardOpt,
  IslandController,
  IslandMountOpts,
} from '../types/uiTypes';

function checkWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export interface IslandCanvasProps {
  styleKind: IslandStyleKind;
  character: CharacterKind;
  phase: PhaseKind;
  floatingItems: SavedItem[];
  hasBundleOnIsland: boolean;
  buildingProgress: number | null;
  buildingKind?: BuildingKind;
  extraBuildings?: BuildingKind[];
  anim: string;
  charAt: string;
  nonce: number;
  onCardTap: (item: SavedItem) => void;
  onCharTap: () => void;
  onReady?: () => void;
}

// 3D の島は一度マウントしたらアンマウントせず、ctrl.set() で差分更新する（ADR-002 / ADR-003）
export const IslandCanvas: React.FC<IslandCanvasProps> = ({
  styleKind,
  character,
  phase,
  floatingItems,
  hasBundleOnIsland,
  buildingProgress,
  buildingKind = 'atelier',
  extraBuildings = [],
  anim,
  charAt,
  nonce,
  onCardTap,
  onCharTap,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<IslandController | null>(null);
  const prevKeyRef = useRef<string>('');
  const floatingRef = useRef<SavedItem[]>(floatingItems);
  const onCardTapRef = useRef(onCardTap);
  const onCharTapRef = useRef(onCharTap);
  const [flatMode, setFlatMode] = useState<boolean>(false);
  // 島のマウントは非同期（three.js とフォントの読み込み待ち）。
  // その間に変わった状態を取りこぼさないよう、マウント完了後に一度だけ描画し直す
  const [, forceRender] = useState<number>(0);

  floatingRef.current = floatingItems;
  onCardTapRef.current = onCardTap;
  onCharTapRef.current = onCharTap;

  const buildOpts = (): IslandMountOpts => {
    const visible = floatingItems.slice(-4);
    const cards: IslandCardOpt[] = visible.map((it) => {
      if (!it.intentConfirmed) {
        return { unknown: true, kind: it.kind, color: it.color };
      }
      return {
        kind: it.kind,
        title: it.intent || it.title,
        color: it.color,
        sticker: it.stickerDataUrl,
        aspect: it.aspect || 1,
      };
    });

    return {
      style: styleKind,
      character,
      phase,
      cards,
      bundle: hasBundleOnIsland,
      building: buildingProgress,
      buildingKind,
      extraBuildings,
      empty:
        cards.length === 0 &&
        !hasBundleOnIsland &&
        buildingProgress == null &&
        extraBuildings.length === 0,
      anim: anim === 'none' ? null : anim,
      charAt,
      onCardTap: (idx: number) => {
        const list = floatingRef.current.slice(-4);
        const target = list[idx];
        if (target) onCardTapRef.current(target);
      },
      onCharTap: () => onCharTapRef.current(),
    };
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!checkWebGLAvailable()) {
      setFlatMode(true);
      onReady?.();
      return;
    }

    let cancelled = false;
    let waited = 0;

    const tryMount = () => {
      if (cancelled) return;
      if (window.THREE && window.Island) {
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
          if (cancelled || !containerRef.current || !window.Island) return;
          const opts = buildOpts();
          prevKeyRef.current = JSON.stringify([
            opts.style,
            opts.character,
            opts.phase,
            opts.cards,
            opts.bundle,
            opts.building,
            opts.buildingKind,
            opts.extraBuildings,
            opts.empty,
            opts.anim,
            opts.charAt,
            nonce,
          ]);
          ctrlRef.current = window.Island.mount(containerRef.current, opts);
          // マウント前に進んだ状態（初回体験のカメラ寄せなど）をここで反映させる
          forceRender((n) => n + 1);
          onReady?.();
        });
        return;
      }
      waited += 120;
      if (waited > 8000) {
        setFlatMode(true);
        onReady?.();
        return;
      }
      setTimeout(tryMount, 120);
    };

    tryMount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flatMode || !ctrlRef.current) return;
    const opts = buildOpts();
    const nextKey = JSON.stringify([
      opts.style,
      opts.character,
      opts.phase,
      opts.cards,
      opts.bundle,
      opts.building,
      opts.buildingKind,
      opts.extraBuildings,
      opts.empty,
      opts.anim,
      opts.charAt,
      nonce,
    ]);
    if (nextKey === prevKeyRef.current) return;
    prevKeyRef.current = nextKey;
    ctrlRef.current.set(opts);
  });

  if (flatMode) {
    const visible = floatingItems.slice(-4);
    return (
      <div className="island island--flat" ref={containerRef}>
        <div className="flat">
          <div className="flat__cards">
            {visible.map((c) => (
              <span
                key={c.id}
                onClick={() => onCardTap(c)}
                className={`flat__card${!c.intentConfirmed ? ' flat__card--q' : ''}`}
                style={{ '--c': c.color || '#9aa6b2', cursor: 'pointer' } as React.CSSProperties}
              >
                {!c.intentConfirmed ? '?' : ''}
              </span>
            ))}
          </div>
          <div className="flat__ground">
            {buildingProgress != null ? <span className="flat__building" /> : null}
            {hasBundleOnIsland ? <span className="flat__bundle" /> : null}
          </div>
        </div>
      </div>
    );
  }

  return <div className="island" id="island" ref={containerRef} />;
};
