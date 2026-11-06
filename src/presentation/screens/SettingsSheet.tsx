import React from 'react';
import type {
  CharacterKind,
  IslandStyleKind,
  ProposalStyleKind,
} from '../../domain/models/islandModels';
import { Icon } from '../common/UiParts';

export const SettingsSheet: React.FC<{
  character: CharacterKind;
  islandStyle: IslandStyleKind;
  proposalStyle: ProposalStyleKind;
  firebaseConnected: boolean;
  totalItemsCount: number;
  bundlesCount: number;
  onChangeCharacter: (c: CharacterKind) => void;
  onChangeIslandStyle: (s: IslandStyleKind) => void;
  onChangeProposalStyle: (p: ProposalStyleKind) => void;
  onResetAll: () => void;
}> = ({
  character,
  islandStyle,
  proposalStyle,
  firebaseConnected,
  totalItemsCount,
  bundlesCount,
  onChangeCharacter,
  onChangeIslandStyle,
  onChangeProposalStyle,
  onResetAll,
}) => (
  <div className="settings-sheet">
    <div className="bundle__top">
      <div>
        <span className="eyebrow eyebrow--accent">SETTINGS · 外観とデータ</span>
        <h2 className="display display--sm" style={{ marginTop: '4px' }}>
          Island Settings
        </h2>
      </div>
    </div>

    <div className="card demo__opts">
      <label>
        <span>住んでいるキャラクター</span>
        <select
          value={character}
          onChange={(e) => onChangeCharacter(e.target.value as CharacterKind)}
        >
          <option value="poko">ぽこ (Poko)</option>
          <option value="tomori">ともり (Tomori)</option>
          <option value="fumi">ふみ (Fumi)</option>
        </select>
      </label>

      <label>
        <span>島の 3D 質感</span>
        <select
          value={islandStyle}
          onChange={(e) => onChangeIslandStyle(e.target.value as IslandStyleKind)}
        >
          <option value="puffy">ぷっくりツヤ (Puffy)</option>
          <option value="clay">クレイ (Clay)</option>
          <option value="diorama">ジオラマ (Diorama)</option>
        </select>
      </label>

      <label>
        <span>今日の一歩（提案）の見せ方</span>
        <select
          value={proposalStyle}
          onChange={(e) => onChangeProposalStyle(e.target.value as ProposalStyleKind)}
        >
          <option value="sheet">カードパネル</option>
          <option value="letter">全画面の手紙</option>
        </select>
      </label>
    </div>

    <div className="card">
      <span className="eyebrow eyebrow--muted">STATUS · 保存状況</span>
      <span style={{ fontSize: '13.5px' }}>
        保存したインスピレーション: <strong>{totalItemsCount} 件</strong> ／ 束（バンドル）:{' '}
        <strong>{bundlesCount} 件</strong>
      </span>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
        同期モード: {firebaseConnected ? 'Firebase Cloud (Auth + Firestore)' : 'ローカルストレージ + Gemini API'}
      </span>
    </div>

    <button
      className="btn btn--ghost btn--pill"
      onClick={() => {
        if (window.confirm('島のすべての保存データを初期化しますか？')) {
          onResetAll();
        }
      }}
    >
      <Icon name="restart_alt" />
      島のデータを初期化する
    </button>
  </div>
);
