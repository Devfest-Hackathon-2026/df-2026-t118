import React, { useState } from 'react';
import { PARA_TABS, stripes } from '../../domain/constants/islandConstants';
import type { Bundle, ParaCategory, SavedItem } from '../../domain/models/islandModels';
import { Icon } from '../common/UiParts';

export const S9ItemSheet: React.FC<{
  item: SavedItem;
  parentBundle: Bundle | null;
  onUpdateIntent: (itemId: string, nextIntent: string) => void;
  onChangePara: (itemId: string, nextPara: ParaCategory) => void;
  onOpenBundle: (bundleId: string) => void;
}> = ({ item, parentBundle, onUpdateIntent, onChangePara, onOpenBundle }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [intentText, setIntentText] = useState<string>(
    item.intent || item.intents[0] || item.title
  );

  const handleSave = () => {
    const trimmed = intentText.trim();
    if (trimmed) {
      onUpdateIntent(item.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <>
      <div
        className="item__img"
        style={{
          background: item.imageDataUrl
            ? `#e9e4de url(${item.imageDataUrl}) center/cover`
            : item.stickerDataUrl
              ? `${item.color} url(${item.stickerDataUrl}) center/contain no-repeat`
              : stripes(item.color, item.c2, 12),
        }}
      >
        <span className="item__tag">{item.title}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow eyebrow--accent">
          {item.kind} · {item.source}
        </span>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="linkish linkish--accent"
          >
            元のリンクを開く →
          </a>
        ) : null}
      </div>

      <div className="card item__intent">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="eyebrow eyebrow--muted">INTENT · やりたいこと</span>
          <button
            className="linkish"
            onClick={() => {
              setIntentText(item.intent || item.intents[0] || item.title);
              setEditing((v) => !v);
            }}
          >
            <Icon name="edit" />
            編集
          </button>
        </div>
        {editing ? (
          <div className="inputpill">
            <input
              type="text"
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
            <button
              className="iconbtn iconbtn--ink iconbtn--sm"
              onClick={handleSave}
              aria-label="決定"
            >
              <Icon name="check" />
            </button>
          </div>
        ) : (
          <span className="item__text">
            {item.intent || '（未確定・「？」カード）'}
          </span>
        )}
      </div>

      {item.rawText ? (
        <div className="card">
          <span className="eyebrow eyebrow--muted">MEMO</span>
          <span className="item__note" style={{ color: 'var(--ink)' }}>
            {item.rawText}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span className="eyebrow eyebrow--muted">PARA CATEGORY · 置き場所</span>
        <div className="row-chips">
          {PARA_TABS.map(([k, label, para]) => (
            <button
              key={k}
              className={`chip${item.para === para ? ' chip--ink' : ' chip--soft'}`}
              onClick={() => onChangePara(item.id, para)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {parentBundle ? (
        <button
          className="stack"
          onClick={() => onOpenBundle(parentBundle.id)}
        >
          <span className="stack__body">
            <span className="stack__title">所属する束: {parentBundle.intent}</span>
            <span className="stack__sub">タップして束の詳細（S5）を見る</span>
          </span>
          <Icon name="chevron_right" className="icon--muted" />
        </button>
      ) : (
        <span className="item__note">
          {item.note} · 夜になったら似たものと一緒に束ねるね。
        </span>
      )}
    </>
  );
};
