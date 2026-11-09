import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { S2Home } from '../presentation/screens/S2Home';

const noop = () => {};

type Props = React.ComponentProps<typeof S2Home>;

function render(overrides: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    <S2Home
      character="poko"
      phase="day"
      day={1}
      floatingItems={[]}
      proposalStatus="none"
      activeProposal={null}
      activeBundle={null}
      somedayCount={0}
      hint
      aiBusyLabel={null}
      onOpenSearch={noop}
      onOpenSave={noop}
      onOpenProposal={noop}
      onOpenReflect={noop}
      onTriggerNight={noop}
      onTriggerMorning={noop}
      onOpenSort={noop}
      onOpenInbox={noop}
      onOpenSettings={noop}
      {...overrides}
    />,
  );
}

// #31: ホームの見た目の細かい不具合
describe('S2Home', () => {
  const html = render();

  it('ボタンの title に設計書の番号（F5・S8・A01 など）を出さない', () => {
    const titles = [...html.matchAll(/title="([^"]*)"/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) {
      expect(t).not.toMatch(/\b[FSAB]\d{1,2}\b/);
    }
  });

  it('操作ヒントはマウス用とタッチ用を分けて持ち、タッチ用にはスクロールの案内がない', () => {
    const touch = html.match(/<span class="hint--touch">([^<]*)<\/span>/);
    expect(html).toContain('class="hint--mouse"');
    expect(touch).not.toBeNull();
    expect(touch?.[1]).not.toContain('SCROLL');
    expect(touch?.[1]).toContain('PINCH');
  });
});

// #33: ホームに常に出すのは 一覧・検索／お便り／設定／保存 だけ
describe('S2Home のナビとドック', () => {
  const navOf = (html: string) => html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  const buttonsIn = (html: string) => (html.match(/<button/g) || []).length;

  it('何もない日は、ナビのボタンが4つだけで、束ねる・今日の一歩は出ない', () => {
    const html = render();
    const nav = navOf(html);
    expect(buttonsIn(nav)).toBe(4);
    expect(nav).toContain('一覧・検索');
    expect(nav).toContain('設定');
    expect(nav).toContain('保存する');
    expect(html).not.toMatch(/束ねる|今日の一歩を見る|まとめる/);
  });

  it('お便りのボタンは「ぽこのお便り」と表示する（キャラクターの名前に合わせる）', () => {
    expect(navOf(render())).toContain('ぽこのお便り');
    expect(navOf(render({ character: 'tomori' }))).toContain('ともりのお便り');
    expect(render()).not.toContain('連絡箱');
  });

  it('いつか箱は中身があるときだけ出る', () => {
    expect(render({ somedayCount: 0 })).not.toContain('いつか箱');
    expect(navOf(render({ somedayCount: 2 }))).toContain('いつか箱 (2)');
    expect(render({ somedayCount: 2 })).not.toContain('仕分け (');
  });

  it('まとめられるときは、ドックに［まとめる］が出る', () => {
    const html = render({ canBundle: true });
    expect(html).toContain('<span>まとめる</span>');
  });

  it('提案できるときは、ドックに［今日の一歩を見る］が出る（まとめるより優先）', () => {
    const html = render({ canBundle: true, canPropose: true });
    expect(html).toContain('<span>今日の一歩を見る</span>');
    expect(html).not.toContain('<span>まとめる</span>');
  });
});
