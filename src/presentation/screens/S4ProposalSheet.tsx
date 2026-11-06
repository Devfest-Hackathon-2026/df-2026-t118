import React from 'react';
import { NAMES, stripes } from '../../domain/constants/islandConstants';
import type { Bundle, CharacterKind, Proposal, SavedItem } from '../../domain/models/islandModels';
import { Avatar, Icon } from '../common/UiParts';

export const S4ProposalSheet: React.FC<{
  character: CharacterKind;
  proposal: Proposal;
  bundle: Bundle;
  bundleItems: SavedItem[];
  onOpenBundle: () => void;
  onDoIt: () => void;
  onSkipToday: () => void;
  onReleaseIt: () => void;
}> = ({
  character,
  proposal,
  bundleItems,
  onOpenBundle,
  onDoIt,
  onSkipToday,
  onReleaseIt,
}) => (
  <>
    <div className="prop__head">
      <Avatar kind={character} size={44} />
      <div className="prop__who">
        <span className="eyebrow eyebrow--accent">TODAY&apos;S ONE STEP</span>
        <span className="prop__from">{NAMES[character]}から</span>
      </div>
    </div>
    <p className="prop__ask">{proposal.ask}</p>

    <div className="step">
      <div className="step__top">
        <span className="eyebrow">YOU&apos;LL DO</span>
        <span className="chip chip--ink">
          <Icon name="schedule" />
          {proposal.minutes} min
        </span>
      </div>
      <span className="step__title">{proposal.title}</span>
      <span className="step__detail">{proposal.detail}</span>
    </div>

    <button className="stack" onClick={onOpenBundle}>
      <span className="stack__imgs">
        {bundleItems.slice(0, 3).map((item) => (
          <span
            key={item.id}
            className="stack__t"
            style={{
              background: item.stickerDataUrl
                ? `#fff url(${item.stickerDataUrl}) center/cover`
                : stripes(item.color, item.c2, 6),
            }}
          />
        ))}
      </span>
      <span className="stack__body">
        <span className="stack__title">集めた{bundleItems.length}つのまとめ</span>
        <span className="stack__sub">
          {bundleItems.map((i) => i.title).join(' · ').slice(0, 28)}
        </span>
      </span>
      <Icon name="chevron_right" className="icon--muted" />
    </button>

    <button className="btn btn--ink btn--pill btn--lg" onClick={onDoIt}>
      やってみる
    </button>
    <div className="row2">
      <button className="btn btn--ghost btn--pill" onClick={onSkipToday}>
        今日はやめる
      </button>
      <button className="btn btn--ghost btn--pill" onClick={onReleaseIt}>
        手放す
      </button>
    </div>
  </>
);

export const S4ProposalLetter: React.FC<{
  character: CharacterKind;
  proposal: Proposal;
  bundle: Bundle;
  bundleItemsCount: number;
  onOpenBundle: () => void;
  onDoIt: () => void;
  onSkipToday: () => void;
  onReleaseIt: () => void;
  onClose: () => void;
}> = ({
  character,
  proposal,
  bundle,
  bundleItemsCount,
  onOpenBundle,
  onDoIt,
  onSkipToday,
  onReleaseIt,
  onClose,
}) => (
  <div className="letter">
    <div className="letter__top">
      <span className="eyebrow">ONE STEP · LETTER</span>
      <button className="iconbtn iconbtn--soft" onClick={onClose} aria-label="閉じる">
        <Icon name="close" />
      </button>
    </div>
    <h1 className="display">
      Today&apos;s
      <br />
      one step
    </h1>
    <div className="letter__do">
      <span className="eyebrow">YOU&apos;LL DO</span>
      <span className="letter__title">{proposal.title}</span>
    </div>
    <div className="row-chips">
      <span className="chip chip--ink">{proposal.minutes} min</span>
      {bundle.tool ? <span className="chip chip--soft">{bundle.tool}</span> : null}
    </div>
    <div className="letter__spacer" />
    <div className="glass letter__card">
      <div className="letter__say">
        <Avatar kind={character} size={40} />
        <span>
          集めた{bundleItemsCount}つ、ひとつに束ねたよ。{proposal.ask}
        </span>
      </div>
      <button className="linkish linkish--accent" onClick={onOpenBundle}>
        集めた{bundleItemsCount}つを見る →
      </button>
      <button className="btn btn--ink btn--pill btn--lg" onClick={onDoIt}>
        やってみる
      </button>
      <div className="row2">
        <button className="btn btn--ghost btn--pill" onClick={onSkipToday}>
          今日はやめる
        </button>
        <button className="btn btn--ghost btn--pill" onClick={onReleaseIt}>
          手放す
        </button>
      </div>
    </div>
  </div>
);
