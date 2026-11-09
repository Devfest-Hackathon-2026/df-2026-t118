import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Proposal } from '../domain/models/islandModels';
import { computeBubbleText, stripExampleLead } from '../domain/rules/islandRules';
import { S2Home } from '../presentation/screens/S2Home';
import { S6ReflectSheet } from '../presentation/screens/S6ReflectSheet';

const noop = () => {};

const proposal: Proposal = {
  id: 'p1',
  bundleId: 'b1',
  ask: '',
  title: 'たとえば：保存した記事を見ながらフォルダを作る',
  detail: '',
  minutes: 10,
  status: 'doing',
  createdAt: 0,
};

type HomeProps = React.ComponentProps<typeof S2Home>;
function renderHome(overrides: Partial<HomeProps>) {
  return renderToStaticMarkup(
    <S2Home
      character="poko"
      phase="day"
      day={1}
      floatingItems={[]}
      proposalStatus="doing"
      activeProposal={proposal}
      activeBundle={null}
      somedayCount={0}
      hint={false}
      aiBusyLabel={null}
      onOpenSearch={noop}
      onOpenSave={noop}
      onOpenProposal={noop}
      onOpenReflect={noop}
      onDone={noop}
      onMada={noop}
      onOpenReflection={noop}
      onTriggerNight={noop}
      onTriggerMorning={noop}
      onOpenSort={noop}
      onOpenSettings={noop}
      {...overrides}
    />
  );
}

// #45: 「やってみる」から「できた」までを短くする
describe('実行中のドック', () => {
  const html = renderHome({});

  it('吹き出しの横に［まだ］［できた］を直接出す', () => {
    expect(html).toContain('>まだ</button>');
    expect(html).toContain('<span>できた</span>');
    expect(html).not.toContain('できた？');
  });

  it('もういい・ひとことへは「ほかの答え」から行ける', () => {
    expect(html).toContain('ほかの答え');
  });

  it('吹き出しの所要時間は提案の minutes とそろう（S4 の「目安◯分」と同じ値）', () => {
    expect(html).toContain('いってらっしゃい。10分だけでいいよ。');
    expect((html.match(/いってらっしゃい/g) || []).length).toBe(1);
  });
});

describe('建ったあとのドック', () => {
  it('ひとこと・写真がまだなら［ひとこと残す］を出す', () => {
    const html = renderHome({ proposalStatus: 'done', activeProposal: { ...proposal, status: 'done' } });
    expect(html).toContain('ひとこと残す');
  });

  it('もう残していれば出さない', () => {
    const html = renderHome({
      proposalStatus: 'done',
      activeProposal: { ...proposal, status: 'done', reflectWord: '楽しかった' },
    });
    expect(html).not.toContain('ひとこと残す');
  });
});

describe('computeBubbleText の所要時間', () => {
  it('minutes がなければ数字を出さない', () => {
    const t = computeBubbleText({ floatingItems: [], proposalStatus: 'doing', phase: 'day' });
    expect(t).not.toMatch(/\d+分/);
  });
});

describe('S6（できた？のシート）', () => {
  const render = (afterDone: boolean) =>
    renderToStaticMarkup(
      <S6ReflectSheet
        character="poko"
        proposal={proposal}
        onUploadImage={async () => ({ imageDataUrl: '', stickerDataUrl: '' })}
        onFinishDone={noop}
        onFinishMada={noop}
        onFinishRelease={noop}
        afterDone={afterDone}
        onSaveReflection={noop}
      />
    );

  it('「たとえば：」を出さない', () => {
    const html = render(false);
    expect(html).not.toContain('たとえば');
    expect(html).toContain('保存した記事を見ながらフォルダを作る');
  });

  it('「もういい」のアイコンは waves 以外', () => {
    const html = render(false);
    expect(html).not.toContain('>waves<');
    expect(html).toContain('もういい');
  });

  it('建ったあとは、選択肢を出さずに「ひとこと・写真を残す」だけにする', () => {
    const html = render(true);
    expect(html).not.toContain('もういい');
    expect(html).toContain('残す');
    expect(html).not.toContain('建物を建てる');
  });

  it('stripExampleLead は前置きだけを外す', () => {
    expect(stripExampleLead('たとえば：A')).toBe('A');
    expect(stripExampleLead('たとえば: B')).toBe('B');
    expect(stripExampleLead('Cをたとえば：')).toBe('Cをたとえば：');
  });
});
