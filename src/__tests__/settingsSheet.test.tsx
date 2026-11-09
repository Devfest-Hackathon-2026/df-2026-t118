import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsSheet } from '../presentation/screens/SettingsSheet';

const noop = () => {};

function render(): string {
  return renderToStaticMarkup(
    <SettingsSheet
      character="poko"
      islandStyle="puffy"
      proposalStyle="sheet"
      firebaseConnected={false}
      totalItemsCount={3}
      bundlesCount={1}
      onChangeCharacter={noop}
      onChangeIslandStyle={noop}
      onChangeProposalStyle={noop}
      onSelectBuildingKind={noop}
      onSelectGrowthStage={noop}
      onLoadUseCasePreset={noop}
      onResetAll={noop}
    />,
  );
}

// #32: 開発・デモ用の項目はユーザー向けの項目と分け、一番下で最初は閉じておく
describe('SettingsSheet の開発・デモ用セクション', () => {
  const html = render();
  const devStart = html.indexOf('<details');

  it('開発・デモ用セクションは閉じた状態の <details> で、シートの最後にある', () => {
    expect(devStart).toBeGreaterThan(-1);
    expect(html.slice(devStart)).toMatch(/^<details class="card dev-section">/);
    expect(html.endsWith('</details></div>')).toBe(true);
    expect(html).toContain('開発・デモ用');
  });

  it.each(['同期モード', '複数ユースケース検証', '建物ライブラリ'])(
    '「%s」は開発・デモ用セクションの中にだけある',
    (label) => {
      expect(html.indexOf(label)).toBeGreaterThan(devStart);
    },
  );

  it('開発・デモ用の機能は削除されていない', () => {
    const dev = html.slice(devStart);
    expect(dev).toContain('成長 Stage 4');
    expect(dev).toContain('B1');
  });
});
