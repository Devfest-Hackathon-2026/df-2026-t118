import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_INTEREST_TO_AREA,
  ONBOARDING_PROJECT_IDEAS,
} from '../domain/constants/islandConstants';
import { inferBuildingKindFromBundle } from '../domain/rules/islandRules';
import {
  ONBOARDING_COPY,
  ONBOARDING_PROPOSAL_SAMPLE,
  ONBOARDING_STEP_IDS,
  buildFavoriteSubject,
  buildOnboardingSampleItems,
  islandStateForStep,
  onboardingProgress,
  resolveSearchConsent,
  suggestAreasFromInterests,
} from '../domain/rules/onboardingRules';
import { S1Welcome } from '../presentation/screens/S1Welcome';

const noop = () => {};

// #40: 初回体験のストーリーボード
describe('ストーリーボードの進行', () => {
  it('7画面で、保存 → 整理 → 提案 → 成長 → 発見 の順に見せる', () => {
    expect(ONBOARDING_STEP_IDS).toEqual([
      'birth',
      'interests',
      'areas',
      'project',
      'grow',
      'favorite',
      'first',
    ]);
  });

  it('島の誕生では進捗を出さず、最後の画面で満ちる', () => {
    expect(onboardingProgress(0)).toBe(0);
    expect(onboardingProgress(ONBOARDING_STEP_IDS.length - 1)).toBe(1);
  });

  it('範囲外の step を渡しても端で止まる', () => {
    expect(onboardingProgress(-5)).toBe(0);
    expect(onboardingProgress(99)).toBe(1);
    expect(islandStateForStep(99).anim).toBe('none');
  });
});

// 言葉より先に、島が見せる。各画面が本番と同じアニメーションを再生する
describe('島が実演する', () => {
  it('何もない島が生まれる', () => {
    const s = islandStateForStep(0);
    expect(s.anim).toBe('birth');
    expect(s.cardCount).toBe(0);
    expect(s.bundle).toBe(false);
    expect(s.building).toBeNull();
  });

  it('保存の画面では、カードが島に浮かぶ', () => {
    const s = islandStateForStep(1);
    expect(s.anim).toBe('addCard');
    expect(s.cardCount).toBe(3);
    expect(s.bundle).toBe(false);
  });

  it('整理の画面では、夜になってカードが束に集まる', () => {
    const s = islandStateForStep(2);
    expect(s.phase).toBe('night');
    expect(s.anim).toBe('settle');
    expect(s.cardCount).toBe(3);
    expect(s.bundle).toBe(true);
  });

  it('提案の画面で朝になり、建物はまだ建っていない', () => {
    const s = islandStateForStep(3);
    expect(s.phase).toBe('morning');
    expect(s.building).toBeNull();
  });

  it('成長の画面で建物が建つ', () => {
    const s = islandStateForStep(4);
    expect(s.anim).toBe('build');
    expect(s.building).toBe(1);
  });

  it('連絡箱と締めでは、育った島を静止したまま見せる', () => {
    for (const step of [5, 6]) {
      const s = islandStateForStep(step);
      expect(s.anim).toBe('none');
      expect(s.building).toBe(1);
      expect(s.bundle).toBe(true);
    }
  });

  it('島がまだ空のあいだ、ぽこは定位置から動かさない（カメラ外に出るため）', () => {
    for (let step = 0; step < ONBOARDING_STEP_IDS.length; step += 1) {
      expect(islandStateForStep(step).charAt).toBe('default');
    }
  });
});

describe('島に浮かべる見本のカード', () => {
  it('選んだ関心がそのまま題になり、答えが島に出る', () => {
    const items = buildOnboardingSampleItems(['レシピ', 'UI/UX']);
    expect(items.slice(0, 2).map((i) => i.title)).toEqual(['レシピ', 'UI/UX']);
  });

  it('何も選んでいなくても3枚は浮かぶ', () => {
    const items = buildOnboardingSampleItems([]);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.title.length > 0)).toBe(true);
  });

  it('見本だと分かる出どころを持ち、保存物と混ざらない id になっている', () => {
    for (const item of buildOnboardingSampleItems([])) {
      expect(item.source).toBe('見本');
      expect(item.id.startsWith('onboarding-sample-')).toBe(true);
    }
  });
});

// アンケートではなく対話にするための仕掛け（concept.md: 答えで次が変わる質問だけ聞く）
describe('Q1 の答えが Q2 の初期選択を変える', () => {
  it('レシピを選ぶと「食事・料理」が先に選ばれる', () => {
    expect(suggestAreasFromInterests(['レシピ'])).toEqual(['食事・料理']);
  });

  it('選んだ順を保ち、押しつけないよう最大2件までにする', () => {
    expect(suggestAreasFromInterests(['レシピ', 'ファッション', '学び', 'ツール'])).toEqual([
      '食事・料理',
      'ファッション',
    ]);
  });

  it('同じ Area に寄る関心を重ねても重複しない', () => {
    expect(suggestAreasFromInterests(['UI/UX', '作品'])).toEqual(['創作']);
  });

  it('何も選ばなければ何も先回りしない', () => {
    expect(suggestAreasFromInterests([])).toEqual([]);
  });

  it('対応表の行き先は Area の選択肢に実在する', () => {
    expect(Object.values(ONBOARDING_INTEREST_TO_AREA).length).toBeGreaterThan(0);
    expect(suggestAreasFromInterests(['場所'])).toEqual(['趣味']);
  });
});

// A02: 外への検索の同意は、既定 OFF を崩さない
describe('外への検索の同意', () => {
  it('名前を教えていなければ、同意ボタンを押した扱いでもオンにならない', () => {
    expect(resolveSearchConsent({ favoriteName: '', userAcceptedSearch: true })).toBe(false);
    expect(resolveSearchConsent({ favoriteName: '   ', userAcceptedSearch: true })).toBe(false);
  });

  it('「いまは探さない」を選んだらオフのままになる', () => {
    expect(resolveSearchConsent({ favoriteName: '綾野かなえ', userAcceptedSearch: false })).toBe(
      false
    );
  });

  it('名前を教えたうえで本人が選んだときだけオンになる', () => {
    expect(resolveSearchConsent({ favoriteName: '綾野かなえ', userAcceptedSearch: true })).toBe(
      true
    );
  });
});

describe('「好き」帳の最初の1件', () => {
  it('名前が空なら登録しない', () => {
    expect(buildFavoriteSubject({ name: '', hint: '' })).toBeNull();
    expect(buildFavoriteSubject({ name: '  ', hint: 'メモ' })).toBeNull();
  });

  it('名前を教えてもらったら、そのまま検索の手がかりにできる', () => {
    const subject = buildFavoriteSubject({ name: ' 綾野かなえ ', hint: '' });
    expect(subject?.canonicalName).toBe('綾野かなえ');
    expect(subject?.confirmationState).toBe('confirmed');
    expect(subject?.frequency).toBe('often');
  });

  it('同名の多い名前は確認待ちにして、勝手に検索の手がかりにしない', () => {
    const subject = buildFavoriteSubject({ name: 'ハル', hint: '' });
    expect(subject?.confirmationState).toBe('pending_disambiguation');
    expect(subject?.frequency).toBe('unknown');
  });
});

// 言葉が着地しているか。見せていないものの名前を先に呼ばない
describe('画面ごとの言葉', () => {
  it('すべての画面に、見出しとぽこのひとことがある', () => {
    for (const id of ONBOARDING_STEP_IDS) {
      expect(ONBOARDING_COPY[id].heading.length).toBeGreaterThan(0);
      expect(ONBOARDING_COPY[id].poko.length).toBeGreaterThan(0);
    }
  });

  it('連絡箱は、お便りが届くところを見せる画面でだけ名前を出す', () => {
    const mentions = ONBOARDING_STEP_IDS.filter((id) => {
      const c = ONBOARDING_COPY[id];
      return `${c.heading}${c.poko}${c.note || ''}`.includes('連絡箱');
    });
    expect(mentions).toEqual(['favorite']);
  });

  it('好きな人の画面は、その人を軸にときめくものを探すと伝える', () => {
    expect(ONBOARDING_COPY.favorite.heading).toBe('好きな人を、ひとり教えて。');
    expect(ONBOARDING_COPY.favorite.poko).toBe(
      'その人を軸に、あなたがときめくものを探してくるよ。'
    );
  });

  it('止め方は、探してもらう画面の中で伝える', () => {
    expect(ONBOARDING_COPY.favorite.note).toContain('いつでも止められる');
  });

  it('1日にひとつだけであることを、提案を見せる画面で言う', () => {
    expect(ONBOARDING_COPY.project.poko).toContain('ひとつだけ');
  });

  it('朝の提案は、やることの通知ではなく好きだったものが戻る体験として書く', () => {
    expect(ONBOARDING_COPY.project.heading).toContain('好きだったもの');
    // 「やらなきゃ」と思わせない逃げ道を、ぽこの言葉の中に残す
    expect(ONBOARDING_COPY.project.poko).toContain('見返すだけ');
  });

  it('誇るのは保存数ではなく動いた数だと、建物が建つ画面で言う', () => {
    expect(ONBOARDING_COPY.grow.poko).toContain('動いた数');
  });

  it('眺めるだけでいいことを、最後に伝える', () => {
    expect(ONBOARDING_COPY.first.poko).toContain('眺めるだけ');
  });

  it('ユーザーに約束させる言葉を使わない', () => {
    const all = ONBOARDING_STEP_IDS.map((id) => {
      const c = ONBOARDING_COPY[id];
      return `${c.heading}${c.poko}${c.question || ''}${c.note || ''}`;
    }).join('\n');
    expect(all).not.toMatch(/約束します/);
    expect(all).not.toMatch(/誓/);
  });

  it('人称は「あなた」にそろえる（連絡箱の既存コピーに合わせる）', () => {
    const all = ONBOARDING_STEP_IDS.map((id) => {
      const c = ONBOARDING_COPY[id];
      return `${c.heading}${c.poko}${c.question || ''}${c.note || ''}`;
    }).join('\n');
    expect(all).not.toMatch(/きみ/);
  });

  it('根拠のない件数や、成果の保証、未実装の通知を書かない', () => {
    const all = ONBOARDING_STEP_IDS.map((id) => {
      const c = ONBOARDING_COPY[id];
      return `${c.heading}${c.poko}${c.question || ''}${c.note || ''}`;
    }).join('\n');
    expect(all).not.toMatch(/\d+\s*件の保存/);
    expect(all).not.toMatch(/習慣に/);
    expect(all).not.toMatch(/ヶ月後/);
    expect(all).not.toMatch(/通知/);
  });
});

// 達成目標ではなく、やってみたいことで並べる。
// 選択肢の言葉が建物の振り分けに直結するので、対応をここで固定する
describe('いま、やってみたいことの選択肢', () => {
  it('やり遂げる目標ではなく、試したいこととして書く', () => {
    const labels = ONBOARDING_PROJECT_IDEAS.map((i) => i.label).join('\n');
    expect(labels).not.toMatch(/完成させる|準備をする|整える|仕組みを作る/);
    expect(labels).not.toMatch(/就活|資格|仕事/);
  });

  it.each([
    ['新しいツールを試す', 'study_tower'],
    ['新しいメイクを探す', 'boutique'],
    ['あさんぽに挑戦する', 'greenhouse'],
    ['撮りたいポーズを集める', 'pavilion'],
    ['作ってみたいレシピを試す', 'kitchen_cafe'],
    ['気になるデザインを真似する', 'atelier'],
  ])('「%s」は %s が建つ', (label, expected) => {
    expect(ONBOARDING_PROJECT_IDEAS.some((i) => i.label === label)).toBe(true);
    expect(inferBuildingKindFromBundle({ intent: label, tool: '', targetName: '' })).toBe(
      expected
    );
  });

  it('6種の建物がすべて建つように選択肢が揃っている', () => {
    const kinds = ONBOARDING_PROJECT_IDEAS.map((i) =>
      inferBuildingKindFromBundle({ intent: i.label, tool: '', targetName: '' })
    );
    expect(new Set(kinds).size).toBe(6);
  });
});

// 「役立つ作業」ではなく、発見とときめきの体験にする
describe('朝の提案の見本', () => {
  const all = [
    ONBOARDING_PROPOSAL_SAMPLE.label,
    ...ONBOARDING_PROPOSAL_SAMPLE.things,
    ONBOARDING_PROPOSAL_SAMPLE.hint,
  ].join('\n');

  it('主役は集めたもので、一歩はその下に添える', () => {
    expect(ONBOARDING_PROPOSAL_SAMPLE.things.length).toBeGreaterThan(0);
    expect(ONBOARDING_PROPOSAL_SAMPLE.hint).toContain('たとえば');
  });

  it('見返すだけでいいことは、ぽこの言葉が言うので見本では繰り返さない', () => {
    expect(ONBOARDING_COPY.project.poko).toContain('見返すだけ');
    expect(ONBOARDING_PROPOSAL_SAMPLE.hint).not.toContain('見返すだけ');
  });

  it('ToDo の見た目になる言葉を使わない', () => {
    expect(all).not.toMatch(/タスク/);
    expect(all).not.toMatch(/やること/);
    expect(all).not.toMatch(/ToDo|TODO/i);
    expect(all).not.toMatch(/ONE STEP/i);
    // 所要時間を前に出すと作業の見積もりに見える
    expect(all).not.toMatch(/\d+\s*分/);
  });
});

describe('最初の画面の描画', () => {
  const html = renderToStaticMarkup(
    <S1Welcome character="poko" onStart={noop} onCompleteOnboarding={noop} />
  );

  it('島が自分のものであることを1メッセージで伝える', () => {
    expect(html).toContain('ここが、あなたの島。');
  });

  it('上部に進捗、下部にメインボタン、スキップを置いている', () => {
    expect(html).toContain('s1__progress');
    expect(html).toContain('あとで');
    expect(html).toContain('はじめる');
  });

  it('最初の画面では戻る矢印を出さない', () => {
    expect(html).toContain('s1__back--hidden');
  });

  it('最初の画面では質問しない', () => {
    expect(html).not.toContain('s1__q');
  });
});
