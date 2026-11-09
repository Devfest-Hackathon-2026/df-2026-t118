// #40 初回体験のストーリーボード。
// 原則: 言葉より先に、島が見せる。ぽこは、見えたものに名前をつけるだけ。
// 聞くだけの画面を作らず、各画面で「島が実演する → 名前をつける → 必要な質問を1つ」を回す。
import {
  ONBOARDING_AREA_PRESETS,
  ONBOARDING_INTEREST_TO_AREA,
} from '../constants/islandConstants';
import type { PhaseKind, SavedItem } from '../models/islandModels';
import type { ConfirmedSubject } from '../models/proactiveDiscoveryModels';
import { checkHomonymNeedsDisambiguation } from './proactiveDiscoveryRules';

export type OnboardingStepId =
  | 'birth'
  | 'interests'
  | 'areas'
  | 'project'
  | 'grow'
  | 'favorite'
  | 'first';

export const ONBOARDING_STEP_IDS: OnboardingStepId[] = [
  'birth',
  'interests',
  'areas',
  'project',
  'grow',
  'favorite',
  'first',
];

export interface OnboardingCopy {
  /** 1画面1メッセージの見出し */
  heading: string;
  /** ぽこのひとこと。見えているものにだけ言及する */
  poko: string;
  /** 質問文（質問のない画面は undefined） */
  question?: string;
  /** 見出しの外に置く小さな補足 */
  note?: string;
}

// 人称は「あなた」にそろえる。連絡箱の既存コピーが「あなた」で統一されているため
export const ONBOARDING_COPY: Record<OnboardingStepId, OnboardingCopy> = {
  birth: {
    heading: 'ここが、あなたの島。',
    poko: 'ぽこだよ。まだ何もないけど、ここから育てていこう。',
  },
  interests: {
    heading: '気になったものは、ここに浮かぶ。',
    poko: 'リンクでも、スクショでも。送ってくれたら、中身はぽこが読んでおくね。',
    question: 'ふだん、どんなものを集めてる？',
  },
  areas: {
    heading: '夜のあいだに、似たものどうしが集まる。',
    poko: 'ばらばらに保存して大丈夫。やりたいこと単位でまとめておくね。',
    question: 'どのあたりを、大事にしていきたい？',
  },
  project: {
    // やることの通知ではなく、好きだったものが戻ってくる体験として書く。
    // 「1日にひとつだけ」はここで具体物の横に置く
    heading: '朝、好きだったものが戻ってくる。',
    poko: 'ぜんぶじゃなくて、ひとつだけ。見返すだけでもいいよ。',
    // 「夢中なこと」はすでに没頭している前提の言葉。選択肢はどれもこれから試すことなので合わせる
    question: 'いま、やってみたいことは？',
  },
  grow: {
    // 「ためこんでも責めない」をここで言い切る（誇るべきは保存数ではなく実行数）
    heading: 'ひとつ動くと、建物がひとつ建つ。',
    poko: '集めた数じゃなくて、動いた数で島が育つ。',
  },
  favorite: {
    heading: '好きな人を、ひとり教えて。',
    poko: 'その人を軸に、あなたがときめくものを探してくるよ。',
    note: '見つけたものは連絡箱に置いておくね。いつでも止められる。',
  },
  first: {
    heading: 'ここから、あなたの島。',
    poko: '眺めるだけの日が、あってもいい。',
  },
};

/**
 * 朝の提案の見本。
 * 本番の提案画面（S4ProposalSheet）と同じ順序にする。主役は集めたもので、
 * 一歩は小さく添えるヒント。所要時間や「タスク」の見た目を前に出すと、
 * 発見ではなく ToDo の通知になってしまう。
 */
export const ONBOARDING_PROPOSAL_SAMPLE = {
  label: 'あつめたもの',
  things: ['丸みのあるカードUI', '好きな色合わせ'],
  // 「見返すだけでいい」はぽこの言葉がすでに言っているので、ここでは繰り返さない
  hint: 'たとえば、この2つを並べてみる',
} as const;

export interface OnboardingIslandState {
  phase: PhaseKind;
  charAt: string;
  /** 島に再生させるアニメーション。'none' は静止 */
  anim: string;
  /** 島に浮かべるサンプルカードの枚数 */
  cardCount: number;
  /** リボンの束を島に置くか */
  bundle: boolean;
  /** 建物の進捗（null で建物なし） */
  building: number | null;
}

/**
 * 画面ごとに島が何を演じるか。
 * birth / addCard / settle / build は island.js にすでにある本番のアニメーションで、
 * オンボーディングはそれを順に再生して「このアプリで何ができるか」を見せる。
 */
export function islandStateForStep(step: number): OnboardingIslandState {
  const id = ONBOARDING_STEP_IDS[clampStep(step)];
  switch (id) {
    case 'birth':
      return {
        phase: 'day',
        charAt: 'default',
        anim: 'birth',
        cardCount: 0,
        bundle: false,
        building: null,
      };
    case 'interests':
      // 保存したものが島に浮かぶところを見せる
      return {
        phase: 'day',
        charAt: 'default',
        anim: 'addCard',
        cardCount: 3,
        bundle: false,
        building: null,
      };
    case 'areas':
      // 夜。浮かんでいたカードが束に集まる
      return {
        phase: 'night',
        charAt: 'default',
        anim: 'settle',
        cardCount: 3,
        bundle: true,
        building: null,
      };
    case 'project':
      // 朝。1日1提案の時間帯
      return {
        phase: 'morning',
        charAt: 'default',
        anim: 'none',
        cardCount: 0,
        bundle: true,
        building: null,
      };
    case 'grow':
      // 実行すると建物が建つ。anim:'build' がぽこを建設地まで歩かせる
      return {
        phase: 'morning',
        charAt: 'default',
        anim: 'build',
        cardCount: 0,
        bundle: true,
        building: 1,
      };
    default:
      // 連絡箱と締め。育った島を見せたまま静止させる
      return {
        phase: 'day',
        charAt: 'default',
        anim: 'none',
        cardCount: 0,
        bundle: true,
        building: 1,
      };
  }
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), ONBOARDING_STEP_IDS.length - 1);
}

/** 進捗バーの割合。島の誕生は質問ではないので 0 のまま出さない */
export function onboardingProgress(step: number): number {
  const i = clampStep(step);
  if (i === 0) return 0;
  return i / (ONBOARDING_STEP_IDS.length - 1);
}

// 島に浮かべる見本。実在の作品名は出さず、集めたものの種類だけを見せる
const SAMPLE_CARD_COLORS: Array<[string, string]> = [
  ['#f7a6d6', '#f9c6e4'],
  ['#9fdc3c', '#b8e66e'],
  ['#2f5fd8', '#5a80e2'],
];
const SAMPLE_CARD_FALLBACK_TITLES = ['気になった投稿', '保存したスクショ', 'あとで見る記事'];

/**
 * オンボーディング中だけ島に浮かべる見本のカード。
 * 保存データには入れず、表示のためだけに使う。
 * 選んだ関心をそのまま題にして、答えが島に出ることを見せる。
 */
export function buildOnboardingSampleItems(interests: string[]): SavedItem[] {
  const titles = [...interests, ...SAMPLE_CARD_FALLBACK_TITLES].slice(0, 3);
  return titles.map((title, idx) => {
    const [color, c2] = SAMPLE_CARD_COLORS[idx % SAMPLE_CARD_COLORS.length];
    return {
      id: `onboarding-sample-${idx}`,
      kind: 'SCREENSHOT',
      title,
      source: '見本',
      note: '',
      color,
      c2,
      intents: [],
      intent: title,
      intentConfirmed: true,
      para: 'Someday',
      bundleId: null,
      floating: true,
      createdAt: 0,
    };
  });
}

export interface OnboardingFavoriteInput {
  name: string;
  hint: string;
}

export type OnboardingFavoriteSubject = Pick<
  ConfirmedSubject,
  'canonicalName' | 'disambiguationHint' | 'frequency' | 'confirmationState' | 'source'
>;

/**
 * Q1（よく保存するもの）の答えから、Q2（大事にしたいこと）の初期選択を決める。
 * アンケートではなく対話にするための仕掛け。押しつけにならないよう最大2件まで。
 */
export function suggestAreasFromInterests(interests: string[]): string[] {
  const picked: string[] = [];
  for (const interest of interests) {
    const area = ONBOARDING_INTEREST_TO_AREA[interest];
    if (!area) continue;
    if (!ONBOARDING_AREA_PRESETS.includes(area)) continue;
    if (picked.includes(area)) continue;
    picked.push(area);
    if (picked.length >= 2) break;
  }
  return picked;
}

/**
 * 「好き」帳に入れる最初の1件。
 * 同名の多い名前は既存の規則どおり確認待ちにして、勝手に検索の手がかりにしない。
 */
export function buildFavoriteSubject(
  input: OnboardingFavoriteInput
): OnboardingFavoriteSubject | null {
  const name = input.name.trim();
  if (!name) return null;
  const hint = input.hint.trim();
  const needsDisambiguation = checkHomonymNeedsDisambiguation(name, hint);
  return {
    canonicalName: name,
    disambiguationHint: hint || undefined,
    frequency: needsDisambiguation ? 'unknown' : 'often',
    confirmationState: needsDisambiguation ? 'pending_disambiguation' : 'confirmed',
    source: 'manual_input',
  };
}

/**
 * 外への検索をオンにしてよいか。
 * 名前を教えてもらっていないのに同意だけ取ることはしない（探す手がかりがないため）。
 */
export function resolveSearchConsent(params: {
  favoriteName: string;
  userAcceptedSearch: boolean;
}): boolean {
  return Boolean(params.favoriteName.trim()) && params.userAcceptedSearch;
}
