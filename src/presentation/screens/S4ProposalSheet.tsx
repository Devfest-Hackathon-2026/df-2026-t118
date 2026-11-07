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
  bundle,
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
        <span className="eyebrow eyebrow--accent">TODAY&apos;S PROPOSAL</span>
        <span className="prop__from">{NAMES[character]}から</span>
      </div>
    </div>
    <p className="prop__ask">{proposal.ask}</p>

    {/* 主役：ユーザーが保存したビジュアルイメージと、ユーザー自身が選んだ言葉（意図・メモ） */}
    <div
      className="prop-bundle-hero"
      role="button"
      tabIndex={0}
      onClick={onOpenBundle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenBundle();
      }}
    >
      <div className="prop-bundle-hero__top">
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>
          BUNDLED INSPIRATIONS · 集めた{bundleItems.length}つの保存物
        </span>
        <span className="chip chip--soft" style={{ fontSize: 11, height: 24, padding: '0 9px' }}>
          {bundle.targetName || bundle.para}
        </span>
      </div>

      <div className="prop-bundle-hero__title">{bundle.intent}</div>

      {/* ビジュアルイメージ（ステッカー／サムネイル）とユーザーの言葉を大きく並べる */}
      <div className="prop-bundle-hero__cards">
        {bundleItems.slice(0, 4).map((item) => (
          <div key={item.id} className="prop-bundle-card">
            <div
              className="prop-bundle-card__visual"
              style={{
                background: item.stickerDataUrl
                  ? `#fff url(${item.stickerDataUrl}) center/cover`
                  : item.imageDataUrl
                    ? `#fff url(${item.imageDataUrl}) center/cover`
                    : stripes(item.color, item.c2, 8),
              }}
            >
              <span className="prop-bundle-card__kind">{item.source || item.kind}</span>
            </div>
            <div className="prop-bundle-card__words">
              <span className="prop-bundle-card__intent">
                {item.intent || item.intents?.[0] || item.title}
              </span>
              <span className="prop-bundle-card__sub">
                {item.rawText || item.title}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="prop-bundle-hero__foot">
        <span>束ねた保存物を詳しく見る</span>
        <Icon name="chevron_right" className="icon--muted" />
      </div>
    </div>

    {/* 補助情報：AIによる具体的な一歩の提案はトンチンカンになりやすいため、文字を小さく控えめなヒントとして添える */}
    <div className="prop-hint-small">
      <div className="prop-hint-small__head">
        <span className="prop-hint-small__label">
          <Icon name="auto_awesome" />
          着手のヒント（目安 {proposal.minutes}分）
        </span>
      </div>
      <span className="prop-hint-small__title">{proposal.title}</span>
      {proposal.detail ? (
        <span className="prop-hint-small__detail">{proposal.detail}</span>
      ) : null}
    </div>

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
      <span className="eyebrow">BUNDLED THEME</span>
      <span className="letter__title">{bundle.intent}</span>
    </div>
    <div className="row-chips">
      {bundle.tool ? <span className="chip chip--ink">{bundle.tool}</span> : null}
      <span className="chip chip--soft" style={{ fontSize: 11.5 }}>
        ヒント: {proposal.title}（約{proposal.minutes}分）
      </span>
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
        集めた{bundleItemsCount}つの保存物を見る →
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
