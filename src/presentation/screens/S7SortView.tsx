import React, { useRef, useState } from 'react';
import { stripes } from '../../domain/constants/islandConstants';
import type { CharacterKind, SavedItem } from '../../domain/models/islandModels';
import { Avatar, Icon } from '../common/UiParts';

export const S7SortView: React.FC<{
  character: CharacterKind;
  somedayItems: SavedItem[];
  onDecideItem: (itemId: string, makeProject: boolean) => void;
  onClose: () => void;
}> = ({ character, somedayItems, onDecideItem, onClose }) => {
  const [idx, setIdx] = useState<number>(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [dx, setDx] = useState<number>(0);
  const [dragging, setDragging] = useState<boolean>(false);
  const startXRef = useRef<number | null>(null);

  const current = somedayItems[idx];
  const done = idx >= somedayItems.length || !current;

  const commitChoice = (yes: boolean) => {
    if (!current) return;
    setDragging(false);
    setDx(yes ? 440 : -440);
    const targetId = current.id;
    setTimeout(() => {
      onDecideItem(targetId, yes);
      setResults((prev) => [...prev, yes]);
      setIdx((prev) => prev + 1);
      setDx(0);
    }, 240);
  };

  if (done) {
    const yesCount = results.filter(Boolean).length;
    const summary =
      somedayItems.length === 0
        ? 'いつか箱は空っぽだよ。「＋」から気になるものを集めてね。'
        : yesCount > 0
          ? `作るのは${yesCount}つ。Projects に移して工事の札を立てておくね。`
          : '今回は、ぜんぶ Resources（参考資料）にしまっておくね。';
    return (
      <div className="sort">
        <div className="sort__top">
          <span className="eyebrow">WEEKLY · SOMEDAY BOX</span>
          <button className="iconbtn iconbtn--soft" onClick={onClose} aria-label="閉じる">
            <Icon name="close" />
          </button>
        </div>
        <div className="sort__done">
          <Avatar kind={character} size={72} />
          <p>{summary}</p>
        </div>
        <button className="btn btn--ink btn--pill btn--lg" onClick={onClose}>
          島にもどる
        </button>
      </div>
    );
  }

  const badgeOp = Math.min(1, Math.abs(dx) / 80);
  const isYes = dx > 0;

  return (
    <div className="sort">
      <div className="sort__top">
        <span className="eyebrow">
          WEEKLY · SOMEDAY BOX ({idx + 1}/{somedayItems.length})
        </span>
        <button className="iconbtn iconbtn--soft" onClick={onClose} aria-label="閉じる">
          <Icon name="close" />
        </button>
      </div>

      <h1 className="display">Make it?</h1>
      <span className="sort__lede">これ、作る？</span>

      <div className="sort__stage">
        <div className="sort__ghost" />
        <div
          className="sort__card"
          style={{
            transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
            transition: dragging ? 'none' : undefined,
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startXRef.current = e.clientX;
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging || startXRef.current == null) return;
            setDx(e.clientX - startXRef.current);
          }}
          onPointerUp={() => {
            if (!dragging) return;
            setDragging(false);
            startXRef.current = null;
            if (Math.abs(dx) > 90) {
              commitChoice(dx > 0);
            } else {
              setDx(0);
            }
          }}
          onPointerCancel={() => {
            setDragging(false);
            startXRef.current = null;
            setDx(0);
          }}
        >
          <div
            className="sort__img"
            style={{
              background: current.stickerDataUrl
                ? `${current.color} url(${current.stickerDataUrl}) center/contain no-repeat`
                : stripes(current.color, current.c2, 14),
            }}
          >
            <span className="item__tag">{current.title}</span>
          </div>
          <div className="sort__body">
            <span className="eyebrow eyebrow--accent">
              {current.kind} · {current.source}
            </span>
            <span className="sort__intent">
              {current.intent || current.intents[0] || current.title}
            </span>
          </div>
          <div
            className={`sort__badge${isYes ? ' sort__badge--yes' : ''}`}
            style={{
              left: isYes ? '18px' : 'auto',
              right: isYes ? 'auto' : '18px',
              opacity: badgeOp,
              transform: `rotate(${isYes ? -8 : 8}deg)`,
            }}
          >
            {isYes ? '作る → Projects' : '作らない → Resources'}
          </div>
        </div>
      </div>

      <div className="row2">
        <button
          className="btn btn--ghost btn--pill btn--lg"
          onClick={() => commitChoice(false)}
        >
          <Icon name="inventory_2" />
          作らない
        </button>
        <button
          className="btn btn--ink btn--pill btn--lg"
          onClick={() => commitChoice(true)}
        >
          <Icon name="construction" />
          作る
        </button>
      </div>
      <span className="sort__hint">SWIPE LEFT / RIGHT</span>
    </div>
  );
};
