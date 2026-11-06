import React, { useState } from 'react';
import { stripes } from '../../domain/constants/islandConstants';
import type { Bundle, SavedItem } from '../../domain/models/islandModels';
import { Icon } from '../common/UiParts';

export const S5BundleSheet: React.FC<{
  bundle: Bundle;
  items: SavedItem[];
  canGoBackToProposal: boolean;
  onBack: () => void;
  onSelectItem: (itemId: string) => void;
  onUpdateBundleIntent: (bundleId: string, nextIntent: string) => void;
  onReleaseBundle: (bundleId: string) => void;
}> = ({
  bundle,
  items,
  canGoBackToProposal,
  onBack,
  onSelectItem,
  onUpdateBundleIntent,
  onReleaseBundle,
}) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [intentText, setIntentText] = useState<string>(bundle.intent);

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
        <span className="eyebrow eyebrow--accent">BUNDLE · {bundle.para.toUpperCase()}</span>
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
        <button
          className="btn btn--ghost btn--pill"
          onClick={() => onReleaseBundle(bundle.id)}
        >
          束ごと手放す
        </button>
      </div>
    </>
  );
};
