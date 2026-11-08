import React, { useState } from 'react';
import { NAMES } from '../../domain/constants/islandConstants';
import type {
  AreaEntity,
  CharacterKind,
  ProjectEntity,
} from '../../domain/models/islandModels';
import type {
  ConfirmedSubject,
  DiscoveryFeedback,
  DiscoverySettings,
  ResearchReport,
} from '../../domain/models/proactiveDiscoveryModels';
import { checkHomonymNeedsDisambiguation } from '../../domain/rules/proactiveDiscoveryRules';
import { Avatar, Icon } from '../common/UiParts';

export const DiscoveryInboxSheet: React.FC<{
  character: CharacterKind;
  projects: ProjectEntity[];
  areas?: AreaEntity[];
  settings: DiscoverySettings;
  confirmedSubjects: ConfirmedSubject[];
  reports: ResearchReport[];
  busy: boolean;
  onUpdateSettings: (patch: Partial<DiscoverySettings>) => void;
  onAddOrUpdateSubject: (subject: {
    id?: string;
    canonicalName: string;
    disambiguationHint?: string;
    officialUrl?: string;
    frequency: ConfirmedSubject['frequency'];
    confirmationState: ConfirmedSubject['confirmationState'];
    source: ConfirmedSubject['source'];
    projectId: string | null;
  }) => void;
  onDeleteSubject: (subjectId: string) => void;
  onAnswerQuestion: (
    reportId: string,
    answer: string,
    status: 'answered' | 'skipped' | 'declined'
  ) => void;
  onReactToCard: (
    reportId: string,
    reaction: DiscoveryFeedback['reaction'],
    reason?: string
  ) => void;
  onRunDiscoveryNow: () => void;
  onClose: () => void;
}> = ({
  character,
  projects,
  areas = [],
  settings,
  confirmedSubjects,
  reports,
  busy,
  onUpdateSettings,
  onAddOrUpdateSubject,
  onDeleteSubject,
  onAnswerQuestion,
  onReactToCard,
  onRunDiscoveryNow,
  onClose,
}) => {
  const [artistNameInput, setArtistNameInput] = useState('');
  const [artistHintInput, setArtistHintInput] = useState('');
  const [artistUrlInput, setArtistUrlInput] = useState('');
  const [dislikeReasonInput, setDislikeReasonInput] = useState('');
  const [showDislikeBoxFor, setShowDislikeBoxFor] = useState<string | null>(null);
  const [showScreenshotCandidateBox, setShowScreenshotCandidateBox] = useState(false);
  const [screenshotMockText, setScreenshotMockText] = useState('綾野かなえ 単独演奏会');

  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeAreas = areas.filter((a) => a.status === 'active');
  const enabledAreaIds = settings.enabledAreaIds || [];

  const latestReport = reports[0] || null;
  const visibleSubjects = confirmedSubjects.filter(
    (s) => s.confirmationState !== 'deleted'
  );

  const handleManualAddArtist = () => {
    const trimmed = artistNameInput.trim();
    if (!trimmed) return;
    const needsDisambig = checkHomonymNeedsDisambiguation(
      trimmed,
      artistHintInput,
      artistUrlInput
    );
    const defaultTargetId =
      activeProjects.find((p) => settings.enabledProjectIds.includes(p.id))?.id ||
      activeAreas.find((a) => enabledAreaIds.includes(a.id))?.id ||
      activeProjects[0]?.id ||
      activeAreas[0]?.id ||
      null;

    onAddOrUpdateSubject({
      canonicalName: trimmed,
      disambiguationHint: artistHintInput.trim() || undefined,
      officialUrl: artistUrlInput.trim() || undefined,
      frequency: needsDisambig ? 'unknown' : 'often',
      confirmationState: needsDisambig ? 'pending_disambiguation' : 'confirmed',
      source: 'manual_input',
      projectId: defaultTargetId,
    });
    setArtistNameInput('');
    setArtistHintInput('');
    setArtistUrlInput('');
  };

  const handleCreateScreenshotCandidate = () => {
    if (!settings.aiConsentGranted) return;
    const extracted = screenshotMockText.trim().split(/\s+/)[0] || '綾野かなえ';
    const defaultTargetId =
      activeProjects.find((p) => settings.enabledProjectIds.includes(p.id))?.id ||
      activeAreas.find((a) => enabledAreaIds.includes(a.id))?.id ||
      activeProjects[0]?.id ||
      activeAreas[0]?.id ||
      null;

    onAddOrUpdateSubject({
      canonicalName: extracted,
      disambiguationHint: 'スクショ文字からの候補（あなたの確認待ち）',
      frequency: 'unknown',
      confirmationState: 'unconfirmed',
      source: 'screenshot_candidate',
      projectId: defaultTargetId,
    });
    setShowScreenshotCandidateBox(false);
  };

  return (
    <div className="discovery-inbox" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="bundle__top">
        <div>
          <span className="eyebrow eyebrow--accent">
            ISLAND POSTBOX · しまの連絡箱
          </span>
          <h2 className="display display--sm" style={{ marginTop: '4px' }}>
            しまの連絡箱
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: '4px 0 0' }}>
            あなたの好きなアーティストや信頼する編集部の記事から、気になるライブや展示のお便りをそっと届けます。眺めるだけでよく、タスク化や買い物はすすめません。
          </p>
        </div>
      </div>

      {/* 1. 最新のお便り（イベントカード 1件 ＋ ちょっとした質問 1件） */}
      <div className="card card--feature" style={{ border: '1.5px solid rgba(51, 48, 73, 0.12)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar kind={character} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="eyebrow eyebrow--accent">
                TODAY&apos;S LETTER · {NAMES[character]}からのお便り
              </span>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>
                {latestReport
                  ? `${latestReport.localDate} · ${
                      latestReport.status === 'card_ready'
                        ? '公式サイトで確認できたお便りが届いています'
                        : latestReport.status === 'search_off'
                          ? '外で探すスイッチがオフのため、しつもんカードだけ届いています'
                          : latestReport.status === 'question_only'
                            ? 'あなたの好みを聞くしつもんカードが届いています'
                            : latestReport.status === 'unverified_source'
                              ? '公式ページで裏付けがとれなかったため、今回は見送りました'
                              : '今はぴったりなお知らせがありませんでした'
                    }`
                  : 'まだお便りはありません'}
              </div>
            </div>
          </div>

          <button
            className="btn btn--ink btn--pill btn--sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={onRunDiscoveryNow}
            disabled={busy}
            title="今の設定でお便りを探してみます"
          >
            <Icon name="auto_awesome" />
            <span>{busy ? '探しています...' : 'お便りを探してみる'}</span>
          </button>
        </div>

        {/* 見つけたイベントカード（1日1件まで） */}
        {latestReport?.card ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '18px',
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(31, 41, 55, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="chip chip--ink" style={{ fontSize: '11px' }}>
                {latestReport.card.curatorType === 'artist_official'
                  ? '公式サイトで確認済み'
                  : '編集部おすすめ＋公式確認済み'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                チェック日: {new Date(latestReport.card.verifiedAt).toLocaleDateString('ja-JP')}
              </span>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.35 }}>
              {latestReport.card.title}
            </div>

            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <strong>いつ:</strong> {latestReport.card.eventDate}
                {latestReport.card.startTime ? ` ${latestReport.card.startTime}〜` : ''}
              </div>
              <div>
                <strong>どこで:</strong> {latestReport.card.venue}（{latestReport.card.region}）
              </div>
              <div>
                <strong>見つけた場所:</strong> {latestReport.card.recommendedBy}
              </div>
              {latestReport.card.priceOrStatusNote ? (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  <strong>メモ:</strong> {latestReport.card.priceOrStatusNote}
                </div>
              ) : null}
            </div>

            <div
              style={{
                fontSize: '12.5px',
                padding: '8px 10px',
                borderRadius: '12px',
                background: 'rgba(243, 244, 246, 0.75)',
                color: 'var(--ink)',
              }}
            >
              <strong>お届けした理由:</strong> {latestReport.card.whyFound}
            </div>

            {/* 5つの気軽なリアクション */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              <a
                href={latestReport.card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ink btn--pill btn--sm"
                onClick={() => onReactToCard(latestReport.id, 'viewed_detail')}
              >
                <Icon name="open_in_new" />
                公式ページを見る
              </a>

              <button
                className={`btn btn--pill btn--sm ${
                  latestReport.feedback?.reaction === 'like' ? 'btn--ink' : 'btn--ghost'
                }`}
                onClick={() => onReactToCard(latestReport.id, 'like')}
              >
                <Icon name="favorite" />
                好き・気になる
              </button>

              <button
                className={`btn btn--pill btn--sm ${
                  latestReport.feedback?.reaction === 'dislike' ? 'btn--ink' : 'btn--ghost'
                }`}
                onClick={() =>
                  setShowDislikeBoxFor(
                    showDislikeBoxFor === latestReport.id ? null : latestReport.id
                  )
                }
              >
                <Icon name="close" />
                イメージと違う
              </button>

              <button
                className={`btn btn--pill btn--sm ${
                  latestReport.feedback?.reaction === 'not_now' ? 'btn--ink' : 'btn--ghost'
                }`}
                onClick={() =>
                  onReactToCard(
                    latestReport.id,
                    'not_now',
                    `しばらく（${settings.suppressionDaysForNotNow}日間）お休みします`
                  )
                }
              >
                <Icon name="schedule" />
                今はパス
              </button>

              <button
                className="btn btn--ghost btn--pill btn--sm"
                onClick={() => {
                  onReactToCard(latestReport.id, 'closed_no_answer');
                  onClose();
                }}
              >
                そっと閉じる
              </button>
            </div>

            {showDislikeBoxFor === latestReport.id ? (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="ひとこと理由（任意：別の同名の人だった／場所が遠い など）"
                  value={dislikeReasonInput}
                  onChange={(e) => setDislikeReasonInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.15)',
                    fontSize: '12px',
                  }}
                />
                <button
                  className="btn btn--ink btn--pill btn--sm"
                  onClick={() => {
                    onReactToCard(
                      latestReport.id,
                      'dislike',
                      dislikeReasonInput.trim() || '好みに合わなかった'
                    );
                    setShowDislikeBoxFor(null);
                    setDislikeReasonInput('');
                  }}
                >
                  伝える
                </button>
              </div>
            ) : null}

            {latestReport.feedback ? (
              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                あなたの気持ち:{' '}
                <strong>
                  {latestReport.feedback.reaction === 'like'
                    ? '「好き・気になる」を受け取りました。また似たお便りを探しますね'
                    : latestReport.feedback.reaction === 'dislike'
                      ? `「イメージと違う」を受け取りました（次から控えます${
                          latestReport.feedback.reason
                            ? ` / メモ: ${latestReport.feedback.reason}`
                            : ''
                        }）`
                      : latestReport.feedback.reaction === 'not_now'
                        ? `「今はパス」を受け取りました（嫌いになったとは扱わず、${settings.suppressionDaysForNotNow}日間だけお休みします）`
                        : latestReport.feedback.reaction === 'viewed_detail'
                          ? '公式ページを開きました'
                          : 'そっと閉じました'}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 選択式の質問カード（1日1件まで・スキップ自由） */}
        {latestReport?.question && latestReport.question.status === 'pending' ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 251, 235, 0.9)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span className="eyebrow eyebrow--accent">
              QUESTION · {NAMES[character]}からのちょっとした質問（スキップOK）
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {latestReport.question.prompt}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {latestReport.question.options.map((opt) => (
                <button
                  key={opt}
                  className="btn btn--ghost btn--pill btn--sm"
                  onClick={() => {
                    const isSkip = opt.includes('わからない');
                    const isDecline = opt.includes('答えない') || opt.includes('指定しない');
                    onAnswerQuestion(
                      latestReport.id,
                      opt,
                      isDecline ? 'declined' : isSkip ? 'skipped' : 'answered'
                    );
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

      </div>

      {/* 2. あなたの「好き」帳（好きなアーティスト・作家）。お便りと並ぶ主役 */}
      <div className="card card--feature">
        <span className="eyebrow eyebrow--accent">
          FAVORITE PEOPLE · あなたの「好き」帳
        </span>
        <p className="card__headline">好きなアーティスト・作家</p>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          あなたが「好き・聴く」と教えてくれた人だけを手がかりにお便りを探します。消した名前が勝手に復活することはありません。
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visibleSubjects.map((subj) => (
            <div
              key={subj.id}
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px' }}>{subj.canonicalName}</strong>
                {/* 初期状態で入れてあるサンプルは、本人が教えたものと区別がつくようにする。
                    「あなたが教えてくれた人」という説明と食い違わせない */}
                {subj.id.startsWith('subj_demo_') ? (
                  <span className="chip chip--soft" style={{ fontSize: '10.5px' }}>
                    デモ用のサンプル（架空）
                  </span>
                ) : null}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <span
                    className={`chip ${
                      subj.confirmationState === 'confirmed' ? 'chip--ink' : 'chip--soft'
                    }`}
                    style={{ fontSize: '10.5px' }}
                  >
                    {subj.confirmationState === 'confirmed'
                      ? 'あなたのお気に入り'
                      : subj.confirmationState === 'pending_disambiguation'
                        ? '同じ名前の人がいるため確認中'
                        : subj.confirmationState === 'rejected'
                          ? '「違う」と回答済み'
                          : 'スクショから見つけた候補（まだ探しません）'}
                  </span>
                  <button
                    className="btn btn--ghost btn--pill btn--sm"
                    onClick={() => onDeleteSubject(subj.id)}
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                  >
                    消す
                  </button>
                </div>
              </div>

              {subj.disambiguationHint ? (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  メモ: {subj.disambiguationHint}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  className={`btn btn--pill btn--sm ${
                    subj.frequency === 'often' && subj.confirmationState === 'confirmed'
                      ? 'btn--ink'
                      : 'btn--ghost'
                  }`}
                  onClick={() =>
                    onAddOrUpdateSubject({
                      id: subj.id,
                      canonicalName: subj.canonicalName,
                      disambiguationHint: subj.disambiguationHint || 'お気に入り登録済み',
                      officialUrl: subj.officialUrl,
                      frequency: 'often',
                      confirmationState: 'confirmed',
                      source: subj.source,
                      projectId: subj.projectId,
                    })
                  }
                >
                  よく聴く・好き
                </button>
                <button
                  className={`btn btn--pill btn--sm ${
                    subj.frequency === 'sometimes' && subj.confirmationState === 'confirmed'
                      ? 'btn--ink'
                      : 'btn--ghost'
                  }`}
                  onClick={() =>
                    onAddOrUpdateSubject({
                      id: subj.id,
                      canonicalName: subj.canonicalName,
                      disambiguationHint: subj.disambiguationHint || 'お気に入り登録済み',
                      officialUrl: subj.officialUrl,
                      frequency: 'sometimes',
                      confirmationState: 'confirmed',
                      source: subj.source,
                      projectId: subj.projectId,
                    })
                  }
                >
                  たまに聴く
                </button>
                <button
                  className={`btn btn--pill btn--sm ${
                    subj.confirmationState === 'rejected' ? 'btn--ink' : 'btn--ghost'
                  }`}
                  onClick={() =>
                    onAddOrUpdateSubject({
                      id: subj.id,
                      canonicalName: subj.canonicalName,
                      disambiguationHint: subj.disambiguationHint,
                      officialUrl: subj.officialUrl,
                      frequency: 'no',
                      confirmationState: 'rejected',
                      source: subj.source,
                      projectId: subj.projectId,
                    })
                  }
                >
                  違う
                </button>
                <button
                  className={`btn btn--pill btn--sm ${
                    subj.frequency === 'unknown' && subj.confirmationState === 'unconfirmed'
                      ? 'btn--ink'
                      : 'btn--ghost'
                  }`}
                  onClick={() =>
                    onAddOrUpdateSubject({
                      id: subj.id,
                      canonicalName: subj.canonicalName,
                      disambiguationHint: subj.disambiguationHint,
                      officialUrl: subj.officialUrl,
                      frequency: 'unknown',
                      confirmationState: 'unconfirmed',
                      source: subj.source,
                      projectId: subj.projectId,
                    })
                  }
                >
                  まだわからない
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 手入力で好きな人を追加 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            ＋ 好きなアーティストや作家を教える（例：蒼井ことね、綾野かなえ、ハルカゼ楽団、榊原たく）
          </span>
          <div className="inputpill">
            <input
              type="text"
              placeholder="アーティスト・作家名（例：綾野かなえ）"
              value={artistNameInput}
              onChange={(e) => setArtistNameInput(e.target.value)}
            />
          </div>
          <div className="inputpill">
            <input
              type="text"
              placeholder="好きな曲や作品のメモ（任意：タオルケットは穏やかな）"
              value={artistHintInput}
              onChange={(e) => setArtistHintInput(e.target.value)}
            />
            <button className="btn btn--ink btn--pill btn--sm" onClick={handleManualAddArtist}>
              追加する
            </button>
          </div>
        </div>

        {/* スクショからの候補作成 */}
        <div style={{ marginTop: '4px' }}>
          <button
            className="btn btn--ghost btn--pill btn--sm"
            onClick={() => setShowScreenshotCandidateBox(!showScreenshotCandidateBox)}
          >
            <Icon name="add_a_photo" />
            スクショの文字から名前を読み取る（任意）
          </button>
          {showScreenshotCandidateBox ? (
            <div
              style={{
                marginTop: '6px',
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              <span>
                スクショに写っている文字からアーティスト名の候補だけを読み取ります（写真そのものが外の検索に送られることはありません）。読み取った名前は、あなたが「よく聴く・好き」と選ぶまで検索には使いません。
              </span>
              {!settings.aiConsentGranted ? (
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                  ※下の「AIサポート」がオフのため使えません。オンにすると試せます。
                </span>
              ) : (
                <div className="inputpill">
                  <input
                    type="text"
                    value={screenshotMockText}
                    onChange={(e) => setScreenshotMockText(e.target.value)}
                    placeholder="スクショ内の文字（例：綾野かなえ 単独演奏会）"
                  />
                  <button
                    className="btn btn--ink btn--pill btn--sm"
                    onClick={handleCreateScreenshotCandidate}
                  >
                    候補に追加
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>


      {/* 3. 調べ方の記録。お便りの裏側なので、読みたい人だけが開く別セクションに下げている */}
      <div className="card card--quiet" style={{ gap: '8px' }}>
        <span className="eyebrow eyebrow--muted">SEARCH LOG · 調べ方の記録</span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          お便りをどう探したか、どの情報元を見たかの記録です。ふだんは開かなくて大丈夫。
        </span>
      {/* お便りがまだ無いときも開けるようにする。
          latestReport で details ごと出し分けると、見出しだけが残って何も開けない状態になる。 */}
      <details style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          どうやって探したか・情報元のリンクを見る
        </summary>
        {!latestReport ? (
          <div
            style={{
              marginTop: '6px',
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.65)',
            }}
          >
            まだ記録はありません。お便りが届くと、どう探したか・どの情報元を見たかがここに残ります。
          </div>
        ) : (
          <div
            style={{
              marginTop: '6px',
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div>
              <strong>探した日時:</strong>{' '}
              {new Date(latestReport.investigationMemo.executedAt).toLocaleString('ja-JP')}
            </div>
            <div>
              <strong>外への検索:</strong>{' '}
              {latestReport.investigationMemo.searchPerformed ? '探しました' : '探していません（0回）'}
            </div>
            <div>
              <strong>使った検索ワード:</strong>{' '}
              <code>{latestReport.investigationMemo.queryUsed || '（送っていません）'}</code>
            </div>
            <div>
              <strong>関連するテーマ (Project / Area):</strong>{' '}
              {latestReport.investigationMemo.targetProjectName || 'なし'}
            </div>
            <div>
              <strong>しまのメモ:</strong> {latestReport.investigationMemo.summary}
            </div>
            <div>
              <strong>ご案内:</strong>{' '}
              {latestReport.investigationMemo.uncertaintyNote}
            </div>
            {latestReport.investigationMemo.sourcesReceived.length > 0 ? (
              <div style={{ marginTop: '4px' }}>
                <strong>チェックした情報元:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {latestReport.investigationMemo.sourcesReceived.map((s, idx) => (
                    <li key={`${s.url}_${idx}`}>
                      [{s.isOfficial ? '公式ページ確認済み' : '未確認のため見送り'}] {s.title} ({s.url})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </details>
      </div>
    </div>
  );
};
