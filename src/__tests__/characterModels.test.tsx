import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NAMES } from '../domain/constants/islandConstants';
import {
  CHARACTER_MODEL_HEIGHT,
  CHARACTER_MODEL_URLS,
  computeModelFit,
} from '../infrastructure/three/characterModels';
import { Avatar } from '../presentation/common/UiParts';
import { SettingsSheet } from '../presentation/screens/SettingsSheet';

const publicPath = (url: string) => resolve(__dirname, '../../public', url.replace(/^\//, ''));

// #43: GLB のキャラクター（モフ）
describe('computeModelFit', () => {
  // モフの GLB の実寸（幅 1.76 × 高さ 1.28 × 奥行 1.45、足元 y=0）
  const mofu = {
    min: { x: -0.8806, y: 0, z: -0.7281 },
    max: { x: 0.8803, y: 1.2848, z: 0.7197 },
  };

  it('高さを目標の高さにそろえ、足元を島の上面（y=0）に置く', () => {
    const fit = computeModelFit(mofu, CHARACTER_MODEL_HEIGHT);
    const bottom = mofu.min.y * fit.scale + fit.offset.y;
    const top = mofu.max.y * fit.scale + fit.offset.y;
    expect(bottom).toBeCloseTo(0, 6);
    expect(top).toBeCloseTo(CHARACTER_MODEL_HEIGHT, 6);
  });

  it('足元が y=0 からずれたモデルでも、埋まらず浮かない', () => {
    const shifted = { min: { ...mofu.min, y: -0.4 }, max: { ...mofu.max, y: 0.8848 } };
    const fit = computeModelFit(shifted, CHARACTER_MODEL_HEIGHT);
    expect(shifted.min.y * fit.scale + fit.offset.y).toBeCloseTo(0, 6);
  });

  it('水平方向の中心を立ち位置に合わせる', () => {
    const fit = computeModelFit(mofu, CHARACTER_MODEL_HEIGHT);
    const cx = ((mofu.min.x + mofu.max.x) / 2) * fit.scale + fit.offset.x;
    const cz = ((mofu.min.z + mofu.max.z) / 2) * fit.scale + fit.offset.z;
    expect(cx).toBeCloseTo(0, 6);
    expect(cz).toBeCloseTo(0, 6);
  });

  it('高さ 0 のモデルは受け付けない', () => {
    expect(() =>
      computeModelFit({ min: { x: 0, y: 1, z: 0 }, max: { x: 1, y: 1, z: 1 } }, 0.5)
    ).toThrow();
  });
});

describe('モフの素材', () => {
  it('GLB は 3MB 以下で配置されている', () => {
    const file = publicPath(CHARACTER_MODEL_URLS.mofu);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it('Draco のデコーダが public/draco/ にある（ADR-006）', () => {
    expect(existsSync(publicPath('/draco/draco_decoder.wasm'))).toBe(true);
    expect(existsSync(publicPath('/draco/draco_wasm_wrapper.js'))).toBe(true);
  });

  it('アイコン画像が配置されている', () => {
    expect(existsSync(publicPath('/characters/mofu.png'))).toBe(true);
  });
});

describe('モフの UI', () => {
  it('名前は「モフ」', () => {
    expect(NAMES.mofu).toBe('モフ');
  });

  it('アバターは PNG を出し、ほかのキャラクターは従来どおり', () => {
    expect(renderToStaticMarkup(<Avatar kind="mofu" size={44} />)).toContain(
      'src="/characters/mofu.png"'
    );
    expect(renderToStaticMarkup(<Avatar kind="poko" size={44} />)).not.toContain('<img');
  });

  it('設定の「住んでいるキャラクター」に4人目として出る（ぽこ・ともり・ふみも残る）', () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      <SettingsSheet
        character="poko"
        islandStyle="puffy"
        proposalStyle="sheet"
        firebaseConnected={false}
        totalItemsCount={0}
        bundlesCount={0}
        onChangeCharacter={noop}
        onChangeIslandStyle={noop}
        onChangeProposalStyle={noop}
        onResetAll={noop}
      />
    );
    for (const v of ['poko', 'tomori', 'fumi', 'mofu']) {
      expect(html).toContain(`<option value="${v}"`);
    }
    expect(html).toContain('モフ (Mofu)');
  });
});
