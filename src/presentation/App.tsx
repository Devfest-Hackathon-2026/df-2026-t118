import React from 'react';
import { useIslandUseCases } from '../application/usecases/useIslandUseCases';
import { shellColors } from '../domain/constants/islandConstants';
import {
  buildFallbackBundle,
  buildFallbackProposal,
  computeBubbleText,
} from '../domain/rules/islandRules';
import { IslandCanvas } from './canvas/IslandCanvas';
import { Icon } from './common/UiParts';
import { S1Welcome } from './screens/S1Welcome';
import {
  NotificationBanner,
  S2Home,
  ToastBanner,
} from './screens/S2Home';
import { S3SaveSheet } from './screens/S3SaveSheet';
import {
  S4ProposalLetter,
  S4ProposalSheet,
} from './screens/S4ProposalSheet';
import { S5BundleSheet } from './screens/S5BundleSheet';
import { S6ReflectSheet } from './screens/S6ReflectSheet';
import { S7SortView } from './screens/S7SortView';
import { S8SearchSheet } from './screens/S8SearchSheet';
import { S9ItemSheet } from './screens/S9ItemSheet';
import { SettingsSheet } from './screens/SettingsSheet';
import { DiscoveryInboxSheet } from './screens/DiscoveryInboxSheet';

export const App: React.FC = () => {
  const {
    screen,
    setScreen,
    sheet,
    setSheet,
    shown,
    setShown,
    phase,
    day,
    anim,
    setAnim,
    charAt,
    nonce,
    buildingProgress,
    setBuildingProgress,
    buildingKind,
    setBuildingKind,
    builtBuildings,
    setBuiltBuildings,
    character,
    setCharacter,
    islandStyle,
    setIslandStyle,
    proposalStyle,
    setProposalStyle,
    profile,
    projects,
    areas,
    discoverySettings,
    confirmedSubjects,
    curatedSources,
    researchReports,
    items,
    bundles,
    proposals,
    activeProposalId,
    activeBundleId,
    setActiveBundleId,
    activeItemId,
    setActiveItemId,
    proposalStatus,
    saveStep,
    setSaveStep,
    draft,
    setDraft,
    analyzing,
    resolvingItemId,
    searchTab,
    setSearchTab,
    hint,
    notifVisible,
    toastMsg,
    aiBusyLabel,
    savedReaction,
    bundleFromProposal,
    setBundleFromProposal,
    firebaseConnected,
    flash,
    openSheet,
    closeSheet,
    onboardingIsland,
    handleCompleteOnboarding,
    handleOnboardingStep,
    handleSkipOnboarding,
    handleAddProject,
    handleAddArea,
    handleUpdateProfile,
    handleProcessImageFile,
    handleOpenSave,
    handleAnalyzeDraft,
    commitSaveItem,
    handleCardTap,
    handleGoNight,
    handleApproveBundle,
    handleGoMorning,
    handleOpenProposal,
    handleDoIt,
    handleSkipToday,
    handleReleaseActive,
    handleBuildSuccess,
    handleReflectMada,
    handleOpenSort,
    handleDecideSomedayItem,
    handleUpdateItemIntent,
    handleChangeItemPara,
    handleRestoreItem,
    handleDeleteItem,
    handleUpdateBundleIntent,
    handleReleaseBundle,
    handleCompleteBundleToArchive,
    handleRestoreBundle,
    handleLoadUseCasePreset,
    handleUpdateDiscoverySettings,
    handleAddOrUpdateSubject,
    handleDeleteSubject,
    handleAnswerDiscoveryQuestion,
    handleReactToDiscoveryCard,
    handleRunDiscoveryNow,
    handleResetAll,
  } = useIslandUseCases();

  const inboxCount = researchReports.filter(
    (r) =>
      (r.card && !r.feedback) ||
      (r.question && r.question.status === 'pending')
  ).length;

  // 未回答のしつもんカード。ドックから「こたえる」で拾えるようにするために数える
  const pendingQuestionCount = researchReports.filter(
    (r) => r.question && r.question.status === 'pending'
  ).length;

  const floatingItems = items.filter((i) => i.floating && i.para !== 'Archives');
  // #40: 初回体験のあいだは、島が見本を使って「このアプリで何ができるか」を実演する
  const islandCards = onboardingIsland ? onboardingIsland.items : floatingItems;
  const pendingBundles = bundles.filter(
    (b) => b.approvalStatus === 'pending' && b.para !== 'Archives'
  );
  const activeBundle =
    bundles.find((b) => b.id === activeBundleId) ||
    pendingBundles[0] ||
    bundles.find((b) => b.para !== 'Archives') ||
    null;
  const activeProposal =
    proposals.find((p) => p.id === activeProposalId) || proposals[0] || null;
  const activeItem =
    items.find((i) => i.id === activeItemId) || floatingItems[0] || items[0] || null;
  const somedayItems = items.filter((i) => i.para === 'Someday');
  const hasBundleOnIsland =
    bundles.some((b) => b.para !== 'Archives') && buildingProgress == null;

  const currentProposal =
    activeProposal || buildFallbackProposal(activeBundle, proposalStatus);
  const currentBundle = activeBundle || buildFallbackBundle(items);

  const bundleItems = items.filter((it) =>
    currentBundle.itemIds.length
      ? currentBundle.itemIds.includes(it.id) ||
        it.bundleId === currentBundle.id ||
        it.placementId === currentBundle.id
      : it.bundleId === currentBundle.id || it.placementId === currentBundle.id
  );

  const vars = shellColors(phase);
  const inDrawerOrSheet = Boolean(sheet && sheet !== 'letter' && sheet !== 'sort');

  return (
    <main
      className="app-shell"
      style={
        {
          '--bg': vars.bg,
          '--ink-now': vars.ink,
        } as React.CSSProperties
      }
    >
      <div className="app-shell__bg" />

      {/* 3D の島（全画面キャンバス・一度マウントしたら破棄しない） */}
      <IslandCanvas
        styleKind={islandStyle}
        character={character}
        phase={phase}
        floatingItems={islandCards}
        hasBundleOnIsland={onboardingIsland ? onboardingIsland.bundle : hasBundleOnIsland}
        buildingProgress={onboardingIsland ? onboardingIsland.building : buildingProgress}
        buildingKind={buildingKind}
        extraBuildings={
          onboardingIsland || builtBuildings.length <= 1 ? [] : builtBuildings.slice(1, 4)
        }
        anim={anim}
        charAt={charAt}
        nonce={nonce}
        onCardTap={onboardingIsland ? () => {} : handleCardTap}
        onCharTap={() =>
          flash(
            computeBubbleText({
              floatingItems,
              proposalStatus,
              activeBundle,
              pendingBundlesCount: pendingBundles.length,
              phase,
              aiBusyLabel,
              savedReaction,
            })
          )
        }
      />

      {/* S1 はじめて（#40 島が実演する7画面のストーリーボード・スキップ可） */}
      <div className="layer layer--s1">
        {screen === 's1' ? (
          <S1Welcome
            character={character}
            onStart={handleSkipOnboarding}
            onCompleteOnboarding={handleCompleteOnboarding}
            onStepChange={handleOnboardingStep}
          />
        ) : null}
      </div>

      {/* S2 島（ホーム） */}
      <div className="layer layer--home">
        {screen === 'home' ? (
          <S2Home
            character={character}
            phase={phase}
            day={day}
            floatingItems={floatingItems}
            proposalStatus={proposalStatus}
            activeProposal={activeProposal}
            activeBundle={activeBundle}
            pendingBundlesCount={pendingBundles.length}
            somedayCount={somedayItems.length}
            inboxCount={inboxCount}
            pendingQuestionCount={pendingQuestionCount}
            hint={hint}
            aiBusyLabel={aiBusyLabel}
            savedReaction={savedReaction}
            onOpenSearch={() => openSheet('search')}
            onOpenSave={handleOpenSave}
            onOpenProposal={handleOpenProposal}
            onOpenReflect={() => openSheet('reflect')}
            onOpenPendingBundle={() => {
              if (pendingBundles[0]) {
                setActiveBundleId(pendingBundles[0].id);
                setBundleFromProposal(false);
                openSheet('bundle');
              }
            }}
            onTriggerNight={handleGoNight}
            onTriggerMorning={handleGoMorning}
            onOpenSort={handleOpenSort}
            onOpenInbox={() => openSheet('inbox')}
            onOpenSettings={() => openSheet('settings')}
          />
        ) : null}
      </div>

      {/* 通知バナー */}
      <div className="layer layer--notif">
        <NotificationBanner
          visible={notifVisible}
          character={character}
          askText={currentProposal.ask}
          onTap={handleOpenProposal}
        />
      </div>

      {/* トースト */}
      <div className="layer layer--toast">
        <ToastBanner message={toastMsg} />
      </div>

      {/* モーダルビュー（S4 手紙版 / S7 仕分け） */}
      {sheet === 'letter' || sheet === 'sort' ? (
        <div className="layer layer--full">
          <div className="full-scrim" onClick={() => setSheet(null)} />
          <div className="full-modal">
            {sheet === 'letter' ? (
              <S4ProposalLetter
                character={character}
                proposal={currentProposal}
                bundle={currentBundle}
                bundleItemsCount={Math.max(1, bundleItems.length)}
                onOpenBundle={() => {
                  setBundleFromProposal(true);
                  setSheet('bundle');
                  setShown(true);
                }}
                onDoIt={handleDoIt}
                onSkipToday={handleSkipToday}
                onReleaseIt={handleReleaseActive}
                onClose={() => setSheet(null)}
              />
            ) : (
              <S7SortView
                character={character}
                somedayItems={somedayItems}
                onDecideItem={handleDecideSomedayItem}
                onClose={() => setSheet(null)}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* PC: 右ガラスドロワー / スマホ: ボトムシート（S3 保存 / S4 提案 / S5 束詳細 / S6 振り返り / S8 検索 / S9 保存物詳細 / 設定） */}
      <div
        className={`sheetwrap${shown ? ' is-shown' : ''}${
          sheet === 'bundle' || sheet === 'search' || sheet === 'inbox' ? ' sheet--full' : ''
        }`}
        hidden={!inDrawerOrSheet}
      >
        <div className="scrim" onClick={() => closeSheet()} />
        <div className="sheet">
          <div className="sheet__header">
            <div className="sheet__grab">
              <span />
            </div>
            <button
              className="iconbtn iconbtn--soft iconbtn--sm sheet__close"
              onClick={() => closeSheet()}
              aria-label="閉じる"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="sheet__body">
            {sheet === 'save' ? (
              <S3SaveSheet
                character={character}
                step={saveStep}
                draft={draft}
                analyzing={analyzing}
                resolvingMode={Boolean(resolvingItemId)}
                aiConsentGranted={profile.aiConsentGranted}
                projects={projects}
                areas={areas}
                onToggleAiConsent={(granted) =>
                  handleUpdateProfile({
                    aiConsentGranted: granted,
                    aiConsentAt: granted ? Date.now() : null,
                  })
                }
                onChangeDraft={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onUploadImage={handleProcessImageFile}
                onAnalyze={handleAnalyzeDraft}
                onConfirmIntent={(text) => commitSaveItem(text, false)}
                onSaveReference={() =>
                  commitSaveItem('参考資料として眺める・残しておく', false, {
                    isReference: true,
                  })
                }
                onSaveLater={() => commitSaveItem(null, true)}
                onBackToInput={() => setSaveStep('input')}
              />
            ) : sheet === 'proposal' ? (
              <S4ProposalSheet
                character={character}
                proposal={currentProposal}
                bundle={currentBundle}
                bundleItems={bundleItems}
                onOpenBundle={() => {
                  setBundleFromProposal(true);
                  setSheet('bundle');
                }}
                onDoIt={handleDoIt}
                onSkipToday={handleSkipToday}
                onReleaseIt={handleReleaseActive}
              />
            ) : sheet === 'bundle' ? (
              <S5BundleSheet
                bundle={currentBundle}
                items={bundleItems}
                projects={projects}
                areas={areas}
                canGoBackToProposal={bundleFromProposal}
                onBack={() => {
                  if (bundleFromProposal) {
                    setBundleFromProposal(false);
                    setSheet(proposalStyle === 'letter' ? 'letter' : 'proposal');
                  } else {
                    closeSheet();
                  }
                }}
                onSelectItem={(itemId) => {
                  setActiveItemId(itemId);
                  setSheet('item');
                }}
                onUpdateBundleIntent={handleUpdateBundleIntent}
                onApproveBundle={handleApproveBundle}
                onReleaseBundle={handleReleaseBundle}
                onCompleteBundleToArchive={handleCompleteBundleToArchive}
                onRestoreBundle={handleRestoreBundle}
              />
            ) : sheet === 'reflect' ? (
              <S6ReflectSheet
                character={character}
                proposal={currentProposal}
                onUploadImage={handleProcessImageFile}
                onFinishDone={handleBuildSuccess}
                onFinishMada={handleReflectMada}
                onFinishRelease={handleReleaseActive}
              />
            ) : sheet === 'item' && activeItem ? (
              <S9ItemSheet
                item={activeItem}
                parentBundle={
                  activeItem.bundleId
                    ? bundles.find((b) => b.id === activeItem.bundleId) || null
                    : null
                }
                projects={projects}
                areas={areas}
                onUpdateIntent={handleUpdateItemIntent}
                onChangePara={handleChangeItemPara}
                onRestoreItem={handleRestoreItem}
                onDeleteItem={handleDeleteItem}
                onOpenBundle={(bundleId) => {
                  setActiveBundleId(bundleId);
                  setBundleFromProposal(false);
                  setSheet('bundle');
                }}
              />
            ) : sheet === 'search' ? (
              <S8SearchSheet
                activeTab={searchTab}
                items={items}
                bundles={bundles}
                onChangeTab={setSearchTab}
                onSelectBundle={(bundleId) => {
                  setActiveBundleId(bundleId);
                  setBundleFromProposal(false);
                  setSheet('bundle');
                }}
                onSelectItem={(itemId) => {
                  setActiveItemId(itemId);
                  setSheet('item');
                }}
                onAddProject={handleAddProject}
                onAddArea={handleAddArea}
                onRestoreItem={handleRestoreItem}
                onRestoreBundle={handleRestoreBundle}
              />
            ) : sheet === 'inbox' ? (
              <DiscoveryInboxSheet
                character={character}
                projects={projects}
                areas={areas}
                settings={discoverySettings}
                confirmedSubjects={confirmedSubjects}
                reports={researchReports}
                busy={Boolean(aiBusyLabel)}
                onUpdateSettings={handleUpdateDiscoverySettings}
                onAddOrUpdateSubject={handleAddOrUpdateSubject}
                onDeleteSubject={handleDeleteSubject}
                onAnswerQuestion={handleAnswerDiscoveryQuestion}
                onReactToCard={handleReactToDiscoveryCard}
                onRunDiscoveryNow={handleRunDiscoveryNow}
                onClose={() => closeSheet()}
              />
            ) : sheet === 'settings' ? (
              <SettingsSheet
                character={character}
                islandStyle={islandStyle}
                proposalStyle={proposalStyle}
                buildingKind={buildingKind}
                builtBuildings={builtBuildings}
                profile={profile}
                projects={projects}
                areas={areas}
                firebaseConnected={firebaseConnected}
                totalItemsCount={items.length}
                bundlesCount={bundles.length}
                onChangeCharacter={setCharacter}
                onChangeIslandStyle={setIslandStyle}
                onChangeProposalStyle={setProposalStyle}
                onSelectBuildingKind={(kind) => {
                  setBuildingKind(kind);
                  setBuiltBuildings([kind]);
                  setBuildingProgress(1);
                  setAnim('none');
                  closeSheet();
                  flash(`建物ライブラリ「${kind}」を島に配置しました`);
                }}
                onSelectGrowthStage={(blds) => {
                  if (blds.length > 0) {
                    setBuildingKind(blds[0]);
                    setBuiltBuildings(blds);
                    setBuildingProgress(1);
                    setAnim('none');
                    closeSheet();
                    flash(`島の成長ステージ（${blds.length}棟）を表示しました`);
                  }
                }}
                onUpdateProfile={handleUpdateProfile}
                onAddProject={handleAddProject}
                onAddArea={handleAddArea}
                onLoadUseCasePreset={handleLoadUseCasePreset}
                discoverySettings={discoverySettings}
                confirmedSubjects={confirmedSubjects}
                curatedSources={curatedSources}
                onUpdateDiscoverySettings={handleUpdateDiscoverySettings}
                onOpenDiscoveryInbox={() => setSheet('inbox')}
                onReopenOnboarding={() => {
                  closeSheet(() => {
                    setScreen('s1');
                  });
                }}
                onResetAll={handleResetAll}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
};
