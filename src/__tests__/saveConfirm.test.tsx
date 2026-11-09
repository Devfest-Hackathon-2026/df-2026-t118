import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProjectEntity } from '../domain/models/islandModels';
import {
  computeBubbleText,
  computeSavedReaction,
  shouldShowFetchNotice,
} from '../domain/rules/islandRules';
import { S3SaveSheet } from '../presentation/screens/S3SaveSheet';
import type { SaveDraft } from '../presentation/types/uiTypes';

const noop = () => {};

const projects: ProjectEntity[] = [
  { id: 'p1', name: 'デモを完成させる', goal: '', status: 'active', createdAt: 0, updatedAt: 0 },
];

function renderConfirm(analyzedOverrides: Partial<NonNullable<SaveDraft['analyzed']>> = {}) {
  const draft: SaveDraft = {
    url: 'https://example.com/article',
    rawText: '',
    selectedTargetId: null,
    analyzed: {
      kind: 'ARTICLE',
      title: 'ノート整理の記事',
      source: 'example.com',
      note: 'ページの本文を取得できなかったため、URLのみ記録したよ',
      color: '#fff',
      c2: '#eee',
      intents: ['試してみる', '取り入れる', '参考にする'],
      urlFetched: false,
      ...analyzedOverrides,
    },
  };
  return renderToStaticMarkup(
    <S3SaveSheet
      character="poko"
      step="confirm"
      draft={draft}
      analyzing={false}
      resolvingMode={false}
      projects={projects}
      onChangeDraft={noop}
      onUploadImage={async () => ({ imageDataUrl: '', stickerDataUrl: '', aspect: 1 })}
      onAnalyze={noop}
      onConfirmIntent={noop}
      onSaveReference={noop}
      onSaveLater={noop}
      onBackToInput={noop}
    />
  );
}

// #44: 保存後の画面で「これ、どうしたい？」を主役にする
describe('保存後の画面の並び', () => {
  const html = renderConfirm();
  const at = (text: string) => {
    const i = html.indexOf(text);
    expect(i, text).toBeGreaterThan(-1);
    return i;
  };

  it('プレビュー → 質問 → 候補 → 自分で書く → 保存先 → 決めずに保存 の順', () => {
    const order = [
      at('ノート整理の記事'),
      at('これ、どうしたい？'),
      at('試してみる'),
      at('自分で書く'),
      at('保存先を変える（任意）'),
      at('決めずに保存'),
      at('見るだけ'),
      at('あとで'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('Project/Area の紐づけは折りたたまれている', () => {
    expect(html).toMatch(/<details class="save__target">/);
    expect(html).not.toMatch(/<details class="save__target" open/);
    expect(html.indexOf('Project: デモを完成させる')).toBeGreaterThan(at('保存先を変える（任意）'));
  });

  it('「本文を取得できなかった」の案内は1回だけ', () => {
    expect((html.match(/取得できなかった|読めなかった/g) || []).length).toBe(1);
  });

  it('サーバーの note が触れていないときだけ、画面側で案内を出す（それでも1回）', () => {
    const other = renderConfirm({ note: 'URLから候補を出したよ' });
    expect((other.match(/取得できなかった|読めなかった/g) || []).length).toBe(1);
  });
});

describe('shouldShowFetchNotice', () => {
  it('取得できていれば出さない', () => {
    expect(shouldShowFetchNotice({ url: 'https://a', urlFetched: true, note: '' })).toBe(false);
  });
  it('URL がなければ出さない', () => {
    expect(shouldShowFetchNotice({ url: '', urlFetched: false, note: '' })).toBe(false);
  });
});

describe('保存した直後のキャラクターの一言', () => {
  it('前の話題より、保存への反応を先に返す', () => {
    const text = computeBubbleText({
      floatingItems: [],
      proposalStatus: 'ready',
      phase: 'day',
      savedReaction: computeSavedReaction('intent', 'ノート整理の記事'),
    });
    expect(text).toContain('ノート整理の記事');
    expect(text).not.toContain('今日の一歩');
  });

  it('保存のしかたで言い方を変え、長いタイトルは短くする', () => {
    expect(computeSavedReaction('reference', 'A')).toContain('参考');
    expect(computeSavedReaction('later', 'A')).toContain('決まったら');
    expect(computeSavedReaction('intent', 'あ'.repeat(30))).toContain('…');
  });
});
