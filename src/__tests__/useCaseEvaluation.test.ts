import { describe, expect, it } from 'vitest';
import {
  areIntentsConflicting,
  clusterItemsBySimilarity,
  deterministicFallbackEmbedding,
} from '../../functions/src/domain/clustering';
import {
  buildContextualIntents,
  inferResourceTopic,
  runConfirmItemIntent,
  runNightOrganize,
} from '../../functions/src/application/aiUseCases';
import { buildUseCasePersonaPresets } from '../domain/constants/islandConstants';
import {
  BUILDING_LIBRARY_CATALOG,
  inferBuildingKindFromBundle,
  selectTargetBundleForToday,
} from '../domain/rules/islandRules';
import {
  clearLocalState,
  readInitialLocalState,
  saveLocalState,
} from '../infrastructure/firebase/firestoreRepository';
import type { PersistedState, SavedItem } from '../domain/models/islandModels';

describe('Multi-Angle Use Case & DB Evaluation (48 Use Cases / 6 Categories / Contextual PARA)', () => {
  it('1. Evaluates all 6 categories (48 use cases) for accurate Resource Topic & 3-angle Intent Candidates', () => {
    const representativeCases = [
      // 1. デザイン・ものづくり (#1〜#10)
      { id: 1, text: 'Instagramで見つけた、かわいいアプリのホーム画面', expectedTopic: 'UI/UXデザイン' },
      { id: 4, text: 'かわいい配色のポスター画像', expectedTopic: '配色・カラーパレット' },
      { id: 5, text: '雑誌の表紙やポスターの文字組み', expectedTopic: 'タイポグラフィ・文字組み' },
      { id: 6, text: 'やさしい雰囲気のキャラクター画像', expectedTopic: 'キャラクターデザイン' },
      { id: 8, text: '気になる3Dの島やジオラマの画像', expectedTopic: '3D・ジオラマ・アニメーション' },
      { id: 10, text: '複数の作品例やポートフォリオ', expectedTopic: 'ポートフォリオの参考' },
      // 2. 料理・食べもの (#11〜#16)
      { id: 11, text: 'Instagramで見つけた簡単な朝食レシピ', expectedTopic: '料理・おやつのレシピ' },
      { id: 14, text: 'かわいいお弁当の盛りつけ写真', expectedTopic: 'おうちカフェ・盛りつけ' },
      // 3. ファッション・美容 (#17〜#22)
      { id: 17, text: '好きな色合わせのコーデ写真', expectedTopic: 'ファッション・コーデの参考' },
      { id: 22, text: '複数のリップの投稿（似た色を見比べたい）', expectedTopic: 'ヘア・メイク・ネイル' },
      // 4. ツール・学び・仕事 (#23〜#32)
      { id: 23, text: 'ObsidianやSecond Brainの紹介投稿', expectedTopic: '情報整理・Second Brain' },
      { id: 24, text: '気になるAIツールの紹介記事', expectedTopic: '気になるアプリ・AIツール' },
      { id: 26, text: 'ノートの整理方法の動画', expectedTopic: '勉強法・ノート術' },
      { id: 28, text: '就活の面接質問集', expectedTopic: '就活・面接の参考' },
      { id: 29, text: '発表スライドの参考画像', expectedTopic: 'スライド・プレゼンデザイン' },
      { id: 30, text: 'プログラミングの小さなTips', expectedTopic: 'プログラミングTips' },
      { id: 32, text: '統計や進学データの記事', expectedTopic: '統計・調査資料' },
      // 5. 日常・暮らし (#33〜#40)
      { id: 33, text: 'かわいい机まわりの写真・自分の作業スペース', expectedTopic: '収納・インテリアのアイデア' },
      { id: 38, text: 'スマホを見すぎない工夫の投稿・寝る前の時間', expectedTopic: '生活のTips' },
      { id: 39, text: '行きたい場所の写真・週末のお出かけ', expectedTopic: '行きたい場所・イベント' },
      // 6. 趣味・創作・思い出 (#41〜#48)
      { id: 42, text: '将来撮りたい写真のポーズ集', expectedTopic: '写真・ポーズ・構図' },
      { id: 44, text: '手作りアクセサリーの画像・イラストの描き方', expectedTopic: 'イラスト・ハンドメイド' },
      { id: 45, text: '音楽プレイリストの紹介投稿・読みたい本', expectedTopic: '本・音楽・アート' },
      { id: 48, text: '筋トレやストレッチの動画', expectedTopic: '運動・ストレッチ' },
    ];

    for (const c of representativeCases) {
      const topic = inferResourceTopic(c.text);
      expect(topic).toBe(c.expectedTopic);

      const intents = buildContextualIntents(c.text.slice(0, 18), c.text, [
        { id: 'proj-1', name: '「しま」のデモを完成させる', kind: 'project' },
        { id: 'area-1', name: '食生活・日々の料理', kind: 'area' },
      ]);
      expect(intents).toHaveLength(3);
      // 3つ目の候補は常に「見るだけ・参考資料・コレクション」の逃げ道を用意していること
      expect(intents[2]).toMatch(/参考|残す|残しておく|眺める/);
      // #22 境界線検証：口コミ収集や購入代行を提案しないこと
      expect(intents.join(' ')).not.toMatch(/口コミを自動収集|購入を代行|自動で注文/);
    }
  });

  it('2. Section 9.5: Classifies the exact same saved item into Projects, Areas, or Resources depending on user context & intent', async () => {
    // 例A: かわいいアプリ画面 (#1)
    // 状況1: 「しま」のデモを完成させる Project を進めているユーザーが制作意図を選んだ場合 → Projects
    const appUiForProject = await runConfirmItemIntent({
      title: 'かわいいアプリのホーム画面',
      intent: '「しま」のデモを完成させる のホーム画面に雰囲気を取り入れる',
      targets: [
        {
          id: 'proj-shima-demo',
          name: '「しま」のデモを完成させる',
          goal: 'アプリ画面と島を仕上げる',
          kind: 'project',
        },
      ],
    });
    expect(appUiForProject.placementMatch?.confidence).toBe('clear');
    expect(appUiForProject.placementMatch?.targetKind).toBe('project');
    expect(appUiForProject.placementMatch?.targetId).toBe('proj-shima-demo');

    // 状況2: 特定の制作予定はなく、デザインが好きで参考として残す場合 → Resources (UI/UXデザイン)
    const appUiForResource = await runConfirmItemIntent({
      title: 'かわいいアプリのホーム画面',
      intent: 'UI/UXデザインの参考資料として残しておく',
      targets: [
        {
          id: 'proj-shima-demo',
          name: '「しま」のデモを完成させる',
          kind: 'project',
        },
      ],
    });
    expect(appUiForResource.placementMatch?.targetKind).toBe('resource');
    expect(appUiForResource.placementMatch?.resourceTopic).toBe('UI/UXデザイン');

    // 例B: 朝食レシピ (#11)
    const recipeTargets = [
      { id: 'proj-week-menu', name: '今週の朝食メニューを決める', kind: 'project' as const },
      { id: 'area-food', name: '食生活・日々の料理', kind: 'area' as const },
    ];
    // 状況1: 今週の朝食メニューを決める取り組みの資料 → Projects
    const recipeForProject = await runConfirmItemIntent({
      title: '簡単な朝食レシピ',
      intent: '今週の朝食メニューを決める ために週末に1品作る',
      targets: recipeTargets,
    });
    expect(recipeForProject.placementMatch?.targetKind).toBe('project');
    expect(recipeForProject.placementMatch?.targetId).toBe('proj-week-menu');

    // 状況2: 日々の食生活に取り入れたい → Areas
    const recipeForArea = await runConfirmItemIntent({
      title: '簡単な朝食レシピ',
      intent: '普段の 食生活・日々の料理 に取り入れる',
      targets: recipeTargets,
    });
    expect(recipeForArea.placementMatch?.targetKind).toBe('area');
    expect(recipeForArea.placementMatch?.targetId).toBe('area-food');

    // 状況3: すぐに使う予定はないが保存しておきたい → Resources (料理・おやつのレシピ)
    const recipeForResource = await runConfirmItemIntent({
      title: '簡単な朝食レシピ',
      intent: '料理・おやつのレシピとして残しておく',
      isReference: true,
      targets: recipeTargets,
    });
    expect(recipeForResource.placementMatch?.targetKind).toBe('resource');
    expect(recipeForResource.placementMatch?.resourceTopic).toBe('料理・おやつのレシピ');

    // 例C: Obsidianの投稿 (#23)
    const obsidianTargets = [
      { id: 'proj-sb', name: 'Second Brainの仕組みを作る', kind: 'project' as const },
      { id: 'area-info', name: '情報管理', kind: 'area' as const },
    ];
    const obsProject = await runConfirmItemIntent({
      title: 'Obsidianのノート術投稿',
      intent: 'Second Brainの仕組みを作る ために最初のフォルダを作る',
      targets: obsidianTargets,
    });
    expect(obsProject.placementMatch?.targetId).toBe('proj-sb');

    const obsArea = await runConfirmItemIntent({
      title: 'Obsidianのノート術投稿',
      intent: '日常のメモを継続的に 情報管理 する',
      targets: obsidianTargets,
    });
    expect(obsArea.placementMatch?.targetId).toBe('area-info');
  });

  it('3. Section 7: Separates items with the SAME subject when their user intents differ (e.g., visiting a cafe vs referencing its interior design)', async () => {
    const cafeVisitIntent = '次の休日にこのカフェへ実際に行ってみたい';
    const cafeDesignIntent = 'カフェの内装の配色をアプリUIデザインの参考にする';

    expect(areIntentsConflicting(cafeVisitIntent, cafeDesignIntent)).toBe(true);

    const embVisit = deterministicFallbackEmbedding(cafeVisitIntent);
    const embDesign = deterministicFallbackEmbedding(cafeDesignIntent);

    // 同じ「代官山のカフェの写真」という題材名でも、意図が「行く」と「UIデザインの参考」で異なる場合は別クラスタに分かれる
    const clusters = clusterItemsBySimilarity([
      { id: 'cafe-1', title: '代官山のカフェの写真', intent: cafeVisitIntent, embedding: embVisit },
      { id: 'cafe-2', title: '代官山のカフェの写真', intent: cafeDesignIntent, embedding: embDesign },
    ]);
    expect(clusters).toHaveLength(0);

    // 一方、同じ「Second Brainを作る」意図を持つ3件（#23 Obsidian投稿, #26 ノート整理動画, ノート画面スクショ）は自然に1つの束にまとまる
    const nightOut = await runNightOrganize({
      items: [
        {
          id: 'sb-1',
          title: 'Obsidianの紹介投稿',
          kind: 'INSTAGRAM',
          intent: 'Obsidianで自分の情報整理の仕組みを試したい',
        },
        {
          id: 'sb-2',
          title: 'Second Brainの記事',
          kind: 'ARTICLE',
          intent: 'Obsidianで自分の情報整理の仕組みを試したい',
        },
        {
          id: 'sb-3',
          title: 'ノートアプリの画面スクショ',
          kind: 'SCREENSHOT',
          intent: 'Obsidianで自分の情報整理の仕組みを試したい',
        },
      ],
      targets: [
        {
          id: 'proj-sb',
          name: 'Second Brainの仕組みを作る',
          goal: 'ObsidianでPARAフォルダを作る',
          kind: 'project',
        },
      ],
    });
    expect(nightOut.bundles).toHaveLength(1);
    expect(nightOut.bundles[0].itemIds).toHaveLength(3);
    expect(nightOut.bundles[0].targetId).toBe('proj-sb');
    expect(nightOut.bundles[0].approvalStatus).toBe('pending');
  });

  it('4. Verifies DB Persistence & Proposal Target Selection across all 4 Multi-Persona Use Case Presets', () => {
    const localStorageMap = new Map<string, string>();
    const origWindow = globalThis.window;
    const origLocalStorage = globalThis.localStorage;
    const mockStorage = {
      getItem: (k: string) => localStorageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        localStorageMap.set(k, v);
      },
      removeItem: (k: string) => {
        localStorageMap.delete(k);
      },
    } as unknown as Storage;

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mockStorage },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
    });

    try {
      const presets = buildUseCasePersonaPresets('2026-11-07');
      expect(presets).toHaveLength(4);

      for (const preset of presets) {
        const persisted: PersistedState = {
          screen: 'home',
          phase: 'morning',
          day: 2,
          character: preset.character,
          islandStyle: 'puffy',
          proposalStyle: 'sheet',
          buildingProgress: 1,
          items: preset.items,
          bundles: preset.bundles,
          proposals: [preset.proposal],
          projects: preset.projects,
          areas: preset.areas,
          profile: {
            onboardingCompleted: true,
            aiConsentGranted: true,
            aiConsentAt: Date.now(),
            timezone: 'Asia/Tokyo',
            pendingTimezone: null,
            interests: ['UI/UX', 'レシピ'],
            expectations: ['今の取り組みに役立てたい'],
          },
          activeProposalId: preset.proposal.id,
          activeBundleId: preset.bundles[0].id,
          proposalStatus: 'ready',
        };

        saveLocalState(persisted);
        const restored = readInitialLocalState();
        expect(restored).toBeDefined();
        expect(restored.projects).toHaveLength(preset.projects.length);
        expect(restored.areas).toHaveLength(preset.areas.length);
        expect(restored.items).toHaveLength(preset.items.length);

        // 見るだけ・参考（Resources）の保存物に resourceTopic が保持されていること
        const referenceItems = (restored.items || []).filter(
          (i: SavedItem) => i.intentStatus === 'reference'
        );
        for (const refItem of referenceItems) {
          expect(refItem.para).toBe('Resources');
          expect(refItem.resourceTopic).toBeTruthy();
        }

        // 今日の一歩の対象選定（F05）：Resources（見るだけ）ではなくアクティブな Project が選ばれること
        const targetBundle = selectTargetBundleForToday({
          projects: restored.projects || [],
          bundles: restored.bundles || [],
          items: restored.items || [],
        });
        expect(targetBundle).not.toBeNull();
        expect(targetBundle?.para).toBe('Projects');
        expect(targetBundle?.id).toBe(preset.projects[0].id);
      }

      clearLocalState();
      expect(Object.keys(readInitialLocalState())).toHaveLength(0);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: origWindow,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        value: origLocalStorage,
        configurable: true,
      });
    }
  });

  it('5. Evaluates 3D Building Library (B1~B6) and theme inference from bundles', () => {
    expect(BUILDING_LIBRARY_CATALOG).toHaveLength(6);
    expect(BUILDING_LIBRARY_CATALOG.map((b) => b.kind)).toEqual([
      'atelier',
      'kitchen_cafe',
      'study_tower',
      'greenhouse',
      'boutique',
      'pavilion',
    ]);

    expect(
      inferBuildingKindFromBundle({
        intent: 'かわいいUIと文字組みを取り入れてホーム画面を作る',
        tool: 'Figma',
      })
    ).toBe('atelier');

    expect(
      inferBuildingKindFromBundle({
        intent: '余った野菜と簡単朝食レシピで平日の料理を楽にする',
        tool: 'キッチン',
      })
    ).toBe('kitchen_cafe');

    expect(
      inferBuildingKindFromBundle({
        intent: 'ObsidianでSecond Brainのノート整理仕組みを試す',
        tool: 'Obsidian',
      })
    ).toBe('study_tower');

    expect(
      inferBuildingKindFromBundle({
        intent: 'ベランダでバジル栽培と机まわりの模様替えを始める',
        tool: 'プランター',
      })
    ).toBe('greenhouse');

    expect(
      inferBuildingKindFromBundle({
        intent: '手持ちの服で春コーデとセルフネイルを試す',
        tool: 'クローゼット',
      })
    ).toBe('boutique');

    expect(
      inferBuildingKindFromBundle({
        intent: '週末のお出かけ先で写真のポーズ集を試す',
        tool: 'カメラ',
      })
    ).toBe('pavilion');
  });
});
