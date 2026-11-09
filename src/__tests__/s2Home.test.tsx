import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { S2Home } from '../presentation/screens/S2Home';

const noop = () => {};

function render(): string {
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
