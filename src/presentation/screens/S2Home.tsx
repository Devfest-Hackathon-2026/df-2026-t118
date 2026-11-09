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
  canPropose?: boolean;
  canBundle?: boolean;
  hint: boolean;
  aiBusyLabel: string | null;
  savedReaction?: string | null;
  onOpenSearch: () => void;
  onOpenSave: () => void;
  onOpenProposal: () => void;
  onOpenReflect: () => void;
  onDone?: () => void;
  onMada?: () => void;
  onOpenReflection?: () => void;
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
  activeProposal,
  activeBundle,
  pendingBundlesCount = 0,
  somedayCount,
  inboxCount = 0,
  pendingQuestionCount = 0,
  canPropose = false,
  canBundle = false,
  hint,
  aiBusyLabel,
  savedReaction = null,
  onOpenSearch,
  onOpenSave,
  onOpenProposal,
  onOpenReflect,
  onDone,
  onMada,
  onOpenReflection,
  onOpenPendingBundle,
  onTriggerNight,
  onTriggerMorning,
  onOpenSort,
  onOpenInbox,
  onOpenSettings,
}) => {
  const [headEn, headTitle] = computeHeadline({ floatingItems, proposalStatus, phase });

  const inboxLabel = `${NAMES[character]}のお便り${inboxCount > 0 ? ` (${inboxCount})` : ''}`;

  const dateLabel =
    `DAY ${day}` +
    (phase === 'night' ? ' · NIGHT' : phase === 'morning' ? ' · MORNING' : ' · YOUR ISLAND');

  // #45: 実行中は吹き出しの横に［まだ］［できた］を直接出し、［できた］で建物まで進める
  const doingActions = proposalStatus === 'doing' && onDone && onMada;
  const canLeaveReflection =
    proposalStatus === 'done' &&
    Boolean(activeProposal) &&
    !activeProposal?.reflectWord &&
    !activeProposal?.reflectPhotoDataUrl &&
    Boolean(onOpenReflection);

  let primaryCta: { label: string; onClick: () => void } | null = null;
  if (proposalStatus === 'ready') {
    primaryCta = { label: '見てみる', onClick: onOpenProposal };
  } else if (proposalStatus === 'doing' && !doingActions) {
    primaryCta = { label: 'できた？', onClick: onOpenReflect };
  } else if (canLeaveReflection && onOpenReflection) {
    primaryCta = { label: 'ひとこと残す', onClick: onOpenReflection };
  } else if (pendingBundlesCount > 0 && onOpenPendingBundle) {
    primaryCta = {
      label: `束ね案を確認 (${pendingBundlesCount})`,
      onClick: onOpenPendingBundle,
    };
  } else if (pendingQuestionCount > 0 && onOpenInbox) {
    // しつもんカードは連絡箱の中にあるが、そこまで辿り着かないと気づけない。
    // 「今日の一歩」と同じようにドックから1タップで答えに行けるようにする。
    primaryCta = { label: 'こたえる', onClick: onOpenInbox };
  } else if (canPropose) {
    // 1日1提案が本筋なので、束ねるより先に出す
    primaryCta = { label: '今日の一歩を見る', onClick: onTriggerMorning };
  } else if (canBundle) {
    primaryCta = { label: 'まとめる', onClick: onTriggerNight };
  }

  const tag =
    proposalStatus === 'ready' || proposalStatus === 'doing'
      ? 'ONE STEP'
      : pendingBundlesCount > 0
        ? 'CLUSTER PROPOSAL'
        : pendingQuestionCount > 0
          ? 'QUESTION'
          : canPropose
            ? 'ONE STEP'
            : canBundle
              ? 'BUNDLE'
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

        {/* 常に出すのは 一覧・検索／お便り／設定／保存 だけ。束ねる・今日の一歩はドックから、
            いつか箱は中身があるときだけ出す（requirements.md の「情報を出しすぎない」）。
            デモで時間を進める入口は設定の「開発・デモ用」にある */}
        <nav className="home__nav" aria-label="アプリの操作">
          {somedayCount > 0 ? (
            <button
              className="navpill glass"
              onClick={onOpenSort}
              aria-label={`いつか箱 (${somedayCount})`}
              title="いつか箱の中身を仕分ける"
            >
              <Icon name="inventory_2" />
              <span className="navpill__label">いつか箱 ({somedayCount})</span>
            </button>
          ) : null}

          <button
            className="navpill glass"
            onClick={onOpenSearch}
            aria-label="一覧・検索"
            title="保存したものを一覧・検索する"
          >
            <Icon name="search" />
            <span className="navpill__label">一覧・検索</span>
          </button>

          {onOpenInbox ? (
            <button
              className="navpill glass"
              onClick={onOpenInbox}
              aria-label={inboxLabel}
              title="届いたお便りを読む"
            >
              <Icon name="mail" />
              <span className="navpill__label">{inboxLabel}</span>
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
            canPropose,
            canBundle,
            phase,
            aiBusyLabel,
            proposalMinutes: activeProposal?.minutes,
            savedReaction,
          })}
          tag={tag}
        />
        {doingActions ? (
          <div className="home__dock-actions">
            <button className="linkish home__dock-more" onClick={onOpenReflect}>
              ほかの答え
            </button>
            <button
              className="btn btn--ghost btn--pill btn--lg"
              onClick={onMada}
              disabled={Boolean(aiBusyLabel)}
            >
              まだ
            </button>
            <button
              className="btn btn--ink btn--pill btn--lg"
              onClick={onDone}
              disabled={Boolean(aiBusyLabel)}
            >
              <span>できた</span>
              <Icon name="check" />
            </button>
          </div>
        ) : primaryCta ? (
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
