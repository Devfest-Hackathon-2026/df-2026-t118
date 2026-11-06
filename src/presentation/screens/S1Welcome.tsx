import React from 'react';
import { NAMES } from '../../domain/constants/islandConstants';
import type { CharacterKind } from '../../domain/models/islandModels';
import { Avatar } from '../common/UiParts';

export const S1Welcome: React.FC<{
  character: CharacterKind;
  onStart: () => void;
}> = ({ character, onStart }) => (
  <div className="s1">
    <div className="s1__head">
      <span className="eyebrow">WELCOME</span>
      <h1 className="display display--xl">
        Hello,
        <br />
        your island.
      </h1>
      <span className="s1__sub">はじめまして。ここが、きみの島。</span>
    </div>
    <div className="s1__foot">
      <div className="glass s1__card">
        <Avatar kind={character} size={48} />
        <p className="s1__text">
          {NAMES[character]}だよ。気になったものを送ってくれたら、ここに浮かべておくね。
        </p>
      </div>
      <button className="btn btn--ink btn--pill btn--lg" onClick={onStart}>
        はじめる
      </button>
    </div>
  </div>
);
