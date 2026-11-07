import React, { useState } from 'react';
import { stripes } from '../../domain/constants/islandConstants';
import type {
  AreaEntity,
  Bundle,
  ParaCategory,
  ProjectEntity,
  SavedItem,
} from '../../domain/models/islandModels';
import { Icon } from '../common/UiParts';

export const S5BundleSheet: React.FC<{
  bundle: Bundle;
  items: SavedItem[];
  projects?: ProjectEntity[];
  areas?: AreaEntity[];
  canGoBackToProposal: boolean;
  onBack: () => void;
  onSelectItem: (itemId: string) => void;
  onUpdateBundleIntent: (bundleId: string, nextIntent: string) => void;
  onApproveBundle?: (
    bundleId: string,
    overridePara?: ParaCategory,
    overrideTargetId?: string | null
  ) => void;
  onReleaseBundle: (bundleId: string) => void;
  onCompleteBundleToArchive?: (bundleId: string) => void;
  onRestoreBundle?: (bundleId: string) => void;
}> = ({
  bundle,
  items,
  projects = [],
  areas = [],
  canGoBackToProposal,
  onBack,
  onSelectItem,
  onUpdateBundleIntent,
  onApproveBundle,
  onReleaseBundle,
  onCompleteBundleToArchive,
  onRestoreBundle,
}) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [intentText, setIntentText] = useState<string>(bundle.intent);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    bundle.targetId || null
  );

  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeAreas = areas.filter((a) => a.status === 'active');

  const handleSaveIntent = () => {
    const trimmed = intentText.trim();
    if (trimmed) {
      onUpdateBundleIntent(bundle.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <>
      <div className="bundle__top">
        <span className="eyebrow eyebrow--accent">
          BUNDLE · {bundle.para.toUpperCase()}
          {bundle.approvalStatus === 'pending' ? ' · 承認待ち' : ''}
        </span>
        {canGoBackToProposal ? (
          <button className="iconbtn iconbtn--soft" onClick={onBack} aria-label="もどる">
            <Icon name="arrow_back" />
          </button>
        ) : (
          <button className="iconbtn iconbtn--soft" onClick={onBack} aria-label="閉じる">
            <Icon name="close" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="inputpill">
          <input
            type="text"
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveIntent();
            }}
          />
          <button
            className="iconbtn iconbtn--ink iconbtn--sm"
            onClick={handleSaveIntent}
            aria-label="保存"
          >
            <Icon name="check" />
          </button>
        </div>
      ) : (
        <h2 className="bundle__intent">{bundle.intent}</h2>
      )}

      {bundle.approvalStatus === 'pending' && onApproveBundle ? (
        <div className="card" style={{ border: '1.5px solid var(--accent)' }}>
          <span className="eyebrow eyebrow--accent">
            NIGHT CLUSTERING PROPOSAL · 夜の束ね提案
          </span>
          <span style={{ fontSize: '13px' }}>
            似た意図の保存物をまとめました。紐づける Project / Area を選んで承認できます。
          </span>
          {activeProjects.length > 0 || activeAreas.length > 0 ? (
            <div className="row-chips">
              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  className={`chip${selectedTargetId === p.id ? ' chip--ink' : ' chip--soft'}`}
                  onClick={() => setSelectedTargetId(p.id)}
                >
                  Project: {p.name}
                </button>
              ))}
              {activeAreas.map((a) => (
                <button
                  key={a.id}
                  className={`chip${selectedTargetId === a.id ? ' chip--ink' : ' chip--soft'}`}
                  onClick={() => setSelectedTargetId(a.id)}
                >
                  Area: {a.name}
                </button>
              ))}
            </div>
          ) : null}
          <button
            className="btn btn--ink btn--pill"
            onClick={() => onApproveBundle(bundle.id, undefined, selectedTargetId)}
          >
            <Icon name="check" />
            この束ね案を承認する
          </button>
        </div>
      ) : null}

      <div className="card kp">
        <span className="eyebrow eyebrow--muted">KEY POINTS · AI SUMMARY</span>
        {bundle.points.map((p, i) => (
          <div key={i} className="kp__row">
            <span className="kp__n">{String(i + 1).padStart(2, '0')}</span>
            <span>{p}</span>
          </div>
        ))}
      </div>

      <span className="eyebrow eyebrow--muted">SAVED PIECES ({items.length})</span>
      {items.map((x) => (
        <div
          key={x.id}
          className="piece"
          onClick={() => onSelectItem(x.id)}
          style={{ cursor: 'pointer' }}
        >
          <span
            className="piece__thumb"
            style={{
              background: x.stickerDataUrl
                ? `#fff url(${x.stickerDataUrl}) center/cover`
                : stripes(x.color, x.c2, 6),
            }}
          />
          <div className="piece__body">
            <span className="eyebrow eyebrow--accent">
              {x.kind} · {x.source}
            </span>
            <span className="piece__title">{x.title}</span>
          </div>
          <Icon name="chevron_right" className="icon--muted" />
        </div>
      ))}

      {items.length === 0 ? (
        <div className="card" style={{ fontSize: '13px', color: 'var(--muted)' }}>
          まだこの Project / Area に紐づいた保存物はありません。「＋ 保存する」から追加できます。
        </div>
      ) : null}

      {bundle.tool ? (
        <div className="row-chips">
          <span className="chip chip--soft">Tool · {bundle.tool}</span>
        </div>
      ) : null}

      <div className="row2">
        <button
          className="btn btn--ghost btn--pill"
          onClick={() => {
            setIntentText(bundle.intent);
            setEditing((v) => !v);
          }}
        >
          意図を書きなおす
        </button>
        {bundle.para === 'Archives' && onRestoreBundle ? (
          <button
            className="btn btn--ink btn--pill"
            onClick={() => onRestoreBundle(bundle.id)}
          >
            Archives から復元する
          </button>
        ) : (
          <button
            className="btn btn--ghost btn--pill"
            onClick={() => onReleaseBundle(bundle.id)}
          >
            束ごと手放す (Archive)
          </button>
        )}
      </div>

      {bundle.para === 'Projects' && onCompleteBundleToArchive ? (
        <button
          className="btn btn--ink btn--pill"
          onClick={() => onCompleteBundleToArchive(bundle.id)}
        >
          <Icon name="check" />
          達成・完了して Archives に残す
        </button>
      ) : null}
    </>
  );
};
