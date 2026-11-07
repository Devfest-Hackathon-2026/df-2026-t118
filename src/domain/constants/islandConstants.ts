import type {
  AreaEntity,
  Bundle,
  CharacterKind,
  ParaCategory,
  PhaseKind,
  ProjectEntity,
  Proposal,
  SavedItem,
  UserSurveyProfile,
} from '../models/islandModels';

export const STORAGE_KEY = 'island-real-state-v2';

export const NAMES: Record<CharacterKind, string> = {
  poko: 'ぽこ',
  tomori: 'ともり',
  fumi: 'ふみ',
};

export const AVATAR_PARTS: Record<CharacterKind, number> = {
  poko: 8,
  tomori: 9,
  fumi: 9,
};

export const PARA_TABS: Array<[string, string, ParaCategory]> = [
  ['P', 'Projects', 'Projects'],
  ['A', 'Areas', 'Areas'],
  ['R', 'Resources', 'Resources'],
  ['Ar', 'Archives', 'Archives'],
  ['S', 'いつか', 'Someday'],
];

// F01 初回アンケート（4問）の選択肢定義
export const ONBOARDING_PROJECT_GENRES: Array<{
  genre: string;
  defaultName: string;
  defaultGoal: string;
}> = [
  {
    genre: 'アプリ制作',
    defaultName: 'アプリのデモを完成させる',
    defaultGoal: '画面構成や3D島・発表スライドを仕上げる',
  },
  {
    genre: '作品・ポートフォリオ',
    defaultName: 'ポートフォリオを完成させる',
    defaultGoal: '自分の作品の見せ方とレイアウトを整える',
  },
  {
    genre: '勉強・資格',
    defaultName: '授業ノートと情報整理の仕組みを作る',
    defaultGoal: '見返しやすく集中できる学習環境を作る',
  },
  {
    genre: '就活・仕事',
    defaultName: '面接とプレゼンの準備をする',
    defaultGoal: '自分の言葉でわかりやすく伝えられるようにする',
  },
  {
    genre: '部屋づくり',
    defaultName: '自分の作業スペースを整える',
    defaultGoal: '机まわりと収納を落ち着く空間にする',
  },
];

export const ONBOARDING_AREA_PRESETS: string[] = [
  '食事・料理',
  '暮らし',
  'ファッション',
  '健康',
  '学び',
  '創作',
  '仕事',
  '趣味',
];

export const ONBOARDING_INTEREST_PRESETS: string[] = [
  '生活Tips',
  'レシピ',
  'UI/UX',
  'ツール',
  'ファッション',
  '場所',
  '作品',
  '学び',
];

export const ONBOARDING_EXPECTATION_PRESETS: string[] = [
  '整理したい',
  '今の取り組みに役立てたい',
  'いつか試したいことを思い出したい',
  '眺めて楽しみたい',
];

export const SUPPORTED_TIMEZONES: string[] = [
  'Asia/Tokyo',
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney',
];

export function getDefaultUserProfile(): UserSurveyProfile {
  let detectedTz = 'Asia/Tokyo';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) detectedTz = tz;
  } catch {
    detectedTz = 'Asia/Tokyo';
  }
  return {
    onboardingCompleted: false,
    aiConsentGranted: true,
    aiConsentAt: null,
    timezone: detectedTz,
    pendingTimezone: null,
    interests: [],
    expectations: [],
  };
}

export const stripes = (a: string, b: string, w: number): string =>
  `repeating-linear-gradient(135deg,${a} 0 ${w}px,${b} ${w}px ${w * 2}px)`;

export function shellColors(phase: PhaseKind): { bg: string; ink: string } {
  const night = phase === 'night';
  const bg = night
    ? 'radial-gradient(ellipse 70% 25% at 20% 20%,rgba(120,140,230,.35),transparent 70%),radial-gradient(ellipse 60% 25% at 85% 60%,rgba(247,166,214,.22),transparent 70%),var(--ink-deep)'
    : phase === 'morning'
      ? 'var(--butter)'
      : 'radial-gradient(ellipse 70% 20% at 18% 16%,rgba(255,255,255,.95),transparent 70%),radial-gradient(ellipse 55% 18% at 92% 44%,rgba(255,255,255,.85),transparent 70%),radial-gradient(ellipse 80% 20% at 40% 92%,rgba(255,255,255,.85),transparent 70%),var(--sky)';
  return {
    bg,
    ink: night ? 'var(--paper)' : 'var(--ink)',
  };
}

// ユースケース案（全6分野48件＋デモ3例＋PARA状況別分類）を即座に検証・体験できるマルチペルソナプリセット
export interface UseCasePersonaPreset {
  id: 'design_maker' | 'cooking_living' | 'second_brain_study' | 'fashion_hobby';
  label: string;
  badge: string;
  description: string;
  character: CharacterKind;
  projects: ProjectEntity[];
  areas: AreaEntity[];
  items: SavedItem[];
  bundles: Bundle[];
  proposal: Proposal;
}

export function buildUseCasePersonaPresets(localDate: string): UseCasePersonaPreset[] {
  const now = Date.now();
  return [
    {
      id: 'design_maker',
      label: '① デザイン・ものづくり（しまのデモ制作）',
      badge: 'デモ例① (#1〜#10)',
      description:
        'かわいいホーム画面・丸みカードUI・キャラクター画像を「しまのデモを完成させる」Projectへ結び、3Dジオラマを参考資料（Resources）として残すパターン',
      character: 'poko',
      projects: [
        {
          id: 'proj-shima-demo',
          name: '「しま」のデモを完成させる',
          goal: 'アプリ画面・3Dの島・キャラクター・発表資料を仕上げる',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 3600_000,
        },
        {
          id: 'proj-portfolio',
          name: 'ポートフォリオを完成させる',
          goal: '作品の並べ方と見せ方を改善する',
          status: 'active',
          createdAt: now - 72000_000,
          updatedAt: now - 72000_000,
        },
      ],
      areas: [
        {
          id: 'area-design',
          name: 'デザイン・創作活動',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
        {
          id: 'area-workspace',
          name: '作業環境',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
      ],
      items: [
        {
          id: 'uc-item-01',
          kind: 'INSTAGRAM',
          url: 'https://www.instagram.com/p/cute-home-ui/',
          urlFetched: false,
          rawText: 'パステル調で余白が心地よいかわいいアプリのホーム画面（#1）',
          title: 'かわいいアプリのホーム画面',
          source: 'Instagram',
          note: 'InstagramのURLとメモから「しまのデモ」向けの意図を整理したよ',
          color: '#f7a6d6',
          c2: '#f9c6e4',
          intents: [
            '「しま」のデモを完成させる に雰囲気を取り入れる',
            '色合わせを自分のデザイン案に活かす',
            'UI/UXデザインの参考資料として残す',
          ],
          intent: '「しま」のデモを完成させる に雰囲気を取り入れる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-shima-demo',
          resourceTopic: 'UI/UXデザイン',
          bundleId: 'proj-shima-demo',
          floating: false,
          createdAt: now - 14400_000,
        },
        {
          id: 'uc-item-02',
          kind: 'SCREENSHOT',
          rawText: 'Pinterestで集めた、角丸28pxのすりガラス風カードUI（#2）',
          title: '丸みのあるガラスカードUI',
          source: 'Pinterest',
          note: 'カードの角丸と余白バランスがまとまったスクショ',
          color: '#2f5fd8',
          c2: '#5a80e2',
          intents: [
            '自分のUIにカードの形と角丸を使いたい',
            'ボトムシートの余白設計に取り入れる',
            'UI/UXデザインの参考資料として残す',
          ],
          intent: '自分のUIにカードの形と角丸を使いたい',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-shima-demo',
          resourceTopic: 'UI/UXデザイン',
          bundleId: 'proj-shima-demo',
          floating: false,
          createdAt: now - 10800_000,
        },
        {
          id: 'uc-item-08',
          kind: 'PHOTO',
          rawText: 'ミニチュアの街角と柔らかい光の3Dジオラマ模型（#8）',
          title: '気になる3Dの島とジオラマ画像',
          source: 'カメラロール',
          note: 'すぐ実装はしないけれど世界観の参考として残す写真',
          color: '#9fdc3c',
          c2: '#b8e66e',
          intents: [
            '3Dの島を試作する参考にする',
            'ライティングの雰囲気を研究する',
            '3D・ジオラマ・アニメーションの参考資料として残す',
          ],
          intent: '見るだけ・参考（気になる3Dの島とジオラマ画像）',
          intentConfirmed: true,
          intentStatus: 'reference',
          para: 'Resources',
          placementKind: 'resource',
          placementId: null,
          resourceTopic: '3D・ジオラマ・アニメーション',
          bundleId: null,
          floating: true,
          createdAt: now - 3600_000,
        },
      ],
      bundles: [
        {
          id: 'proj-shima-demo',
          intent: '「しま」のデモを完成させる',
          points: [
            'パステル調の余白と角丸28pxのガラスカードで世界観を統一する',
            '3Dの島が常駐し、右ドロワーとボトムシートが重なる構成にする',
            'まずはホーム画面のカード1枚をラフに描いて試す',
          ],
          tool: 'Figma / CSS',
          itemIds: ['uc-item-01', 'uc-item-02'],
          para: 'Projects',
          targetId: 'proj-shima-demo',
          targetName: '「しま」のデモを完成させる',
          approvalStatus: 'approved',
          readyForProposal: true,
          buildingLevel: 1,
          createdAt: now - 7200_000,
          updatedAt: now - 3600_000,
        },
      ],
      proposal: {
        id: 'prop-design-1',
        bundleId: 'proj-shima-demo',
        projectId: 'proj-shima-demo',
        sourceItemIds: ['uc-item-01', 'uc-item-02'],
        localDate,
        timezoneAtCreation: 'Asia/Tokyo',
        ask: '今日は、「しま」のデモ制作に着手してみない？',
        title: 'たとえば：保存した「丸みのあるガラスカードUI」を見ながら1パーツ試す',
        detail: 'まずは集めたスクショを開いて、好きな色や角丸を見返すだけでもOKだよ。',
        minutes: 15,
        status: 'ready',
        createdAt: now - 1800_000,
      },
    },
    {
      id: 'cooking_living',
      label: '② 料理・食べもの・暮らし（おやつ＆朝食・ベランダ菜園）',
      badge: 'デモ例② (#11〜#16, #33〜#40)',
      description:
        '朝食・電子レンジおやつの投稿を「今週の朝食・おやつを試す」Projectや「食生活・日々の料理」Areaへ結び、カフェ風ドリンクをResourcesに残すパターン',
      character: 'tomori',
      projects: [
        {
          id: 'proj-weekly-breakfast',
          name: '今週の朝食・おやつメニューを試す',
          goal: 'レンジおやつと簡単トーストを週末に1品作る',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 3600_000,
        },
      ],
      areas: [
        {
          id: 'area-food-life',
          name: '食生活・日々の料理',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
        {
          id: 'area-room',
          name: '住まい・部屋の管理',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
      ],
      items: [
        {
          id: 'uc-item-11',
          kind: 'INSTAGRAM',
          url: 'https://www.instagram.com/p/easy-morning-toast/',
          urlFetched: false,
          rawText: '5分で作れるアボカドと卵の簡単朝食トーストレシピ（#11）',
          title: '簡単な朝食トーストレシピ',
          source: 'Instagram',
          note: 'いつもと違う朝食を気軽に試せるレシピ投稿',
          color: '#b9754f',
          c2: '#c98c6a',
          intents: [
            '「今週の朝食・おやつメニューを試す」で1品作ってみる',
            '普段の「食生活・日々の料理」に取り入れる',
            '料理・おやつのレシピの参考として残す',
          ],
          intent: '「今週の朝食・おやつメニューを試す」で1品作ってみる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-weekly-breakfast',
          resourceTopic: '料理・おやつのレシピ',
          bundleId: 'proj-weekly-breakfast',
          floating: false,
          createdAt: now - 14400_000,
        },
        {
          id: 'uc-item-13',
          kind: 'SCREENSHOT',
          rawText: 'マグカップと電子レンジ3分で作れる米粉ココアおやつ（#13）',
          title: '電子レンジで作れるおやつの投稿',
          source: 'カメラロール',
          note: 'オーブン不要で家にある材料で試せるおやつメモ',
          color: '#f7a6d6',
          c2: '#f9c6e4',
          intents: [
            '今日のおやつに電子レンジで1回試してみる',
            '小腹が空いたときの定番リストに入れる',
            '料理・おやつのレシピとして残しておく',
          ],
          intent: '今日のおやつに電子レンジで1回試してみる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-weekly-breakfast',
          resourceTopic: '料理・おやつのレシピ',
          bundleId: 'proj-weekly-breakfast',
          floating: false,
          createdAt: now - 7200_000,
        },
        {
          id: 'uc-item-14',
          kind: 'PHOTO',
          rawText: 'わっぱ弁当の彩りおかずと仕切りの盛りつけ写真（#14）',
          title: 'かわいいお弁当の盛りつけ写真',
          source: 'カメラロール',
          note: '日々の料理の彩りアイデアとしてAreaに紐づけ',
          color: '#9fdc3c',
          c2: '#b8e66e',
          intents: [
            '次のお弁当でミニトマトと卵の配置を真似する',
            '盛りつけや工夫を「食生活・日々の料理」に取り入れる',
            'おうちカフェ・盛りつけの参考として残す',
          ],
          intent: '盛りつけや工夫を「食生活・日々の料理」に取り入れる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Areas',
          placementKind: 'area',
          placementId: 'area-food-life',
          resourceTopic: 'おうちカフェ・盛りつけ',
          bundleId: 'area-food-life',
          floating: true,
          createdAt: now - 3600_000,
        },
      ],
      bundles: [
        {
          id: 'proj-weekly-breakfast',
          intent: '今週の朝食・おやつメニューを試す',
          points: [
            '電子レンジ3分のマグカップおやつなら洗い物も少なくすぐ試せる',
            '朝食トーストは休日の朝に卵1個から始められる',
            'まずは冷蔵庫にある材料を1分確認するだけでもOK',
          ],
          tool: '電子レンジ・マグカップ',
          itemIds: ['uc-item-11', 'uc-item-13'],
          para: 'Projects',
          targetId: 'proj-weekly-breakfast',
          targetName: '今週の朝食・おやつメニューを試す',
          approvalStatus: 'approved',
          readyForProposal: true,
          buildingLevel: 1,
          createdAt: now - 7200_000,
          updatedAt: now - 3600_000,
        },
        {
          id: 'area-food-life',
          intent: '食生活・日々の料理',
          points: ['彩りと盛りつけを無理なく楽しむ継続エリア'],
          tool: '食生活・日々の料理',
          itemIds: ['uc-item-14'],
          para: 'Areas',
          targetId: 'area-food-life',
          targetName: '食生活・日々の料理',
          approvalStatus: 'approved',
          readyForProposal: false,
          buildingLevel: 0,
          createdAt: now - 7200_000,
          updatedAt: now - 3600_000,
        },
      ],
      proposal: {
        id: 'prop-cooking-1',
        bundleId: 'proj-weekly-breakfast',
        projectId: 'proj-weekly-breakfast',
        sourceItemIds: ['uc-item-11', 'uc-item-13'],
        localDate,
        timezoneAtCreation: 'Asia/Tokyo',
        ask: 'おはよう。今日は「今週の朝食・おやつメニュー」を試してみない？',
        title: 'たとえば：保存した「簡単な朝食トーストレシピ」を開いて今日作る1品を選ぶ',
        detail: 'まずは保存した2つのレシピを見比べて、気分に合う方を選ぶだけでOKだよ。',
        minutes: 10,
        status: 'ready',
        createdAt: now - 1800_000,
      },
    },
    {
      id: 'second_brain_study',
      label: '③ ツール・学び・仕事（ObsidianでSecond Brain構築＆就活）',
      badge: 'デモ例③ (#23〜#32)',
      description:
        'Obsidianの投稿・ノート整理記事・画面スクショが「Second Brainの仕組みを作る」Projectにまとまり、最初のPARAフォルダを作る一歩につながるパターン',
      character: 'fumi',
      projects: [
        {
          id: 'proj-second-brain',
          name: 'Second Brainの仕組みを作る',
          goal: 'ObsidianでPARAフォルダを作って授業ノートとアイデアを整理する',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 3600_000,
        },
        {
          id: 'proj-interview-prep',
          name: '面接の準備をする',
          goal: '質問集をもとに自分の言葉で話せるようにする',
          status: 'active',
          createdAt: now - 72000_000,
          updatedAt: now - 72000_000,
        },
      ],
      areas: [
        {
          id: 'area-info-mgmt',
          name: '情報管理',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
        {
          id: 'area-study',
          name: '学業・学習',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
      ],
      items: [
        {
          id: 'uc-item-23',
          kind: 'ARTICLE',
          url: 'https://example.com/obsidian-second-brain-intro',
          urlFetched: true,
          rawText: 'ObsidianとPARAメソッドで始めるSecond Brainの作り方（#23）',
          title: 'Obsidianで始めるSecond Brain紹介',
          source: 'note.com',
          note: 'Projects / Areas / Resources / Archives の4フォルダ構成の解説記事',
          color: '#ad8be3',
          c2: '#bfa3ea',
          intents: [
            '「Second Brainの仕組みを作る」で最初のフォルダを作る',
            '日々の「情報管理」のやり方に取り入れる',
            '情報整理・Second Brainの参考資料として残す',
          ],
          intent: '「Second Brainの仕組みを作る」で最初のフォルダを作る',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-second-brain',
          resourceTopic: '情報整理・Second Brain',
          bundleId: 'proj-second-brain',
          floating: false,
          createdAt: now - 14400_000,
        },
        {
          id: 'uc-item-26',
          kind: 'VIDEO',
          url: 'https://www.youtube.com/watch?v=note-taking-para',
          urlFetched: false,
          rawText: '授業のメモを後から見返しやすくするデイリーノート整理術（#26）',
          title: 'ノートの整理方法の動画',
          source: 'youtube.com',
          note: '見出し3つでまとめるノートテンプレートの紹介',
          color: '#427c89',
          c2: '#5e93a0',
          intents: [
            '授業のメモを見返しやすくするテンプレートを1つ作る',
            '日々の「学業・学習」ノートに取り入れる',
            '勉強法・ノート術の資料として残す',
          ],
          intent: '授業のメモを見返しやすくするテンプレートを1つ作る',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-second-brain',
          resourceTopic: '勉強法・ノート術',
          bundleId: 'proj-second-brain',
          floating: false,
          createdAt: now - 10800_000,
        },
        {
          id: 'uc-item-32',
          kind: 'ARTICLE',
          url: 'https://example.com/education-statistics-2026',
          urlFetched: true,
          rawText: '情報系学生の学習ツール利用統計データ記事（#32）',
          title: '学習ツール利用統計データの記事',
          source: 'research.example.jp',
          note: '発表スライドの根拠として後で参照したい統計資料',
          color: '#2f5fd8',
          c2: '#5a80e2',
          intents: [
            '発表スライドのグラフに引用する',
            '自分の学習環境と比較してみる',
            '統計・調査資料の参考として残しておく',
          ],
          intent: '見るだけ・参考（学習ツール利用統計データの記事）',
          intentConfirmed: true,
          intentStatus: 'reference',
          para: 'Resources',
          placementKind: 'resource',
          placementId: null,
          resourceTopic: '統計・調査資料',
          bundleId: null,
          floating: true,
          createdAt: now - 3600_000,
        },
      ],
      bundles: [
        {
          id: 'proj-second-brain',
          intent: 'Second Brainの仕組みを作る',
          points: [
            '最初から完璧に分類せず、PARAの4フォルダだけ先に作る',
            '授業メモは1ページ3行の要約から始める',
            '週1回だけSomedayを見直して育てる',
          ],
          tool: 'Obsidian',
          itemIds: ['uc-item-23', 'uc-item-26'],
          para: 'Projects',
          targetId: 'proj-second-brain',
          targetName: 'Second Brainの仕組みを作る',
          approvalStatus: 'approved',
          readyForProposal: true,
          buildingLevel: 1,
          createdAt: now - 7200_000,
          updatedAt: now - 3600_000,
        },
      ],
      proposal: {
        id: 'prop-study-1',
        bundleId: 'proj-second-brain',
        projectId: 'proj-second-brain',
        sourceItemIds: ['uc-item-23', 'uc-item-26'],
        localDate,
        timezoneAtCreation: 'Asia/Tokyo',
        ask: '集めた「Second Brainの仕組み」、今日少し着手してみませんか？',
        title: 'たとえば：保存した「Obsidianで始めるSecond Brain紹介」を見ながらフォルダを作る',
        detail: '最初から完璧に整理しなくて大丈夫。まずは記事を開いてみるだけでも一歩です。',
        minutes: 10,
        status: 'ready',
        createdAt: now - 1800_000,
      },
    },
    {
      id: 'fashion_hobby',
      label: '④ ファッション・趣味・思い出（色合わせ見比べ＆記念撮影）',
      badge: '見比べ＆趣味 (#17〜#22, #41〜#48)',
      description:
        '撮影ポーズ集を「記念写真を撮影する」Projectへ結び、リップやコーデ投稿を「保存したもの同士を見比べる」体験として整理するパターン（口コミ収集・購入代行はしない境界線を遵守）',
      character: 'poko',
      projects: [
        {
          id: 'proj-photo-shoot',
          name: '記念写真を撮影する',
          goal: '友人とのお出かけで撮りたいポーズとコーデを決める',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 3600_000,
        },
      ],
      areas: [
        {
          id: 'area-fashion',
          name: 'ファッション・身だしなみ',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
        {
          id: 'area-memories',
          name: '人との思い出・交流',
          status: 'active',
          createdAt: now - 86400_000,
          updatedAt: now - 86400_000,
        },
      ],
      items: [
        {
          id: 'uc-item-42',
          kind: 'SCREENSHOT',
          rawText: '自然光で楽しそうに写る3人組のスマホ写真ポーズ集（#41, #42）',
          title: '将来撮りたい写真のポーズ集',
          source: 'Instagram',
          note: '来週の記念撮影で試したい構図とポーズのスクショ',
          color: '#f7a6d6',
          c2: '#f9c6e4',
          intents: [
            '「記念写真を撮影する」の当日に試すポーズ3選にする',
            '友人とのアルバム作りの参考にする',
            '写真・ポーズ・構図の参考として残す',
          ],
          intent: '「記念写真を撮影する」の当日に試すポーズ3選にする',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-photo-shoot',
          resourceTopic: '写真・ポーズ・構図',
          bundleId: 'proj-photo-shoot',
          floating: false,
          createdAt: now - 14400_000,
        },
        {
          id: 'uc-item-17',
          kind: 'PHOTO',
          rawText: 'ネイビーのカーディガンに白Tとシルバー小物を合わせたコーデ写真（#17, #18）',
          title: '好きな色合わせのコーデ写真',
          source: 'カメラロール',
          note: '手持ちの服で似た雰囲気を試せる色合わせ',
          color: '#2f5fd8',
          c2: '#5a80e2',
          intents: [
            '手持ちの服で似た色合わせを鏡の前で1回試してみる',
            '次のお出かけ前に保存したコーデ候補を見比べる',
            'ファッション・コーデの参考として残す',
          ],
          intent: '手持ちの服で似た色合わせを鏡の前で1回試してみる',
          intentConfirmed: true,
          intentStatus: 'confirmed',
          para: 'Projects',
          placementKind: 'project',
          placementId: 'proj-photo-shoot',
          resourceTopic: 'ファッション・コーデの参考',
          bundleId: 'proj-photo-shoot',
          floating: false,
          createdAt: now - 10800_000,
        },
        {
          id: 'uc-item-22',
          kind: 'SCREENSHOT',
          rawText: '透け感のあるコーラル系とローズ系のリップ色味比較スクショ（#22 境界線：見比べ体験）',
          title: '複数のリップの色味投稿',
          source: 'Instagram',
          note: '※買い物代行ではなく、保存した手元の候補同士で色味を見比べるコレクション',
          color: '#b9754f',
          c2: '#c98c6a',
          intents: [
            '手持ちのリップと色味の雰囲気を見比べる',
            '次のお出かけメイクの色合わせ参考にする',
            'ヘア・メイク・ネイルのコレクションとして残す',
          ],
          intent: '見るだけ・参考（保存した候補同士で似た色を見比べる）',
          intentConfirmed: true,
          intentStatus: 'reference',
          para: 'Resources',
          placementKind: 'resource',
          placementId: null,
          resourceTopic: 'ヘア・メイク・ネイル',
          bundleId: null,
          floating: true,
          createdAt: now - 3600_000,
        },
      ],
      bundles: [
        {
          id: 'proj-photo-shoot',
          intent: '記念写真を撮影する',
          points: [
            'ネイビー×白の色合わせは自然光の屋外写真でも映えやすい',
            '撮影当日に迷わないよう、お気に入りポーズを2つだけ選んでおく',
            'まずはクローゼットで手持ちのトップスと小物を合わせてみる',
          ],
          tool: 'カメラロール・鏡',
          itemIds: ['uc-item-42', 'uc-item-17'],
          para: 'Projects',
          targetId: 'proj-photo-shoot',
          targetName: '記念写真を撮影する',
          approvalStatus: 'approved',
          readyForProposal: true,
          buildingLevel: 1,
          createdAt: now - 7200_000,
          updatedAt: now - 3600_000,
        },
      ],
      proposal: {
        id: 'prop-fashion-1',
        bundleId: 'proj-photo-shoot',
        projectId: 'proj-photo-shoot',
        sourceItemIds: ['uc-item-42', 'uc-item-17'],
        localDate,
        timezoneAtCreation: 'Asia/Tokyo',
        ask: '今日は、「記念写真の撮影」の準備を始めてみない？',
        title: 'たとえば：保存したポーズ集とコーデ写真を並べてお気に入りを1つ選ぶ',
        detail: 'まずは保存した2枚の画像を見返すだけでも、当日のイメージがふくらむよ。',
        minutes: 10,
        status: 'ready',
        createdAt: now - 1800_000,
      },
    },
  ];
}
