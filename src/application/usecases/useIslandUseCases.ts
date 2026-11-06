import { useEffect, useRef, useState } from 'react';
import { NAMES } from '../../domain/constants/islandConstants';
import type {
  Bundle,
  CharacterKind,
  IslandStyleKind,
  ParaCategory,
  PersistedState,
  PhaseKind,
  Proposal,
  ProposalStatus,
  ProposalStyleKind,
  SavedItem,
} from '../../domain/models/islandModels';
import { selectItemsForNightOrganize } from '../../domain/rules/islandRules';
import {
  apiAnalyzeItem,
  apiConfirmIntent,
  apiMorningPropose,
  apiNightOrganize,
} from '../../infrastructure/ai/aiFlowClient';
import { isFirebaseConfigured } from '../../infrastructure/firebase/firebaseClient';
import {
  clearFirestoreUserData,
  clearLocalState,
  loadFromFirestore,
  readInitialLocalState,
  saveLocalState,
  syncToFirestore,
} from '../../infrastructure/firebase/firestoreRepository';
import { uploadItemImageIfConfigured } from '../../infrastructure/firebase/storageClient';
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
      (initial.bundles && initial.bundles.length > 0)
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
  const [nonce, setNonce] = useState<number>(0);
  const [buildingProgress, setBuildingProgress] = useState<number | null>(
    initial.buildingProgress !== undefined ? initial.buildingProgress : null
  );
  const [character, setCharacter] = useState<CharacterKind>(initial.character || 'poko');
  const [islandStyle, setIslandStyle] = useState<IslandStyleKind>(
    initial.islandStyle || 'puffy'
  );
  const [proposalStyle, setProposalStyle] = useState<ProposalStyleKind>(
    initial.proposalStyle || 'sheet'
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
  const [bundleFromProposal, setBundleFromProposal] = useState<boolean>(false);

  const toastTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef<boolean>(false);

  const flash = (msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3000);
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

  // 初回マウント時に Firestore から最新状態を復元
  useEffect(() => {
    loadFromFirestore().then((remote) => {
      if (remote && (remote.items.length > 0 || remote.bundles.length > 0)) {
        setItems(remote.items);
        setBundles(remote.bundles);
        setProposals(remote.proposals);
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
      items,
      bundles,
      proposals,
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
          activeProposalId,
          activeBundleId,
          proposalStatus,
        },
        items,
        bundles,
        proposals,
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
    items,
    bundles,
    proposals,
    activeProposalId,
    activeBundleId,
    proposalStatus,
  ]);

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

  // ---------- F1〜F3: 保存と意図の 1 文化 ----------

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
      const result = await apiAnalyzeItem({
        url: draft.url.trim() || undefined,
        rawText: draft.rawText.trim() || undefined,
        imageDataUrl: draft.imageDataUrl,
        fileName: draft.fileName,
      });

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

  const commitSaveItem = async (intentText: string | null, isUnknown: boolean) => {
    const analyzed = draft.analyzed || {
      kind: 'NOTE' as const,
      title: draft.rawText || draft.url || '気になったアイデア',
      source: 'メモ',
      note: 'メモから読み取ったよ',
      color: '#f7a6d6',
      c2: '#f9c6e4',
      intents: ['試してみる', '調べてみる', '参考にする'],
    };

    if (resolvingItemId) {
      const targetId = resolvingItemId;
      closeSheet(async () => {
        let emb: number[] = [];
        if (intentText && !isUnknown) {
          const res = await apiConfirmIntent({
            title: analyzed.title,
            intent: intentText,
            note: analyzed.note,
          });
          emb = res.embedding;
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === targetId
              ? {
                  ...it,
                  intent: isUnknown ? null : intentText,
                  intentConfirmed: !isUnknown,
                  embedding: emb.length ? emb : it.embedding,
                }
              : it
          )
        );
        setNonce((n) => n + 1);
        flash(isUnknown ? '「？」のまま浮かべておくね' : '意図を決めたよ！');
      });
      return;
    }

    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    closeSheet(async () => {
      let emb: number[] = [];
      if (intentText && !isUnknown) {
        const res = await apiConfirmIntent({
          title: analyzed.title,
          intent: intentText,
          note: analyzed.note,
        });
        emb = res.embedding;
      }

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
        intent: isUnknown ? null : intentText,
        intentConfirmed: !isUnknown,
        para: 'Someday',
        bundleId: null,
        floating: true,
        embedding: emb,
        createdAt: Date.now(),
      };

      setItems((prev) => [...prev, newItem]);
      setAnim('addCard');
      setHint(false);
      setNonce((n) => n + 1);
      flash(isUnknown ? 'あとで決めよう。「？」で浮かべておくね' : '島に浮かべたよ');
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
        analyzed: {
          kind: item.kind,
          title: item.title,
          source: item.source,
          note: item.note,
          color: item.color,
          c2: item.c2,
          intents: item.intents,
        },
      });
      setSaveStep('confirm');
      openSheet('save');
    } else {
      setActiveItemId(item.id);
      openSheet('item');
    }
  };

  // ---------- F5: 夜の整理（束ねる） ----------

  const handleGoNight = async () => {
    const targetItems = selectItemsForNightOrganize(items);
    const confirmedAll = items.filter((i) => i.intentConfirmed && i.para !== 'Archives');

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
    setAiBusyLabel('夜の整理中… Gemini が似た保存物を束ねています');
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
                floating: false,
              };
            })
          );
          setAnim('none');
          setNonce((n) => n + 1);
        }, 3600);

        flash(`${createdBundles[0].itemIds.length}つの保存物を1つの束にまとめたよ`);
      }
    } finally {
      setAiBusyLabel(null);
    }
  };

  // ---------- F6: 朝の 1 日 1 提案 ----------

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
    if (proposalStatus === 'ready' && activeProposalId) {
      handleOpenProposal();
      return;
    }

    let targetBundle =
      bundles.find((b) => b.id === activeBundleId && b.para !== 'Archives') ||
      bundles.find((b) => b.readyForProposal && b.para !== 'Archives') ||
      bundles.find((b) => b.para !== 'Archives');

    if (!targetBundle) {
      const confirmed = items.filter((i) => i.intentConfirmed && i.para !== 'Archives');
      if (confirmed.length < 2) {
        flash('2つ以上保存して束ができると、今日の一歩を提案できるよ');
        handleOpenSave();
        return;
      }

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

    if (!targetBundle) {
      setAiBusyLabel(null);
      return;
    }

    closeAllOverlays();
    setScreen('home');
    const bundleItems = items.filter((it) => targetBundle!.itemIds.includes(it.id));
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
        id: `prop-${Date.now()}`,
        bundleId: targetBundle.id,
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
      flash('いってらっしゃい！終わったら「できた？」から教えてね');
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

  const handleReleaseActive = () => {
    closeSheet(() => {
      setProposalStatus('released');
      if (activeBundleId) {
        setBundles((prev) =>
          prev.map((b) =>
            b.id === activeBundleId ? { ...b, para: 'Archives', readyForProposal: false } : b
          )
        );
        setItems((prev) =>
          prev.map((it) =>
            it.bundleId === activeBundleId ? { ...it, para: 'Archives', floating: false } : it
          )
        );
      }
      setNonce((n) => n + 1);
    });
  };

  // ---------- F8: 振り返りと建物の建設 ----------

  const handleBuildSuccess = (word?: string | null, photoDataUrl?: string | null) => {
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
    if (activeBundleId) {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === activeBundleId ? { ...b, buildingLevel: b.buildingLevel + 1 } : b
        )
      );
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
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, para: nextPara } : it)));
  };

  // ---------- データ編集・リセット ----------

  const handleUpdateItemIntent = async (itemId: string, nextIntent: string) => {
    const target = items.find((i) => i.id === itemId);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, intent: nextIntent, intentConfirmed: true } : it
      )
    );
    flash('意図を更新したよ');
    if (target) {
      const embRes = await apiConfirmIntent({
        title: target.title,
        intent: nextIntent,
        note: target.note,
      });
      if (embRes.embedding.length) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, embedding: embRes.embedding } : it))
        );
      }
    }
  };

  const handleChangeItemPara = (itemId: string, nextPara: ParaCategory) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, para: nextPara, floating: nextPara === 'Archives' ? false : it.floating }
          : it
      )
    );
    flash(`${nextPara} に移動したよ`);
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
    closeSheet(() => {
      setBundles((prev) =>
        prev.map((b) =>
          b.id === bundleId ? { ...b, para: 'Archives', readyForProposal: false } : b
        )
      );
      setItems((prev) =>
        prev.map((it) =>
          it.bundleId === bundleId ? { ...it, para: 'Archives', floating: false } : it
        )
      );
      if (activeBundleId === bundleId) {
        setProposalStatus('released');
      }
      setNonce((n) => n + 1);
      flash('束を手放して Archives に移したよ');
    });
  };

  const handleResetAll = async () => {
    clearLocalState();
    await clearFirestoreUserData();
    closeAllOverlays();
    setScreen('s1');
    setPhase('day');
    setDay(1);
    setAnim('birth');
    setCharAt('default');
    setBuildingProgress(null);
    setItems([]);
    setBundles([]);
    setProposals([]);
    setActiveProposalId(null);
    setActiveBundleId(null);
    setActiveItemId(null);
    setProposalStatus('none');
    setHint(true);
    setNonce((n) => n + 1);
  };

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
    character,
    setCharacter,
    islandStyle,
    setIslandStyle,
    proposalStyle,
    setProposalStyle,
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
    bundleFromProposal,
    setBundleFromProposal,
    firebaseConnected: isFirebaseConfigured,
    flash,
    openSheet,
    closeSheet,
    handleOpenSave,
    handleProcessImageFile,
    handleAnalyzeDraft,
    commitSaveItem,
    handleCardTap,
    handleGoNight,
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
    handleUpdateBundleIntent,
    handleReleaseBundle,
    handleResetAll,
  };
}
