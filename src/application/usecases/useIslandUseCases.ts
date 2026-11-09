import { useEffect, useRef, useState } from 'react';
import {
  buildUseCasePersonaPresets,
  getDefaultUserProfile,
  NAMES,
  type UseCasePersonaPreset,
} from '../../domain/constants/islandConstants';
import type {
  AreaEntity,
  BuildingKind,
  Bundle,
  CharacterKind,
  IslandStyleKind,
  ParaCategory,
  PersistedState,
  PhaseKind,
  ProjectEntity,
  Proposal,
  ProposalStatus,
  ProposalStyleKind,
  SavedItem,
  UserSurveyProfile,
} from '../../domain/models/islandModels';
import {
  archiveItemsOfBundle,
  computeLocalDateString,
  computeSavedReaction,
  inferBuildingKindFromBundle,
  isItemInBundle,
  selectItemsForNightOrganize,
  selectTargetBundleForToday,
} from '../../domain/rules/islandRules';
import type { ProjectAreaTarget } from '../../../functions/src/domain/schemas';
import {
  apiAnalyzeItem,
  apiConfirmIntent,
  apiMorningPropose,
  apiNightOrganize,
  apiRunDiscoveryCycle,
} from '../../infrastructure/ai/aiFlowClient';
import type {
  ConfirmedSubject,
  CuratedSource,
  DiscoveryFeedback,
  DiscoverySettings,
  ResearchReport,
} from '../../domain/models/proactiveDiscoveryModels';
import {
  buildDefaultConfirmedSubjects,
  buildDefaultCuratedSources,
  buildDefaultDiscoverySettings,
} from '../../domain/rules/proactiveDiscoveryRules';
import {
  buildFavoriteSubject,
  buildOnboardingSampleItems,
  islandStateForStep,
  resolveSearchConsent,
} from '../../domain/rules/onboardingRules';
import { applyDiscoveryFeedbackIdempotent } from '../../../functions/src/application/proactiveDiscoveryUseCases';
import { isFirebaseConfigured } from '../../infrastructure/firebase/firebaseClient';
import {
  clearFirestoreUserData,
  clearLocalState,
  deleteItemFromFirestore,
  loadFromFirestore,
  readInitialLocalState,
  saveLocalState,
  syncToFirestore,
} from '../../infrastructure/firebase/firestoreRepository';
import {
  deleteItemImageIfConfigured,
  uploadItemImageIfConfigured,
} from '../../infrastructure/firebase/storageClient';
import {
  makeProceduralSticker,
  processUploadedImage,
} from '../../infrastructure/media/stickerMaker';
import { emptyDraft, type SaveDraft, type SheetKind } from '../../presentation/types/uiTypes';

export function useIslandUseCases() {
  const initial = useRef<Partial<PersistedState>>(readInitialLocalState()).current;
  const hasInitialData = Boolean(
    initial.screen ||
      (initial.items && initial.items.length > 0) ||
      (initial.bundles && initial.bundles.length > 0) ||
      (initial.projects && initial.projects.length > 0)
  );

  // 基本画面状態
  const [screen, setScreen] = useState<'s1' | 'home'>(initial.screen || 's1');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [shown, setShown] = useState<boolean>(false);

  // 島の状態
  const [phase, setPhase] = useState<PhaseKind>(initial.phase || 'day');
  const [day, setDay] = useState<number>(initial.day || 1);
  const [anim, setAnim] = useState<string>(hasInitialData ? 'none' : 'birth');
  const [charAt, setCharAt] = useState<string>('default');
  // #40: 初回体験のあいだだけ島に見せる内容。保存データには入れない（表示専用）
  const [onboardingIsland, setOnboardingIsland] = useState<{
    items: SavedItem[];
    bundle: boolean;
    building: number | null;
  } | null>(null);
  const [nonce, setNonce] = useState<number>(0);
  const [buildingProgress, setBuildingProgress] = useState<number | null>(
    initial.buildingProgress !== undefined ? initial.buildingProgress : null
  );
  const [buildingKind, setBuildingKind] = useState<BuildingKind>(
    initial.buildingKind || 'atelier'
  );
  const [builtBuildings, setBuiltBuildings] = useState<BuildingKind[]>(
    initial.builtBuildings || []
  );
  const [character, setCharacter] = useState<CharacterKind>(initial.character || 'poko');
  const [islandStyle, setIslandStyle] = useState<IslandStyleKind>(
    initial.islandStyle || 'puffy'
  );
  const [proposalStyle, setProposalStyle] = useState<ProposalStyleKind>(
    initial.proposalStyle || 'sheet'
  );

  // F01: ユーザープロフィール・Project・Area クラスター
  const [profile, setProfile] = useState<UserSurveyProfile>(
    initial.profile || getDefaultUserProfile()
  );
  const [projects, setProjects] = useState<ProjectEntity[]>(initial.projects || []);
  const [areas, setAreas] = useState<AreaEntity[]>(initial.areas || []);

  // A01〜A04: 能動発見（連絡箱・個別同意・確認済み人物・調査レポート・反応）
  const [discoverySettings, setDiscoverySettings] = useState<DiscoverySettings>(
    initial.discoverySettings ||
      buildDefaultDiscoverySettings(initial.profile || getDefaultUserProfile(), initial.projects || [])
  );
  const [confirmedSubjects, setConfirmedSubjects] = useState<ConfirmedSubject[]>(
    initial.confirmedSubjects || buildDefaultConfirmedSubjects(initial.projects || [])
  );
  const [curatedSources] = useState<CuratedSource[]>(buildDefaultCuratedSources());
  const [researchReports, setResearchReports] = useState<ResearchReport[]>(
    initial.researchReports || []
  );
  const [discoveryFeedbacks, setDiscoveryFeedbacks] = useState<DiscoveryFeedback[]>(
    initial.discoveryFeedbacks || []
  );

  // ユーザーデータ（保存物・束・提案）
  const [items, setItems] = useState<SavedItem[]>(initial.items || []);
  const [bundles, setBundles] = useState<Bundle[]>(initial.bundles || []);
  const [proposals, setProposals] = useState<Proposal[]>(initial.proposals || []);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(
    initial.activeProposalId !== undefined ? initial.activeProposalId : null
  );
  const [activeBundleId, setActiveBundleId] = useState<string | null>(
    initial.activeBundleId !== undefined ? initial.activeBundleId : null
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>(
    initial.proposalStatus || 'none'
  );

  // 保存シート（S3）の状態
  const [saveStep, setSaveStep] = useState<'input' | 'confirm'>('input');
  const [draft, setDraft] = useState<SaveDraft>(emptyDraft());
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  // 検索・通知・トースト
  const [searchTab, setSearchTab] = useState<string>('P');
  const [hint, setHint] = useState<boolean>(true);
  const [notifVisible, setNotifVisible] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [aiBusyLabel, setAiBusyLabel] = useState<string | null>(null);
  // 保存した直後のキャラクターの一言（#44）。しばらくしたら通常の一言に戻す
  const [savedReaction, setSavedReaction] = useState<string | null>(null);
  const savedReactionTimerRef = useRef<number | null>(null);
  const showSavedReaction = (text: string) => {
    if (savedReactionTimerRef.current) window.clearTimeout(savedReactionTimerRef.current);
    setSavedReaction(text);
    savedReactionTimerRef.current = window.setTimeout(() => setSavedReaction(null), 12000);
  };
  const [bundleFromProposal, setBundleFromProposal] = useState<boolean>(false);

  const toastTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef<boolean>(false);
  const autoGeneratingDateRef = useRef<string | null>(null);
  // ホーム表示時の自動生成が応答待ちの間だけ true。手動の「今日の一歩」と二重に作らないために使う
  const autoProposalInFlightRef = useRef<boolean>(false);

  const flash = (msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3400);
  };

  const openSheet = (target: SheetKind) => {
    setSheet(target);
    setShown(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShown(true));
    });
  };

  const closeSheet = (after?: () => void) => {
    setShown(false);
    setTimeout(() => {
      setSheet(null);
      setResolvingItemId(null);
      after?.();
    }, 280);
  };

  const closeAllOverlays = () => {
    setSheet(null);
    setShown(false);
    setNotifVisible(false);
    setResolvingItemId(null);
  };

  // アクティブな Project / Area ターゲット配列を構築
  const buildActiveTargets = (): ProjectAreaTarget[] => [
    ...projects
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.id, name: p.name, goal: p.goal, kind: 'project' as const })),
    ...areas
      .filter((a) => a.status === 'active')
      .map((a) => ({ id: a.id, name: a.name, kind: 'area' as const })),
  ];

  // 初回マウント時に Firestore から最新状態を復元
  useEffect(() => {
    loadFromFirestore().then((remote) => {
      if (
        remote &&
        (remote.items.length > 0 ||
          remote.bundles.length > 0 ||
          remote.projects.length > 0 ||
          remote.areas.length > 0)
      ) {
        setItems(remote.items);
        setBundles(remote.bundles);
        setProposals(remote.proposals);
        if (remote.projects.length > 0) setProjects(remote.projects);
        if (remote.areas.length > 0) setAreas(remote.areas);
        // 連絡箱の状態。空のクラウド側で端末内のデータを潰さないよう、件数があるときだけ上書きする。
        if (remote.confirmedSubjects.length > 0) setConfirmedSubjects(remote.confirmedSubjects);
        if (remote.researchReports.length > 0) setResearchReports(remote.researchReports);
        if (remote.discoveryFeedbacks.length > 0) setDiscoveryFeedbacks(remote.discoveryFeedbacks);
        if (remote.meta) {
          if (typeof remote.meta.screen === 'string') {
            setScreen(remote.meta.screen as 's1' | 'home');
          }
          if (typeof remote.meta.phase === 'string') {
            setPhase(remote.meta.phase as PhaseKind);
          }
          if (typeof remote.meta.day === 'number') {
            setDay(remote.meta.day);
          }
          if (typeof remote.meta.proposalStatus === 'string') {
            setProposalStatus(remote.meta.proposalStatus as ProposalStatus);
          }
          if (typeof remote.meta.activeProposalId === 'string') {
            setActiveProposalId(remote.meta.activeProposalId);
          }
          if (typeof remote.meta.activeBundleId === 'string') {
            setActiveBundleId(remote.meta.activeBundleId);
          }
          if (typeof remote.meta.buildingProgress === 'number') {
            setBuildingProgress(remote.meta.buildingProgress);
          }
          if (typeof remote.meta.buildingKind === 'string') {
            setBuildingKind(remote.meta.buildingKind as BuildingKind);
          }
          if (Array.isArray(remote.meta.builtBuildings)) {
            setBuiltBuildings(remote.meta.builtBuildings as BuildingKind[]);
          }
          if (remote.meta.profile && typeof remote.meta.profile === 'object') {
            setProfile((prev) => ({
              ...prev,
              ...(remote.meta!.profile as Partial<UserSurveyProfile>),
            }));
          }
        }
        setAnim('none');
      }
      hydratedRef.current = true;
    });
  }, []);

  // 状態変化時に localStorage と Firestore に保存
  useEffect(() => {
    const stateToPersist: PersistedState = {
      screen,
      phase,
      day,
      character,
      islandStyle,
      proposalStyle,
      buildingProgress,
      buildingKind,
      builtBuildings,
      items,
      bundles,
      proposals,
      projects,
      areas,
      profile,
      discoverySettings,
      confirmedSubjects,
      researchReports,
      discoveryFeedbacks,
      activeProposalId,
      activeBundleId,
      proposalStatus,
    };
    saveLocalState(stateToPersist);

    if (hydratedRef.current) {
      syncToFirestore({
        meta: {
          screen,
          phase,
          day,
          character,
          islandStyle,
          proposalStyle,
          buildingProgress,
          buildingKind,
          builtBuildings,
          profile,
          discoverySettings,
          activeProposalId,
          activeBundleId,
          proposalStatus,
        },
        items,
        bundles,
        proposals,
        projects,
        areas,
        // 連絡箱の「好き」帳とフィードバックは本人が育てたデータなので必ずクラウドに残す。
        // researchReports はサーバー管理（rules で client write 禁止）のためここでは送らない。
        confirmedSubjects,
        discoveryFeedbacks,
      }).then((ok) => {
        if (!ok) {
          flash('クラウド同期に一時失敗しました（端末内には保存されています）');
        }
      });
    }
  }, [
    screen,
    phase,
    day,
    character,
    islandStyle,
    proposalStyle,
    buildingProgress,
    buildingKind,
    builtBuildings,
    items,
    bundles,
    proposals,
    projects,
    areas,
    profile,
    discoverySettings,
    confirmedSubjects,
    researchReports,
    discoveryFeedbacks,
    activeProposalId,
    activeBundleId,
    proposalStatus,
  ]);

  // F05: ホーム表示時に当日の提案がまだ無ければ、アクティブな Project（確定済み保存物あり）から1日1件だけ自動生成
  useEffect(() => {
    if (screen !== 'home') return;
    const todayLocal = computeLocalDateString(profile.timezone);
    // すでに当日の提案が存在する場合は新規生成しない（同日1件の冪等性）
    const existingToday = proposals.find((p) => p.localDate === todayLocal);
    if (existingToday) return;
    if (autoGeneratingDateRef.current === todayLocal) return;

    // アクティブな Project に紐づく確定済み保存物があるかチェック
    const hasProjectWithConfirmedItem = projects.some(
      (proj) =>
        proj.status === 'active' &&
        items.some(
          (it) =>
            it.intentConfirmed &&
            it.intentStatus !== 'reference' &&
            it.para === 'Projects' &&
            (it.placementId === proj.id || it.bundleId === proj.id)
        )
    );
    if (!hasProjectWithConfirmedItem) return;

    const candidateBundle = selectTargetBundleForToday({ projects, bundles, items });
    if (!candidateBundle) return;

    autoGeneratingDateRef.current = todayLocal;
    autoProposalInFlightRef.current = true;
    const bundleItems = items.filter(
      (it) =>
        candidateBundle.itemIds.includes(it.id) ||
        (candidateBundle.targetId && it.placementId === candidateBundle.targetId)
    );

    apiMorningPropose({
      bundle: {
        id: candidateBundle.id,
        intent: candidateBundle.intent,
        points: candidateBundle.points,
        tool: candidateBundle.tool,
        items: bundleItems.map((i) => ({
          title: i.title,
          intent: i.intent || i.title,
        })),
      },
      previousStatus: 'none',
      characterName: NAMES[character],
    })
      .then((stepOut) => {
        const newProposal: Proposal = {
          id: `prop-${todayLocal}`,
          bundleId: candidateBundle.id,
          projectId: candidateBundle.targetId || null,
          sourceItemIds: bundleItems.map((i) => i.id),
          localDate: todayLocal,
          timezoneAtCreation: profile.timezone,
          ask: stepOut.ask,
          title: stepOut.title,
          detail: stepOut.detail,
          minutes: stepOut.minutes,
          status: 'ready',
          createdAt: Date.now(),
        };
        setProposals((prev) => {
          if (prev.some((p) => p.localDate === todayLocal)) return prev;
          return [newProposal, ...prev];
        });
        setActiveProposalId(newProposal.id);
        setActiveBundleId(candidateBundle.id);
        setProposalStatus('ready');
      })
      .catch(() => {
        autoGeneratingDateRef.current = null;
      })
      .finally(() => {
        autoProposalInFlightRef.current = false;
      });
  }, [screen, projects, items, bundles, proposals, profile.timezone, character]);

  // PC / ブラウザ上で画像をドラッグ＆ドロップしたら即座に保存ドロワーを開く
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };
    const onDrop = async (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      e.preventDefault();
      if (screen === 's1') {
        setScreen('home');
        setAnim('none');
      }
      setResolvingItemId(null);
      setSaveStep('input');
      openSheet('save');
      const processed = await processUploadedImage(file);
      setDraft((prev) => ({
        ...prev,
        imageDataUrl: processed.imageDataUrl,
        stickerDataUrl: processed.stickerDataUrl,
        aspect: processed.aspect,
        fileName: file.name,
      }));
      flash('画像を読み込みました');
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [screen]);

  // ---------- F01: 初回アンケートと Project / Area 管理 ----------

  const handleCompleteOnboarding = (params: {
    projects: Array<{ name: string; goal: string }>;
    areaNames: string[];
    interests: string[];
    expectations: string[];
    // #40: 初回体験で「好き」帳の最初の1件と、外への検索の同意まで受け取る
    favoriteName?: string;
    favoriteHint?: string;
    acceptedSearch?: boolean;
    openSave?: boolean;
  }) => {
    const now = Date.now();
    const newProjects: ProjectEntity[] = params.projects
      .filter((p) => p.name.trim())
      .map((p, idx) => ({
        id: `proj-${now}-${idx}`,
        name: p.name.trim(),
        goal: p.goal.trim(),
        status: 'active' as const,
        createdAt: now + idx,
        updatedAt: now + idx,
      }));

    const newAreas: AreaEntity[] = params.areaNames
      .filter((n) => n.trim())
      .map((n, idx) => ({
        id: `area-${now}-${idx}`,
        name: n.trim(),
        status: 'active' as const,
        createdAt: now + idx,
        updatedAt: now + idx,
      }));

    // 登録した Project / Area に対応する初期クラスター（Bundle）も作成し、島と一覧で扱えるようにする
    const initialClusterBundles: Bundle[] = [
      ...newProjects.map((p, idx) => ({
        id: p.id,
        intent: p.name,
        points: [
          p.goal || `「${p.name}」の達成に向けた保存物の束`,
          '関連するスクショ・URL・メモがここに集まります',
        ],
        tool: p.name.slice(0, 12),
        itemIds: [],
        para: 'Projects' as const,
        readyForProposal: true,
        buildingLevel: 0,
        targetId: p.id,
        targetName: p.name,
        approvalStatus: 'approved' as const,
        createdAt: now + idx,
        updatedAt: now + idx,
      })),
      ...newAreas.map((a, idx) => ({
        id: a.id,
        intent: a.name,
        points: [`継続して大切にしたい領域「${a.name}」のクラスター`],
        tool: a.name.slice(0, 12),
        itemIds: [],
        para: 'Areas' as const,
        readyForProposal: false,
        buildingLevel: 0,
        targetId: a.id,
        targetName: a.name,
        approvalStatus: 'approved' as const,
        createdAt: now + 100 + idx,
        updatedAt: now + 100 + idx,
      })),
    ];

    if (newProjects.length > 0) {
      setProjects((prev) => [...newProjects, ...prev]);
    }
    if (newAreas.length > 0) {
      setAreas((prev) => [...newAreas, ...prev]);
    }
    if (initialClusterBundles.length > 0) {
      setBundles((prev) => [...initialClusterBundles, ...prev]);
      setActiveBundleId(initialClusterBundles[0].id);
    }

    setProfile((prev) => ({
      ...prev,
      onboardingCompleted: true,
      interests: params.interests,
      expectations: params.expectations,
    }));

    // #40: 「好き」帳の最初の1件。同名の多い名前は既存の規則どおり確認待ちにする
    const favorite = buildFavoriteSubject({
      name: params.favoriteName || '',
      hint: params.favoriteHint || '',
    });
    if (favorite) {
      handleAddOrUpdateSubject({
        ...favorite,
        projectId: newProjects[0]?.id || newAreas[0]?.id || null,
      });
    }

    // 外への検索は、名前を教えてもらったうえで本人がボタンを選んだときだけオンにする。
    // ここで探すテーマ（Project / Area）も一緒に入れないと、オンにしても手がかりがない
    const searchConsentGranted = resolveSearchConsent({
      favoriteName: params.favoriteName || '',
      userAcceptedSearch: Boolean(params.acceptedSearch),
    });
    setDiscoverySettings((prev) => ({
      ...prev,
      searchConsentGranted,
      searchConsentAt: searchConsentGranted ? now : null,
      enabledProjectIds:
        newProjects.length > 0 ? newProjects.map((p) => p.id) : prev.enabledProjectIds,
      enabledAreaIds: newAreas.length > 0 ? newAreas.map((a) => a.id) : prev.enabledAreaIds,
      updatedAt: now,
    }));

    setScreen('home');
    exitOnboarding();
    if (params.openSave) {
      setResolvingItemId(null);
      setSaveStep('input');
      openSheet('save');
    }
    if (newProjects.length > 0 || newAreas.length > 0) {
      flash(
        `Project ${newProjects.length}件・Area ${newAreas.length}件を島のクラスターに登録したよ`
      );
    }
  };

  // #40: 画面ごとに島が実演する。birth / addCard / settle / build は本番と同じアニメーション
  const handleOnboardingStep = (step: number, interests: string[]) => {
    const next = islandStateForStep(step);
    setPhase(next.phase);
    setCharAt(next.charAt);
    setAnim(next.anim);
    setOnboardingIsland({
      items: buildOnboardingSampleItems(interests).slice(0, next.cardCount),
      bundle: next.bundle,
      building: next.building,
    });
    // 同じ画面に戻ってきたときもアニメーションを再生し直す
    setNonce((n) => n + 1);
  };

  // 初回体験を抜けるときは、見本の島を捨てて本物の島に戻す
  const exitOnboarding = () => {
    setOnboardingIsland(null);
    setCharAt('default');
    setAnim('none');
    setNonce((n) => n + 1);
  };

  const handleSkipOnboarding = () => {
    exitOnboarding();
    setPhase('day');
    setScreen('home');
  };

  const handleAddProject = (name: string, goal: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const newProj: ProjectEntity = {
      id: `proj-${now}`,
      name: trimmed,
      goal: goal.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const newBundle: Bundle = {
      id: newProj.id,
      intent: newProj.name,
      points: [newProj.goal || `「${newProj.name}」に向けた保存物のクラスター`],
      tool: newProj.name.slice(0, 12),
      itemIds: [],
      para: 'Projects',
      readyForProposal: true,
      buildingLevel: 0,
      targetId: newProj.id,
      targetName: newProj.name,
      approvalStatus: 'approved',
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [newProj, ...prev]);
    setBundles((prev) => [newBundle, ...prev]);
    flash(`Project「${newProj.name}」を追加しました`);
  };

  const handleAddArea = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const newArea: AreaEntity = {
      id: `area-${now}`,
      name: trimmed,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const newBundle: Bundle = {
      id: newArea.id,
      intent: newArea.name,
      points: [`継続して大切にしたい領域「${newArea.name}」`],
      tool: newArea.name.slice(0, 12),
      itemIds: [],
      para: 'Areas',
      readyForProposal: false,
      buildingLevel: 0,
      targetId: newArea.id,
      targetName: newArea.name,
      approvalStatus: 'approved',
      createdAt: now,
      updatedAt: now,
    };
    setAreas((prev) => [newArea, ...prev]);
    setBundles((prev) => [newBundle, ...prev]);
    flash(`Area「${newArea.name}」を追加しました`);
  };

  const handleUpdateProfile = (patch: Partial<UserSurveyProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  // ---------- F1〜F3 & F02/F03: 保存・意図確認・保存直後の Project/Area 紐づけ ----------

  const handleOpenSave = () => {
    if (screen === 's1') {
      setScreen('home');
      setAnim('none');
    }
    setNotifVisible(false);
    setResolvingItemId(null);
    setSaveStep('input');
    setDraft(emptyDraft());
    openSheet('save');
  };

  const handleProcessImageFile = async (file: File) => {
    return processUploadedImage(file);
  };

  const handleAnalyzeDraft = async () => {
    setAnalyzing(true);
    try {
      // F02: AI送信同意がオフの場合はサーバーへ送信せずローカル手動解析を使う
      const result = profile.aiConsentGranted
        ? await apiAnalyzeItem({
            url: draft.url.trim() || undefined,
            rawText: draft.rawText.trim() || undefined,
            imageDataUrl: draft.imageDataUrl,
            fileName: draft.fileName,
            targets: buildActiveTargets(),
          })
        : {
            kind: (draft.imageDataUrl
              ? 'SCREENSHOT'
              : draft.url.trim()
                ? 'ARTICLE'
                : 'NOTE') as SavedItem['kind'],
            title:
              (draft.rawText || draft.fileName || draft.url || '保存したメモ').slice(0, 22),
            source: draft.imageDataUrl ? 'カメラロール' : draft.url ? 'Web' : 'メモ',
            note: 'AI送信オフのため、端末内で手動保存モードで開いたよ',
            color: '#2f5fd8',
            c2: '#5a80e2',
            intents: [
              '今進めているProjectの参考にする',
              '時間があるときに試してみる',
              '見るだけ・参考資料として残す',
            ],
            urlFetched: false,
            resourceTopic: '生活のTips',
          };

      let stickerDataUrl = draft.stickerDataUrl;
      let aspect = draft.aspect || 1;
      if (!stickerDataUrl) {
        const proc = await makeProceduralSticker({
          shape: result.kind === 'PHOTO' || result.kind === 'INSTAGRAM' ? 'cutout' : 'rect',
          color: result.color,
          label: result.title.slice(0, 6),
        });
        if (proc) {
          stickerDataUrl = proc.stickerDataUrl;
          aspect = proc.aspect;
        }
      }

      setDraft((prev) => ({
        ...prev,
        stickerDataUrl,
        aspect,
        analyzed: result,
      }));
      setSaveStep('confirm');
    } finally {
      setAnalyzing(false);
    }
  };

  const commitSaveItem = async (
    intentText: string | null,
    isUnknown: boolean,
    opts?: { isReference?: boolean; explicitTargetId?: string | null }
  ) => {
    const analyzed = draft.analyzed || {
      kind: 'NOTE' as const,
      title: draft.rawText || draft.url || '気になったアイデア',
      source: 'メモ',
      note: 'メモから読み取ったよ',
      color: '#f7a6d6',
      c2: '#f9c6e4',
      intents: ['試してみる', '調べてみる', '参考にする'],
    };

    const isReference = Boolean(opts?.isReference);
    const reaction = computeSavedReaction(
      isUnknown ? 'later' : isReference ? 'reference' : 'intent',
      analyzed.title
    );
    const chosenTargetId =
      opts?.explicitTargetId !== undefined ? opts.explicitTargetId : draft.selectedTargetId;
    const targets = buildActiveTargets();

    // 置き場の決定ヘルパー（F03: 明示選択 > AI明確一致 > 見るだけ(Resources) > 保留(Someday)）
    const resolvePlacement = async (): Promise<{
      emb: number[];
      para: ParaCategory;
      placementKind: SavedItem['placementKind'];
      placementId: string | null;
      bundleId: string | null;
      toast: string;
    }> => {
      if (isUnknown) {
        return {
          emb: [],
          para: 'Someday',
          placementKind: 'someday',
          placementId: null,
          bundleId: null,
          toast: 'あとで決めよう。「？」カードとしていつか箱に置いておくね',
        };
      }
      if (isReference) {
        return {
          emb: [],
          para: 'Resources',
          placementKind: 'resource',
          placementId: null,
          bundleId: null,
          toast: '「見るだけ・参考資料」として Resources にしまったよ',
        };
      }

      // ユーザーが明示的に Project / Area を選んだ場合
      if (chosenTargetId) {
        const matchedTarget = targets.find((t) => t.id === chosenTargetId);
        if (matchedTarget) {
          const para: ParaCategory = matchedTarget.kind === 'area' ? 'Areas' : 'Projects';
          return {
            emb: [],
            para,
            placementKind: matchedTarget.kind,
            placementId: matchedTarget.id,
            bundleId: matchedTarget.id,
            toast: `「${matchedTarget.name}」に入れたよ（詳細からいつでも変更できます）`,
          };
        }
      }

      // AI / ルールで登録済み Project / Area と照合
      if (intentText && profile.aiConsentGranted) {
        const res = await apiConfirmIntent({
          title: analyzed.title,
          intent: intentText,
          note: analyzed.note,
          isReference,
          targets,
        });
        const pm = res.placementMatch;
        if (pm?.confidence === 'clear') {
          if (pm.targetKind === 'resource') {
            return {
              emb: res.embedding,
              para: 'Resources',
              placementKind: 'resource',
              placementId: null,
              bundleId: null,
              toast: '参考資料（Resources）に入れたよ',
            };
          }
          const hit = targets.find((t) => t.id === pm.targetId);
          if (hit) {
            const para: ParaCategory = hit.kind === 'area' ? 'Areas' : 'Projects';
            return {
              emb: res.embedding,
              para,
              placementKind: hit.kind,
              placementId: hit.id,
              bundleId: hit.id,
              toast: `「${hit.name}」に紐づけたよ（タップで変更できます）`,
            };
          }
        }
        if (pm?.confidence === 'multiple') {
          return {
            emb: res.embedding,
            para: 'Someday',
            placementKind: 'someday',
            placementId: null,
            bundleId: null,
            toast: '複数の Project / Area 候補があるため、いつか箱に置いたよ（タップで選べます）',
          };
        }
        return {
          emb: res.embedding,
          para: 'Someday',
          placementKind: 'someday',
          placementId: null,
          bundleId: null,
          toast: '島に浮かべたよ（夜にProject/Areaへ束ね提案するね）',
        };
      }

      return {
        emb: [],
        para: 'Someday',
        placementKind: 'someday',
        placementId: null,
        bundleId: null,
        toast: '島に浮かべたよ',
      };
    };

    if (resolvingItemId) {
      const targetId = resolvingItemId;
      closeSheet(async () => {
        const plc = await resolvePlacement();
        setItems((prev) =>
          prev.map((it) =>
            it.id === targetId
              ? {
                  ...it,
                  intent: isUnknown ? null : intentText || '参考資料として残す',
                  intentConfirmed: !isUnknown,
                  intentStatus: isUnknown
                    ? 'pending'
                    : isReference
                      ? 'reference'
                      : 'confirmed',
                  para: plc.para,
                  placementKind: plc.placementKind,
                  placementId: plc.placementId,
                  bundleId: plc.bundleId ?? it.bundleId,
                  embedding: plc.emb.length ? plc.emb : it.embedding,
                }
              : it
          )
        );
        if (plc.bundleId) {
          setBundles((prev) =>
            prev.map((b) =>
              b.id === plc.bundleId && !b.itemIds.includes(targetId)
                ? { ...b, itemIds: [...b.itemIds, targetId], updatedAt: Date.now() }
                : b
            )
          );
        }
        setNonce((n) => n + 1);
        flash(plc.toast);
        showSavedReaction(reaction);
      });
      return;
    }

    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    closeSheet(async () => {
      const plc = await resolvePlacement();

      if (draft.imageDataUrl) {
        uploadItemImageIfConfigured(newId, draft.imageDataUrl);
      }

      const newItem: SavedItem = {
        id: newId,
        kind: analyzed.kind,
        url: draft.url.trim() || undefined,
        rawText: draft.rawText.trim() || undefined,
        imageDataUrl: draft.imageDataUrl,
        stickerDataUrl: draft.stickerDataUrl,
        aspect: draft.aspect || 1,
        title: analyzed.title,
        source: analyzed.source,
        note: analyzed.note,
        color: analyzed.color,
        c2: analyzed.c2,
        intents: analyzed.intents,
        intent: isUnknown ? null : intentText || '参考資料として残す',
        intentConfirmed: !isUnknown,
        intentStatus: isUnknown ? 'pending' : isReference ? 'reference' : 'confirmed',
        para: plc.para,
        placementKind: plc.placementKind,
        placementId: plc.placementId,
        resourceTopic: analyzed.resourceTopic,
        urlFetched: analyzed.urlFetched,
        bundleId: plc.bundleId,
        floating: true,
        embedding: plc.emb,
        createdAt: Date.now(),
      };

      setItems((prev) => [...prev, newItem]);
      if (plc.bundleId) {
        setBundles((prev) =>
          prev.map((b) =>
            b.id === plc.bundleId && !b.itemIds.includes(newId)
              ? { ...b, itemIds: [...b.itemIds, newId], updatedAt: Date.now() }
              : b
          )
        );
      }
      setAnim('addCard');
      setHint(false);
      setNonce((n) => n + 1);
      flash(plc.toast);
      showSavedReaction(reaction);
    });
  };

  const handleCardTap = (item: SavedItem) => {
    if (!item.intentConfirmed) {
      setResolvingItemId(item.id);
      setDraft({
        url: item.url || '',
        rawText: item.rawText || '',
        imageDataUrl: item.imageDataUrl,
        stickerDataUrl: item.stickerDataUrl,
        aspect: item.aspect,
        selectedTargetId: item.placementId || null,
        analyzed: {
          kind: item.kind,
          title: item.title,
          source: item.source,
          note: item.note,
          color: item.color,
          c2: item.c2,
          intents: item.intents,
          urlFetched: item.urlFetched,
        },
      });
      setSaveStep('confirm');
      openSheet('save');
    } else {
      setActiveItemId(item.id);
      openSheet('item');
    }
  };

  // ---------- F5: 夜の整理（Project/Area クラスターへの提案型分類 & ユーザー承認） ----------

  const handleGoNight = async () => {
    const targetItems = selectItemsForNightOrganize(items);
    const confirmedAll = items.filter(
      (i) => i.intentConfirmed && i.intentStatus !== 'reference' && i.para !== 'Archives'
    );

    if (targetItems.length < 2) {
      flash(
        confirmedAll.length === 1
          ? '束にするには、もう1つ保存してね（2件以上で束ねられます）'
          : 'まずは「＋ 保存する」から気になるものを2つ以上保存してね'
      );
      handleOpenSave();
      return;
    }

    closeAllOverlays();
    setScreen('home');
    setAiBusyLabel('夜の整理中… Project / Area への束ね案を作っています');
    setPhase('night');
    setAnim('settle');
    setCharAt('default');
    setHint(false);
    setNonce((n) => n + 1);

    try {
      const result = await apiNightOrganize({
        items: targetItems.map((it) => ({
          id: it.id,
          title: it.title,
          kind: it.kind,
          intent: it.intent || it.intents[0] || it.title,
          note: it.note,
          embedding: it.embedding,
        })),
        targets: buildActiveTargets(),
      });

      const createdBundles: Bundle[] = result.bundles.map((b, idx) => ({
        id: `bundle-${Date.now()}-${idx}`,
        intent: b.intent,
        points: b.points,
        tool: b.tool,
        itemIds: b.itemIds,
        para: b.para,
        readyForProposal: b.readyForProposal,
        buildingLevel: 0,
        targetId: b.targetId || null,
        targetName: b.targetName,
        approvalStatus: b.approvalStatus || 'pending',
        createdAt: Date.now() + idx,
        updatedAt: Date.now() + idx,
      }));

      if (createdBundles.length > 0) {
        const primaryBundle = createdBundles[0];
        const bundledIdSet = new Set(createdBundles.flatMap((b) => b.itemIds));

        setBundles((prev) => [...createdBundles, ...prev]);
        setActiveBundleId(primaryBundle.id);
        setProposalStatus('none');

        window.setTimeout(() => {
          setItems((prev) =>
            prev.map((it) => {
              const matchingBundle = createdBundles.find((b) => b.itemIds.includes(it.id));
              if (!matchingBundle && !bundledIdSet.has(it.id)) return it;
              return {
                ...it,
                bundleId: matchingBundle ? matchingBundle.id : it.bundleId,
                para: matchingBundle ? matchingBundle.para : it.para,
                placementId: matchingBundle?.targetId || it.placementId,
                floating: false,
              };
            })
          );
          setAnim('none');
          setNonce((n) => n + 1);
        }, 3600);

        flash(
          `${createdBundles[0].itemIds.length}つの保存物の束ね案を作ったよ（詳細からワンタップで承認できます）`
        );
      }
    } finally {
      setAiBusyLabel(null);
    }
  };

  // 夜のクラスタリング提案をユーザーがワンタップ承認する
  const handleApproveBundle = (
    bundleId: string,
    overridePara?: ParaCategory,
    overrideTargetId?: string | null
  ) => {
    const targetObj = overrideTargetId
      ? buildActiveTargets().find((t) => t.id === overrideTargetId)
      : undefined;
    setBundles((prev) =>
      prev.map((b) => {
        if (b.id !== bundleId) return b;
        const nextPara = overridePara || (targetObj?.kind === 'area' ? 'Areas' : b.para);
        return {
          ...b,
          para: nextPara,
          targetId: overrideTargetId !== undefined ? overrideTargetId : b.targetId,
          targetName: targetObj ? targetObj.name : b.targetName,
          approvalStatus: 'approved',
          readyForProposal: nextPara === 'Projects',
          updatedAt: Date.now(),
        };
      })
    );
    setItems((prev) =>
      prev.map((it) => {
        if (it.bundleId !== bundleId) return it;
        const nextPara = overridePara || (targetObj?.kind === 'area' ? 'Areas' : it.para);
        return {
          ...it,
          para: nextPara,
          placementId: overrideTargetId !== undefined ? overrideTargetId : it.placementId,
        };
      })
    );
    flash('束の分類を承認しました！');
  };

  // ---------- F6 / F05: 朝の 1 日 1 提案 ----------

  const handleOpenProposal = () => {
    setNotifVisible(false);
    if (proposalStyle === 'letter') {
      setSheet('letter');
      setShown(true);
    } else {
      openSheet('proposal');
    }
  };

  const handleGoMorning = async () => {
    const todayLocal = computeLocalDateString(profile.timezone);
    // 同日の既存提案がある場合はそれを表示（F05: 同日に複数の別提案を増やさない）
    const existingToday = proposals.find((p) => p.localDate === todayLocal);
    if ((proposalStatus === 'ready' && activeProposalId) || existingToday) {
      if (existingToday && activeProposalId !== existingToday.id) {
        setActiveProposalId(existingToday.id);
        setActiveBundleId(existingToday.bundleId);
      }
      handleOpenProposal();
      return;
    }
    // ホーム表示時の自動生成がまだ返ってきていない。ここで作ると同じ日に2件目ができてしまう
    if (autoProposalInFlightRef.current) {
      flash(`${NAMES[character]}がいま今日の一歩を考えているよ`);
      return;
    }

    let targetBundle =
      selectTargetBundleForToday({ projects, bundles, items }) ||
      bundles.find((b) => b.id === activeBundleId && b.para !== 'Archives') ||
      bundles.find((b) => b.readyForProposal && b.para !== 'Archives') ||
      bundles.find((b) => b.para !== 'Archives');

    if (!targetBundle) {
      const confirmed = items.filter(
        (i) => i.intentConfirmed && i.intentStatus !== 'reference' && i.para !== 'Archives'
      );
      if (confirmed.length === 0) {
        // 保存シート自体がキャラクターの案内つきなので、トーストは重ねない（#31）
        handleOpenSave();
        return;
      }
      if (confirmed.length === 1) {
        // 1件でもアクティブなProjectがあれば、または単体からでも一歩を作れるようにする
        const single = confirmed[0];
        const created: Bundle = {
          id: `bundle-${Date.now()}`,
          intent: single.intent || single.title,
          points: [single.note || `${single.title}から始める最初の一歩`],
          tool: single.title.slice(0, 12),
          itemIds: [single.id],
          para: 'Projects',
          readyForProposal: true,
          buildingLevel: 0,
          approvalStatus: 'approved',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setBundles((prev) => [created, ...prev]);
        // 束の itemIds だけでなく保存物側の bundleId / para / floating も合わせる。
        // ここが片側だけだと、あとで「手放す」をしたときに保存物が島に取り残される。
        setItems((prev) =>
          prev.map((it) =>
            it.id === single.id
              ? { ...it, bundleId: created.id, para: created.para, floating: false }
              : it
          )
        );
        targetBundle = created;
      } else {
        closeAllOverlays();
        setAiBusyLabel('保存物を束ねて、今日の一歩を考えています…');
        const nightRes = await apiNightOrganize({
          items: confirmed.slice(-4).map((it) => ({
            id: it.id,
            title: it.title,
            kind: it.kind,
            intent: it.intent || it.intents[0] || it.title,
            note: it.note,
            embedding: it.embedding,
          })),
          targets: buildActiveTargets(),
        });

        if (nightRes.bundles.length > 0) {
          const b = nightRes.bundles[0];
          const created: Bundle = {
            id: `bundle-${Date.now()}`,
            intent: b.intent,
            points: b.points,
            tool: b.tool,
            itemIds: b.itemIds,
            para: b.para,
            readyForProposal: true,
            buildingLevel: 0,
            targetId: b.targetId || null,
            targetName: b.targetName,
            approvalStatus: 'approved',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setBundles((prev) => [created, ...prev]);
          setItems((prev) =>
            prev.map((it) =>
              created.itemIds.includes(it.id)
                ? { ...it, bundleId: created.id, para: created.para, floating: false }
                : it
            )
          );
          targetBundle = created;
        }
      }
    }

    if (!targetBundle) {
      setAiBusyLabel(null);
      return;
    }

    closeAllOverlays();
    setScreen('home');
    const bundleItems = items.filter(
      (it) =>
        targetBundle!.itemIds.includes(it.id) ||
        (targetBundle!.targetId && it.placementId === targetBundle!.targetId)
    );
    setAiBusyLabel(`${NAMES[character]}が今日の一歩を考えています…`);
    setPhase('morning');
    setDay((d) => d + (phase === 'night' ? 1 : 0));
    setAnim('none');
    setCharAt('default');
    setHint(false);

    try {
      const prevStat =
        proposalStatus === 'mada' || proposalStatus === 'skipped' ? proposalStatus : 'none';
      const stepOut = await apiMorningPropose({
        bundle: {
          id: targetBundle.id,
          intent: targetBundle.intent,
          points: targetBundle.points,
          tool: targetBundle.tool,
          items: bundleItems.map((i) => ({
            title: i.title,
            intent: i.intent || i.title,
          })),
        },
        previousStatus: prevStat,
        characterName: NAMES[character],
      });

      const newProposal: Proposal = {
        id: `prop-${todayLocal}-${Date.now()}`,
        bundleId: targetBundle.id,
        projectId: targetBundle.targetId || null,
        sourceItemIds: bundleItems.map((i) => i.id),
        localDate: todayLocal,
        timezoneAtCreation: profile.timezone,
        ask: stepOut.ask,
        title: stepOut.title,
        detail: stepOut.detail,
        minutes: stepOut.minutes,
        status: 'ready',
        createdAt: Date.now(),
      };

      setProposals((prev) => [newProposal, ...prev]);
      setActiveProposalId(newProposal.id);
      setActiveBundleId(targetBundle.id);
      setProposalStatus('ready');
      setNonce((n) => n + 1);
      window.setTimeout(() => setNotifVisible(true), 350);
    } finally {
      setAiBusyLabel(null);
    }
  };

  const handleDoIt = () => {
    closeSheet(() => {
      setProposalStatus('doing');
      if (activeProposalId) {
        setProposals((prev) =>
          prev.map((p) => (p.id === activeProposalId ? { ...p, status: 'doing' } : p))
        );
      }
      // 「いってらっしゃい」は吹き出しが言うので、トーストは重ねない（#45）
    });
  };

  const handleSkipToday = () => {
    closeSheet(() => {
      setProposalStatus('skipped');
      if (activeProposalId) {
        setProposals((prev) =>
          prev.map((p) => (p.id === activeProposalId ? { ...p, status: 'skipped' } : p))
        );
      }
    });
  };

  // F05 / T24: 「もういい」は提案を終了し、元の保存データは消さない
  const handleReleaseActive = () => {
    closeSheet(() => {
      setProposalStatus('released');
      if (activeProposalId) {
        setProposals((prev) =>
          prev.map((p) => (p.id === activeProposalId ? { ...p, status: 'released' } : p))
        );
      }
      if (activeBundleId) {
        const releasedBundle = bundles.find((b) => b.id === activeBundleId);
        setBundles((prev) =>
          prev.map((b) =>
            b.id === activeBundleId
              ? { ...b, para: 'Archives', readyForProposal: false }
              : b
          )
        );
        // 所属の判定は isItemInBundle に一本化する。bundleId だけで見ると、
        // itemIds / placementId でしか紐づいていない保存物が島に浮いたまま取り残される。
        if (releasedBundle) {
          setItems((prev) => archiveItemsOfBundle(prev, releasedBundle));
        }
      }
      setNonce((n) => n + 1);
    });
  };

  // ---------- F8 / F05 / T25: 振り返りと建物の建設（重複操作で二重成長しない冪等性） ----------

  const handleBuildSuccess = (word?: string | null, photoDataUrl?: string | null) => {
    const activeProp = proposals.find((p) => p.id === activeProposalId);
    const alreadyDone = activeProp?.status === 'done' || proposalStatus === 'done';
    const currentBundle = bundles.find((b) => b.id === activeBundleId) || bundles[0] || null;
    const inferredKind = inferBuildingKindFromBundle(currentBundle);

    if (activeProposalId) {
      setProposals((prev) =>
        prev.map((p) =>
          p.id === activeProposalId
            ? {
                ...p,
                status: 'done',
                reflectWord: word || null,
                reflectPhotoDataUrl: photoDataUrl || null,
              }
            : p
        )
      );
    }
    if (activeBundleId && !alreadyDone) {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === activeBundleId
            ? { ...b, buildingLevel: b.buildingLevel + 1, buildingKind: inferredKind }
            : b
        )
      );
    }
    setBuildingKind(inferredKind);
    if (!alreadyDone) {
      setBuiltBuildings((prev) => {
        if (prev.length === 0) return [inferredKind];
        if (!prev.includes(inferredKind) && prev.length < 4) {
          return [...prev, inferredKind];
        }
        if (prev.length < 4) {
          const fallbackOrder: BuildingKind[] = [
            'atelier',
            'kitchen_cafe',
            'study_tower',
            'greenhouse',
            'boutique',
            'pavilion',
          ];
          const nextCandidate =
            fallbackOrder.find((k) => !prev.includes(k)) || inferredKind;
          return [...prev, nextCandidate];
        }
        return prev;
      });
    }
    setScreen('home');
    setPhase('day');
    setBuildingProgress(1);
    setAnim('build');
    setCharAt('build');
    setProposalStatus('done');
    setSheet(null);
    setShown(false);
    setNonce((n) => n + 1);
  };

  // 建物が建ったあとに、ひとこと・写真だけを残す（#45）。建物は増やさない
  const handleSaveReflection = (word: string | null, photoDataUrl: string | null) => {
    closeSheet(() => {
      if (activeProposalId) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === activeProposalId
              ? { ...p, reflectWord: word, reflectPhotoDataUrl: photoDataUrl }
              : p
          )
        );
      }
      if (word || photoDataUrl) flash('ひとこと、残しておいたよ');
    });
  };

  const handleReflectMada = () => {
    closeSheet(() => {
      setProposalStatus('mada');
      if (activeProposalId) {
        setProposals((prev) =>
          prev.map((p) => (p.id === activeProposalId ? { ...p, status: 'mada' } : p))
        );
      }
      flash('次はもっと小さな一歩にして提案するね');
    });
  };

  // ---------- F7: 週 1 のいつか箱（Someday）仕分け ----------

  const handleOpenSort = () => {
    closeAllOverlays();
    setScreen('home');
    setAnim('none');
    setSheet('sort');
    setShown(true);
  };

  const handleDecideSomedayItem = (itemId: string, makeProject: boolean) => {
    const nextPara: ParaCategory = makeProject ? 'Projects' : 'Resources';
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              para: nextPara,
              intentStatus: makeProject ? 'confirmed' : 'reference',
              placementKind: makeProject ? 'project' : 'resource',
            }
          : it
      )
    );
  };

  // ---------- データ編集・紐づけ変更・Archive復元・完全削除（F03 / P1 / R03 / T19） ----------

  const handleUpdateItemIntent = async (itemId: string, nextIntent: string) => {
    const target = items.find((i) => i.id === itemId);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, intent: nextIntent, intentConfirmed: true, intentStatus: 'confirmed' }
          : it
      )
    );
    flash('意図を更新したよ');
    if (target && profile.aiConsentGranted) {
      const embRes = await apiConfirmIntent({
        title: target.title,
        intent: nextIntent,
        note: target.note,
        targets: buildActiveTargets(),
      });
      if (embRes.embedding.length) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, embedding: embRes.embedding } : it))
        );
      }
    }
  };

  const handleChangeItemPara = (
    itemId: string,
    nextPara: ParaCategory,
    targetPlacementId?: string | null
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const previousPara = nextPara === 'Archives' ? it.para : it.previousPara;
        return {
          ...it,
          previousPara,
          para: nextPara,
          placementId: targetPlacementId !== undefined ? targetPlacementId : it.placementId,
          bundleId:
            targetPlacementId !== undefined
              ? targetPlacementId
              : nextPara === 'Resources' || nextPara === 'Someday'
                ? null
                : it.bundleId,
          intentStatus: nextPara === 'Resources' ? 'reference' : it.intentStatus,
          floating: nextPara === 'Archives' ? false : it.floating,
        };
      })
    );
    if (targetPlacementId) {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === targetPlacementId && !b.itemIds.includes(itemId)
            ? { ...b, itemIds: [...b.itemIds, itemId], updatedAt: Date.now() }
            : b.id !== targetPlacementId && b.itemIds.includes(itemId)
              ? { ...b, itemIds: b.itemIds.filter((id) => id !== itemId) }
              : b
        )
      );
    }
    flash(`${nextPara} に移動したよ`);
  };

  // P1: Archive から元の置き場へ復元する
  const handleRestoreItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const restoredPara =
          it.previousPara && it.previousPara !== 'Archives' ? it.previousPara : 'Projects';
        return {
          ...it,
          para: restoredPara,
          floating: true,
        };
      })
    );
    flash('Archives から復元したよ');
  };

  // R03 / T19: 保存物の完全削除（Firestore + Storage 両方を削除）
  const handleDeleteItem = async (itemId: string) => {
    closeSheet(async () => {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setBundles((prev) =>
        prev.map((b) => ({
          ...b,
          itemIds: b.itemIds.filter((id) => id !== itemId),
        }))
      );
      if (activeItemId === itemId) {
        setActiveItemId(null);
      }
      const [dbOk, storageOk] = await Promise.all([
        deleteItemFromFirestore(itemId),
        deleteItemImageIfConfigured(itemId),
      ]);
      setNonce((n) => n + 1);
      if (dbOk && storageOk) {
        flash('保存物を削除しました');
      } else {
        flash('端末から削除しました（クラウド削除は次回同期時に再試行されます）');
      }
    });
  };

  const handleUpdateBundleIntent = (bundleId: string, nextIntent: string) => {
    setBundles((prev) =>
      prev.map((b) =>
        b.id === bundleId ? { ...b, intent: nextIntent, updatedAt: Date.now() } : b
      )
    );
    flash('束の意図を書きなおしたよ');
  };

  const handleReleaseBundle = (bundleId: string) => {
    const releasedBundle = bundles.find((b) => b.id === bundleId);
    closeSheet(() => {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === bundleId ? { ...b, para: 'Archives', readyForProposal: false } : b
        )
      );
      if (releasedBundle) {
        setItems((prev) => archiveItemsOfBundle(prev, releasedBundle));
      }
      if (activeBundleId === bundleId) {
        setProposalStatus('released');
      }
      setNonce((n) => n + 1);
      flash('束を Archives に移したよ（いつでも復元できます）');
    });
  };

  const handleCompleteBundleToArchive = (bundleId: string) => {
    const completedBundle = bundles.find((b) => b.id === bundleId);
    closeSheet(() => {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === bundleId
            ? { ...b, para: 'Archives', readyForProposal: false, updatedAt: Date.now() }
            : b
        )
      );
      setProjects((prev) =>
        prev.map((p) => (p.id === bundleId ? { ...p, status: 'archived', updatedAt: Date.now() } : p))
      );
      setItems((prev) =>
        prev.map((it) =>
          isItemInBundle(it, completedBundle ?? { id: bundleId, itemIds: [] })
            ? { ...it, previousPara: it.para, para: 'Archives' as const, floating: false }
            : it
        )
      );
      setNonce((n) => n + 1);
      flash('Project を達成・完了として Archives に記録したよ！');
    });
  };

  const handleRestoreBundle = (bundleId: string) => {
    setBundles((prev) =>
      prev.map((b) =>
        b.id === bundleId ? { ...b, para: 'Projects', readyForProposal: true } : b
      )
    );
    setProjects((prev) =>
      prev.map((p) => (p.id === bundleId ? { ...p, status: 'active', updatedAt: Date.now() } : p))
    );
    setItems((prev) =>
      prev.map((it) =>
        it.bundleId === bundleId ? { ...it, para: 'Projects' } : it
      )
    );
    flash('束を Projects に復元したよ');
  };

  // マルチペルソナ・ユースケースプリセットの読み込み（localStorage & Firestore DB に即座に反映）
  const handleLoadUseCasePreset = (presetId: UseCasePersonaPreset['id']) => {
    const todayLocal = computeLocalDateString(profile.timezone);
    const presets = buildUseCasePersonaPresets(todayLocal);
    const chosen = presets.find((p) => p.id === presetId) || presets[0];
    const presetBuildingsMap: Record<UseCasePersonaPreset['id'], BuildingKind[]> = {
      design_maker: ['atelier'],
      cooking_living: ['kitchen_cafe', 'greenhouse'],
      second_brain_study: ['study_tower', 'atelier'],
      fashion_hobby: ['boutique', 'pavilion', 'greenhouse'],
    };
    const presetBlds = presetBuildingsMap[chosen.id] || ['atelier'];
    closeAllOverlays();
    setScreen('home');
    setPhase('morning');
    setDay(2);
    setCharacter(chosen.character);
    setProjects(chosen.projects);
    setAreas(chosen.areas);
    setItems(chosen.items);
    setBundles(chosen.bundles);
    setProposals([chosen.proposal]);
    setActiveProposalId(chosen.proposal.id);
    setActiveBundleId(chosen.bundles[0]?.id || null);
    setProposalStatus('ready');
    setBuildingProgress(1);
    setBuildingKind(presetBlds[0]);
    setBuiltBuildings(presetBlds);
    setProfile((prev) => ({
      ...prev,
      onboardingCompleted: true,
    }));
    setDiscoverySettings((prev) => ({
      ...prev,
      enabledProjectIds: chosen.projects.map((p) => p.id),
      enabledAreaIds: chosen.areas.map((a) => a.id),
      updatedAt: Date.now(),
    }));
    setAnim('none');
    setNonce((n) => n + 1);
    flash(`ユースケース「${chosen.label}」をDBに読み込みました`);
  };

  // ---------- A01〜A04: 能動発見（連絡箱・個別同意・人物確認・反応）ハンドラ ----------

  const handleUpdateDiscoverySettings = (patch: Partial<DiscoverySettings>) => {
    setDiscoverySettings((prev) => {
      const next: DiscoverySettings = {
        ...prev,
        ...patch,
        updatedAt: Date.now(),
      };
      if (patch.aiConsentGranted !== undefined) {
        setProfile((p) => ({
          ...p,
          aiConsentGranted: Boolean(patch.aiConsentGranted),
          aiConsentAt: patch.aiConsentGranted ? Date.now() : null,
        }));
      }
      return next;
    });
    if (patch.paused === true || patch.searchConsentGranted === false) {
      flash('未着手の外部検索を停止しました（既に送信済みの検索語は取り消せません）');
    } else {
      flash('能動発見・同意設定を更新しました');
    }
  };

  const handleAddOrUpdateSubject = (input: {
    id?: string;
    canonicalName: string;
    disambiguationHint?: string;
    officialUrl?: string;
    frequency: ConfirmedSubject['frequency'];
    confirmationState: ConfirmedSubject['confirmationState'];
    source: ConfirmedSubject['source'];
    projectId: string | null;
  }) => {
    setConfirmedSubjects((prev) => {
      // A01: 本人が削除・拒否した人物をAI仮説で自動再登録しない
      const existingByIdOrName = prev.find(
        (s) =>
          (input.id && s.id === input.id) ||
          s.canonicalName.trim().toLowerCase() === input.canonicalName.trim().toLowerCase()
      );
      if (
        existingByIdOrName &&
        !input.id &&
        input.source !== 'manual_input' &&
        (existingByIdOrName.confirmationState === 'deleted' ||
          existingByIdOrName.confirmationState === 'rejected')
      ) {
        return prev;
      }

      if (existingByIdOrName) {
        return prev.map((s) =>
          s.id === existingByIdOrName.id
            ? {
                ...s,
                canonicalName: input.canonicalName.trim(),
                disambiguationHint: input.disambiguationHint ?? s.disambiguationHint,
                officialUrl: input.officialUrl ?? s.officialUrl,
                frequency: input.frequency,
                confirmationState: input.confirmationState,
                source: input.source,
                projectId: input.projectId ?? s.projectId,
                updatedAt: Date.now(),
              }
            : s
        );
      }

      const newSubj: ConfirmedSubject = {
        id: input.id || `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        canonicalName: input.canonicalName.trim(),
        category: 'artist',
        disambiguationHint: input.disambiguationHint,
        officialUrl: input.officialUrl,
        frequency: input.frequency,
        confirmationState: input.confirmationState,
        source: input.source,
        projectId: input.projectId,
        updatedAt: Date.now(),
      };
      return [newSubj, ...prev];
    });
    flash(
      input.confirmationState === 'confirmed'
        ? `「${input.canonicalName}」を本人確認済みとして記録しました`
        : input.confirmationState === 'pending_disambiguation'
          ? `「${input.canonicalName}」は同名の活動者がいるため、特定メモの入力または選択をお願いします`
          : `「${input.canonicalName}」の状態を更新しました`
    );
  };

  const handleDeleteSubject = (subjectId: string) => {
    // A01: 削除された項目は confirmationState: 'deleted' として保持し、自動再登録を防止する
    setConfirmedSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, confirmationState: 'deleted', frequency: 'no', updatedAt: Date.now() }
          : s
      )
    );
    flash('プロフィールから削除しました（自動で再登録されることはありません）');
  };

  const handleAnswerDiscoveryQuestion = (
    reportId: string,
    answer: string,
    status: 'answered' | 'skipped' | 'declined'
  ) => {
    setResearchReports((prev) =>
      prev.map((rep) => {
        if (rep.id !== reportId || !rep.question) return rep;
        return {
          ...rep,
          question: {
            ...rep.question,
            status,
            answer,
            answeredAt: Date.now(),
          },
        };
      })
    );
    const targetRep = researchReports.find((r) => r.id === reportId);
    if (status === 'answered' && targetRep?.question?.kind === 'region_period') {
      setDiscoverySettings((prev) => ({
        ...prev,
        regionPreference: answer,
        updatedAt: Date.now(),
      }));
    } else if (
      status === 'answered' &&
      targetRep?.question?.candidateSubjectId
    ) {
      const subjId = targetRep.question.candidateSubjectId;
      const isPositive = answer.includes('聴く');
      const isNegative = answer.includes('違う');
      setConfirmedSubjects((prev) =>
        prev.map((s) =>
          s.id === subjId
            ? {
                ...s,
                frequency: isPositive
                  ? answer.includes('たまに')
                    ? 'sometimes'
                    : 'often'
                  : isNegative
                    ? 'no'
                    : 'unknown',
                confirmationState: isPositive
                  ? 'confirmed'
                  : isNegative
                    ? 'rejected'
                    : 'unconfirmed',
                updatedAt: Date.now(),
              }
            : s
        )
      );
    }
    flash(
      status === 'answered'
        ? '回答を本人確認情報として記録しました'
        : '質問をスキップしました（未回答で追いかけることはありません）'
    );
  };

  const handleReactToDiscoveryCard = (
    reportId: string,
    reaction: DiscoveryFeedback['reaction'],
    reason?: string
  ) => {
    const targetReport = researchReports.find((r) => r.id === reportId);
    if (!targetReport) return;

    const { updatedReport, feedbackRecord } = applyDiscoveryFeedbackIdempotent({
      report: targetReport,
      reaction,
      reason,
      suppressionDaysForNotNow: discoverySettings.suppressionDaysForNotNow,
    });

    setResearchReports((prev) =>
      prev.map((r) => (r.id === reportId ? updatedReport : r))
    );
    setDiscoveryFeedbacks((prev) => {
      const filtered = prev.filter((f) => f.id !== feedbackRecord.id);
      return [feedbackRecord, ...filtered];
    });

    if (reaction === 'like') {
      flash('「好き」を記録しました。次回の発見の参考にします');
    } else if (reaction === 'dislike') {
      flash('「違う」を記録しました。次回からこの対象・種類を見直します');
    } else if (reaction === 'not_now') {
      flash(
        `「今は不要」を記録しました（好みの否定とは扱わず、${discoverySettings.suppressionDaysForNotNow}日間お休みします）`
      );
    }
  };

  const handleRunDiscoveryNow = async () => {
    setAiBusyLabel('しまがあなた向けのイベントや記事を探しています…');
    try {
      const localDate = computeLocalDateString(discoverySettings.timezone);
      const currentHour = new Date().getHours();
      const activeProjIds = projects.filter((p) => p.status === 'active').map((p) => p.id);
      const activeAreaIds = areas.filter((a) => a.status === 'active').map((a) => a.id);
      const effectiveSettings: DiscoverySettings = {
        ...discoverySettings,
        enabledProjectIds:
          discoverySettings.enabledProjectIds.length > 0
            ? discoverySettings.enabledProjectIds
            : activeProjIds,
        enabledAreaIds:
          (discoverySettings.enabledAreaIds || []).length > 0
            ? discoverySettings.enabledAreaIds
            : activeAreaIds,
      };
      if (
        (discoverySettings.enabledProjectIds.length === 0 && activeProjIds.length > 0) ||
        ((discoverySettings.enabledAreaIds || []).length === 0 && activeAreaIds.length > 0)
      ) {
        setDiscoverySettings(effectiveSettings);
      }

      const alreadyNotifiedDedupeKeys = researchReports
        .map((r) => r.card?.dedupeKey)
        .filter((k): k is string => Boolean(k));

      const result = await apiRunDiscoveryCycle({
        uid: 'local-user',
        localDate,
        currentHour,
        settings: effectiveSettings,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          goal: p.goal,
          status: p.status,
        })),
        areas: areas.map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status,
        })),
        confirmedSubjects,
        curatedSources,
        previousFeedbacks: discoveryFeedbacks,
        alreadyNotifiedDedupeKeys,
      });

      setResearchReports((prev) => {
        const withoutSameId = prev.filter((r) => r.id !== result.report.id);
        return [result.report, ...withoutSameId];
      });

      if (result.report.status === 'card_ready') {
        flash('公式サイトで確認できたイベントのお便りが届いたよ！');
      } else if (result.report.status === 'search_off') {
        flash('外で探すスイッチがオフのため、しつもんカードだけ届けたよ');
      } else if (result.report.status === 'question_only') {
        flash('しまからちょっとした質問が1件届いているよ');
      } else {
        flash('お便りメモを更新したよ（ぴったりな情報がない日は無理にお知らせしないよ）');
      }
    } finally {
      setAiBusyLabel(null);
    }
  };

  const handleResetAll = async () => {
    closeAllOverlays();
    clearLocalState();
    await clearFirestoreUserData();
    setItems([]);
    setBundles([]);
    setProposals([]);
    setProjects([]);
    setAreas([]);
    setProfile(getDefaultUserProfile());
    setDiscoverySettings(buildDefaultDiscoverySettings(getDefaultUserProfile(), []));
    setConfirmedSubjects(buildDefaultConfirmedSubjects([]));
    setResearchReports([]);
    setDiscoveryFeedbacks([]);
    setActiveProposalId(null);
    setActiveBundleId(null);
    setActiveItemId(null);
    setProposalStatus('none');
    setBuildingProgress(null);
    setBuildingKind('atelier');
    setBuiltBuildings([]);
    setPhase('day');
    setDay(1);
    setScreen('s1');
    setAnim('birth');
    setCharAt('default');
    setHint(true);
    setNonce((n) => n + 1);
  };

  const firebaseConnected = isFirebaseConfigured;

  return {
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
    handleSaveReflection,
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
  };
}
