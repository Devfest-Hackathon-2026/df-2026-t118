import React from 'react';
import { NAMES } from '../../domain/constants/islandConstants';
import type {
  Bundle,
  CharacterKind,
  PhaseKind,
  Proposal,
  ProposalStatus,
  SavedItem,
} from '../../domain/models/islandModels';
import { computeBubbleText, computeHeadline } from '../../domain/rules/islandRules';
import { Avatar, Icon, SayBubble } from '../common/UiParts';

export const S2Home: React.FC<{
  character: CharacterKind;
  phase: PhaseKind;
  day: number;
  floatingItems: SavedItem[];
  proposalStatus: ProposalStatus;
  activeProposal: Proposal | null;
  activeBundle: Bundle | null;
  pendingBundlesCount?: number;
  somedayCount: number;
  inboxCount?: number;
  pendingQuestionCount?: number;
  hint: boolean;
  aiBusyLabel: string | null;
  savedReaction?: string | null;
  onOpenSearch: () => void;
  onOpenSave: () => void;
  onOpenProposal: () => void;
  onOpenReflect: () => void;
  onOpenPendingBundle?: () => void;
  onTriggerNight: () => void;
  onTriggerMorning: () => void;
  onOpenSort: () => void;
  onOpenInbox?: () => void;
  onOpenSettings: () => void;
}> = ({
  character,
  phase,
  day,
  floatingItems,
  proposalStatus,
  activeBundle,
  pendingBundlesCount = 0,
  somedayCount,
  inboxCount = 0,
  pendingQuestionCount = 0,
  hint,
  aiBusyLabel,
  savedReaction = null,
  onOpenSearch,
  onOpenSave,
  onOpenProposal,
  onOpenReflect,
  onOpenPendingBundle,
  onTriggerNight,
  onTriggerMorning,
  onOpenSort,
  onOpenInbox,
  onOpenSettings,
}) => {
  const [headEn, headTitle] = computeHeadline({ floatingItems, proposalStatus, phase });

  const dateLabel =
    `DAY ${day}` +
    (phase === 'night' ? ' · NIGHT' : phase === 'morning' ? ' · MORNING' : ' · YOUR ISLAND');

  let primaryCta: { label: string; onClick: () => void } | null = null;
  if (proposalStatus === 'ready') {
    primaryCta = { label: '見てみる', onClick: onOpenProposal };
  } else if (proposalStatus === 'doing') {
    primaryCta = { label: 'できた？', onClick: onOpenReflect };
  } else if (pendingBundlesCount > 0 && onOpenPendingBundle) {
    primaryCta = {
      label: `束ね案を確認 (${pendingBundlesCount})`,
      onClick: onOpenPendingBundle,
    };
  } else if (pendingQuestionCount > 0 && onOpenInbox) {
    // しつもんカードは連絡箱の中にあるが、そこまで辿り着かないと気づけない。
    // 「今日の一歩」と同じようにドックから1タップで答えに行けるようにする。
    primaryCta = { label: 'こたえる', onClick: onOpenInbox };
  }

  const tag =
    proposalStatus === 'ready' || proposalStatus === 'doing'
      ? 'ONE STEP'
      : pendingBundlesCount > 0
        ? 'CLUSTER PROPOSAL'
        : pendingQuestionCount > 0
          ? 'QUESTION'
          : aiBusyLabel
            ? 'GEMINI AI'
            : null;

  return (
    <>
      <header className="home__top">
        <div className="home__head">
          <span className="eyebrow">{dateLabel}</span>
          <h1 className="display">{headEn}</h1>
          <span className="home__sub">{headTitle}</span>
        </div>

        <nav className="home__nav" aria-label="アプリの操作">
          <button
            className="navpill glass"
            onClick={onTriggerNight}
            disabled={Boolean(aiBusyLabel)}
            title="似ている保存物をまとめる"
          >
            <Icon name="waves" />
            <span className="navpill__label">束ねる（夜）</span>
          </button>

          <button
            className="navpill glass"
            onClick={onTriggerMorning}
            disabled={Boolean(aiBusyLabel)}
            title="今日の小さな一歩を提案してもらう"
          >
            <Icon name="auto_awesome" />
            <span className="navpill__label">今日の一歩（朝）</span>
          </button>

          <button
            className="navpill glass"
            onClick={onOpenSort}
            title="いつか箱の中身を仕分ける"
          >
            <Icon name="inventory_2" />
            <span className="navpill__label">
              仕分け{somedayCount > 0 ? ` (${somedayCount})` : ''}
            </span>
          </button>

          <button
            className="navpill glass"
            onClick={onOpenSearch}
            title="保存したものを一覧・検索する"
          >
            <Icon name="search" />
            <span className="navpill__label">一覧・検索</span>
          </button>

          {onOpenInbox ? (
            <button
              className="navpill glass"
              onClick={onOpenInbox}
              title="届いたお便りを読む"
            >
              <Icon name="mail" />
              <span className="navpill__label">
                連絡箱{inboxCount > 0 ? ` (${inboxCount})` : ''}
              </span>
            </button>
          ) : null}

          <button
            className="iconbtn iconbtn--glass"
            onClick={onOpenSettings}
            aria-label="設定"
            title="設定"
          >
            <Icon name="more_horiz" />
          </button>

          <button
            className="navpill navpill--ink"
            onClick={onOpenSave}
            title="気になったものを保存する"
          >
            <Icon name="add" />
            <span>保存する</span>
          </button>
        </nav>
      </header>

      <div className="home__dock glass">
        <SayBubble
          character={character}
          name={NAMES[character]}
          text={computeBubbleText({
            floatingItems,
            proposalStatus,
            activeBundle,
            pendingBundlesCount,
            pendingQuestionCount,
            phase,
            aiBusyLabel,
            savedReaction,
          })}
          tag={tag}
        />
        {primaryCta ? (
          <button
            className="btn btn--ink btn--pill btn--lg home__dock-cta"
            onClick={primaryCta.onClick}
            disabled={Boolean(aiBusyLabel)}
          >
            <span>{primaryCta.label}</span>
            <Icon name="arrow_forward" />
          </button>
        ) : null}
      </div>

      {hint ? (
        <div className="home__hint">
          <span className="chip chip--hint">
            <Icon name="360" />
            {/* タッチ端末にはスクロールがないので、CSS の pointer メディアクエリで出し分ける */}
            <span className="hint--mouse">DRAG TO ORBIT · SCROLL / PINCH TO ZOOM</span>
            <span className="hint--touch">DRAG TO ORBIT · PINCH TO ZOOM</span>
          </span>
        </div>
      ) : null}
    </>
  );
};

export const NotificationBanner: React.FC<{
  visible: boolean;
  character: CharacterKind;
  askText: string;
  onTap: () => void;
}> = ({ visible, character, askText, onTap }) => (
  <div className={`notif${visible ? ' notif--in' : ''}`} onClick={onTap}>
    <div className="glass notif__card">
      <Avatar kind={character} size={38} />
      <div className="notif__body">
        <div className="notif__head">
          <span>{NAMES[character]}からの今日の一歩</span>
          <span className="mono">now</span>
        </div>
        <span className="notif__text">{askText}</span>
      </div>
    </div>
  </div>
);

export const ToastBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="toast">
      <Icon name="auto_awesome" className="icon--accent" />
      {message}
    </div>
  ) : null;
