import React, { useState } from 'react';
import {
  buildUseCasePersonaPresets,
  SUPPORTED_TIMEZONES,
  type UseCasePersonaPreset,
} from '../../domain/constants/islandConstants';
import type {
  AreaEntity,
  BuildingKind,
  CharacterKind,
  IslandStyleKind,
  ProjectEntity,
  ProposalStyleKind,
  UserSurveyProfile,
} from '../../domain/models/islandModels';
import type {
  ConfirmedSubject,
  CuratedSource,
  DiscoverySettings,
} from '../../domain/models/proactiveDiscoveryModels';
import { BUILDING_LIBRARY_CATALOG } from '../../domain/rules/islandRules';
import { Icon } from '../common/UiParts';
import { IslandSettingsSection } from './IslandSettingsSection';

export const SettingsSheet: React.FC<{
  character: CharacterKind;
  islandStyle: IslandStyleKind;
  proposalStyle: ProposalStyleKind;
  buildingKind?: BuildingKind;
  builtBuildings?: BuildingKind[];
  profile?: UserSurveyProfile;
  projects?: ProjectEntity[];
  areas?: AreaEntity[];
  firebaseConnected: boolean;
  totalItemsCount: number;
  bundlesCount: number;
  onChangeCharacter: (c: CharacterKind) => void;
  onChangeIslandStyle: (s: IslandStyleKind) => void;
  onChangeProposalStyle: (p: ProposalStyleKind) => void;
  onSelectBuildingKind?: (kind: BuildingKind) => void;
  onSelectGrowthStage?: (buildings: BuildingKind[]) => void;
  onUpdateProfile?: (patch: Partial<UserSurveyProfile>) => void;
  onAddProject?: (name: string, goal: string) => void;
  onAddArea?: (name: string) => void;
  onLoadUseCasePreset?: (presetId: UseCasePersonaPreset['id']) => void;
  onDemoNight?: () => void;
  onDemoMorning?: () => void;
  discoverySettings?: DiscoverySettings;
  confirmedSubjects?: ConfirmedSubject[];
  curatedSources?: CuratedSource[];
  onUpdateDiscoverySettings?: (patch: Partial<DiscoverySettings>) => void;
  onOpenDiscoveryInbox?: () => void;
  onReopenOnboarding?: () => void;
  onResetAll: () => void;
}> = ({
  character,
  islandStyle,
  proposalStyle,
  buildingKind = 'atelier',
  builtBuildings = [],
  profile,
  projects = [],
  areas = [],
  firebaseConnected,
  totalItemsCount,
  bundlesCount,
  onChangeCharacter,
  onChangeIslandStyle,
  onChangeProposalStyle,
  onSelectBuildingKind,
  onSelectGrowthStage,
  onUpdateProfile,
  onAddProject,
  onAddArea,
  onLoadUseCasePreset,
  onDemoNight,
  onDemoMorning,
  discoverySettings,
  confirmedSubjects,
  curatedSources,
  onUpdateDiscoverySettings,
  onOpenDiscoveryInbox,
  onReopenOnboarding,
  onResetAll,
}) => {
  const [newProjName, setNewProjName] = useState<string>('');
  const [newAreaName, setNewAreaName] = useState<string>('');
  const personaPresets = buildUseCasePersonaPresets('2026-11-07');

  return (
    <div className="settings-sheet">
      <div className="bundle__top">
        <div>
          <span className="eyebrow eyebrow--accent">SETTINGS</span>
          <h2 className="display display--sm" style={{ marginTop: '4px' }}>
            Island Settings
          </h2>
        </div>
      </div>

      {/* F01: Project / Area の確認と追加 */}
      <div className="card" style={{ gap: '8px' }}>
        <span className="eyebrow eyebrow--muted">
          PROJECTS & AREAS · 今の取り組みと領域
        </span>
        {projects.length > 0 || areas.length > 0 ? (
          <div className="row-chips">
            {projects.map((p) => (
              <span key={p.id} className="chip chip--ink">
                Project: {p.name}
              </span>
            ))}
            {areas.map((a) => (
              <span key={a.id} className="chip chip--soft">
                Area: {a.name}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
            登録すると、保存したものが自動で振り分けられます。
          </span>
        )}

        {onAddProject ? (
          <div className="inputpill">
            <input
              type="text"
              placeholder="新しい Project 名（例：アプリのデモを完成させる）"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
            />
            <button
              className="btn btn--ghost btn--pill btn--sm"
              onClick={() => {
                if (newProjName.trim()) {
                  onAddProject(newProjName.trim(), '');
                  setNewProjName('');
                }
              }}
            >
              ＋Project
            </button>
          </div>
        ) : null}

        {onAddArea ? (
          <div className="inputpill">
            <input
              type="text"
              placeholder="新しい Area 名（例：食事・料理）"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
            />
            <button
              className="btn btn--ghost btn--pill btn--sm"
              onClick={() => {
                if (newAreaName.trim()) {
                  onAddArea(newAreaName.trim());
                  setNewAreaName('');
                }
              }}
            >
              ＋Area
            </button>
          </div>
        ) : null}
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
          <span>島の質感</span>
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
          <span>今日の一歩の見せ方</span>
          <select
            value={proposalStyle}
            onChange={(e) => onChangeProposalStyle(e.target.value as ProposalStyleKind)}
          >
            <option value="sheet">カードパネル</option>
            <option value="letter">全画面の手紙</option>
          </select>
        </label>

        {profile && onUpdateProfile ? (
          <>
            <label>
              <span>タイムゾーン</span>
              <select
                value={profile.timezone}
                onChange={(e) =>
                  onUpdateProfile({
                    timezone: e.target.value,
                    pendingTimezone: e.target.value,
                  })
                }
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Gemini に送ってもよい</span>
              <input
                type="checkbox"
                checked={profile.aiConsentGranted}
                onChange={(e) =>
                  onUpdateProfile({
                    aiConsentGranted: e.target.checked,
                    aiConsentAt: e.target.checked ? Date.now() : null,
                  })
                }
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="card">
        <span className="eyebrow eyebrow--muted">STATUS · 保存状況</span>
        <span style={{ fontSize: '13.5px' }}>
          保存したインスピレーション: <strong>{totalItemsCount} 件</strong> ／ 束・Project:{' '}
          <strong>{bundlesCount} 件</strong>
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
          ※送信がオンのときだけ、選んだ画像・テキストを Gemini に送ります。
        </span>
      </div>

      {/* お便りの設定。もともと しまの連絡箱 の中にあったが、
          連絡箱は読む場所に絞りたいのでここへ移した */}
      {discoverySettings && onUpdateDiscoverySettings ? (
        <IslandSettingsSection
          settings={discoverySettings}
          projects={projects}
          areas={areas}
          confirmedSubjects={confirmedSubjects || []}
          curatedSources={curatedSources || []}
          onUpdateSettings={onUpdateDiscoverySettings}
        />
      ) : null}

      {onOpenDiscoveryInbox ? (
        <button className="btn btn--ink btn--pill" onClick={onOpenDiscoveryInbox}>
          <Icon name="mail" />
          ぽこのお便りを開く
        </button>
      ) : null}

      {onReopenOnboarding ? (
        <button className="btn btn--ghost btn--pill" onClick={onReopenOnboarding}>
          <Icon name="tune" />
          最初の質問をやり直す
        </button>
      ) : null}

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

      {/* デモ撮影と検証のための項目。ユーザーが迷わないよう一番下にまとめ、最初は閉じておく */}
      <details className="card dev-section">
        <summary>
          <span className="eyebrow eyebrow--muted">DEV · 開発・デモ用</span>
        </summary>

        {/* ホームでは束ねる・今日の一歩を条件つきでしか出さないので（#33）、
            デモ撮影で時間を進めるための手動の入口をここに残す */}
        {onDemoNight || onDemoMorning ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="eyebrow eyebrow--accent">TIME · 時間を進める（デモ用）</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {onDemoNight ? (
                <button className="btn btn--ghost btn--pill btn--sm" onClick={onDemoNight}>
                  <Icon name="waves" />
                  夜にする（束ねる）
                </button>
              ) : null}
              {onDemoMorning ? (
                <button className="btn btn--ghost btn--pill btn--sm" onClick={onDemoMorning}>
                  <Icon name="auto_awesome" />
                  朝にする（今日の一歩）
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          同期モード:{' '}
          {firebaseConnected
            ? 'Firebase Cloud (Auth + Firestore + Storage)'
            : 'ローカルストレージ + Gemini API'}
        </span>

        {/* B1〜B6: 3D 建物ライブラリ & 島の成長ステージ切替（案1：テーマ自動決定＋複数棟成長＋いつでもプレビュー） */}
        {onSelectBuildingKind || onSelectGrowthStage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="eyebrow eyebrow--accent">
              3D BUILDING LIBRARY · 6種の建物ライブラリと島の成長
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              一歩を達成すると、束のテーマに合わせて6種類（B1〜B6）から自動で建物が決まり、島に最大4棟まで建ち並びます。ここから直接プレビューもできます。
            </span>

            {onSelectBuildingKind ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {BUILDING_LIBRARY_CATALOG.map((item) => {
                  const isSelected = buildingKind === item.kind && builtBuildings.length <= 1;
                  return (
                    <button
                      key={item.kind}
                      className={`btn ${isSelected ? 'btn--ink' : 'btn--ghost'} btn--pill`}
                      style={{
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        padding: '8px 13px',
                      }}
                      onClick={() => onSelectBuildingKind(item.kind)}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>
                        {item.code}: {item.nameJa}（{item.signText}）
                      </span>
                      <span style={{ fontSize: '11px', opacity: 0.85 }}>{item.nameEn}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {onSelectGrowthStage ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                <button
                  className="btn btn--ghost btn--pill btn--sm"
                  onClick={() => onSelectGrowthStage(['atelier'])}
                >
                  成長 Stage 1（1棟）
                </button>
                <button
                  className="btn btn--ghost btn--pill btn--sm"
                  onClick={() => onSelectGrowthStage(['atelier', 'kitchen_cafe'])}
                >
                  成長 Stage 2（2棟）
                </button>
                <button
                  className="btn btn--ghost btn--pill btn--sm"
                  onClick={() =>
                    onSelectGrowthStage(['atelier', 'kitchen_cafe', 'greenhouse'])
                  }
                >
                  成長 Stage 3（3棟）
                </button>
                <button
                  className="btn btn--ink btn--pill btn--sm"
                  onClick={() =>
                    onSelectGrowthStage([
                      'atelier',
                      'kitchen_cafe',
                      'greenhouse',
                      'study_tower',
                    ])
                  }
                >
                  成長 Stage 4（4棟・にぎやかな島）
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 複数ユースケース・ペルソナプリセット切替（DB・PARA検証用） */}
        {onLoadUseCasePreset ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="eyebrow eyebrow--accent">
              USE CASE SCENARIOS · 複数ユースケース検証（DBプリセット切替）
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              全6分野・48ユースケースから代表的な4つのユーザー像（Projects / Areas / Resources / 今日の一歩）をワンタップでDBへ読み込めます。
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {personaPresets.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn--ghost btn--pill"
                  style={{ justifyContent: 'space-between', textAlign: 'left', padding: '10px 14px' }}
                  onClick={() => onLoadUseCasePreset(preset.id)}
                >
                  <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{preset.label}</span>
                  <span className="eyebrow eyebrow--accent">{preset.badge}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </details>
    </div>
  );
};
