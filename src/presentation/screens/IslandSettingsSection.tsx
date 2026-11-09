import React from 'react';
import type { AreaEntity, ProjectEntity } from '../../domain/models/islandModels';
import type {
  ConfirmedSubject,
  CuratedSource,
  DiscoverySettings,
} from '../../domain/models/proactiveDiscoveryModels';
import { previewMinimalSearchQuery } from '../../domain/rules/proactiveDiscoveryRules';

// 「お便りの設定」。もともと しまの連絡箱 の中にあったが、
// 連絡箱は「お便り」と「好き」帳を読む場所に絞りたいので、設定シートへ移した。
export const IslandSettingsSection: React.FC<{
  settings: DiscoverySettings;
  projects: ProjectEntity[];
  areas: AreaEntity[];
  confirmedSubjects: ConfirmedSubject[];
  curatedSources: CuratedSource[];
  onUpdateSettings: (patch: Partial<DiscoverySettings>) => void;
}> = ({ settings, projects, areas, confirmedSubjects, curatedSources, onUpdateSettings }) => {
  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeAreas = areas.filter((a) => a.status === 'active');
  const enabledAreaIds = settings.enabledAreaIds || [];
  const budgetLimitUsd = settings.budgetLimitUsd ?? 3.0;
  const estimatedUsedUsd = settings.estimatedUsedUsd ?? 0.04;

  const queryPreview = previewMinimalSearchQuery({
    settings,
    projects,
    areas,
    confirmedSubjects,
  });

  const handleToggleProject = (projectId: string) => {
    const exists = settings.enabledProjectIds.includes(projectId);
    const next = exists
      ? settings.enabledProjectIds.filter((id) => id !== projectId)
      : [...settings.enabledProjectIds, projectId];
    onUpdateSettings({ enabledProjectIds: next });
  };

  const handleToggleArea = (areaId: string) => {
    const exists = enabledAreaIds.includes(areaId);
    const next = exists
      ? enabledAreaIds.filter((id) => id !== areaId)
      : [...enabledAreaIds, areaId];
    onUpdateSettings({ enabledAreaIds: next });
  };

  return (
    <div className="card demo__opts" style={{ gap: '10px' }}>
      <span className="eyebrow eyebrow--muted">
        LETTERS · お便りの設定
      </span>

      <label>
        <span>① AI に保存物を読んでもらう</span>
        <input
          type="checkbox"
          checked={settings.aiConsentGranted}
          onChange={(e) =>
            onUpdateSettings({
              aiConsentGranted: e.target.checked,
              aiConsentAt: e.target.checked ? Date.now() : null,
            })
          }
        />
      </label>

      <label>
        <span>② 好きな人の公演や記事を探す</span>
        <input
          type="checkbox"
          checked={settings.searchConsentGranted}
          onChange={(e) =>
            onUpdateSettings({
              searchConsentGranted: e.target.checked,
              searchConsentAt: e.target.checked ? Date.now() : null,
            })
          }
        />
      </label>

      <label>
        <span>③ お便りが届いたら通知する</span>
        <input
          type="checkbox"
          checked={settings.notificationEnabled}
          onChange={(e) =>
            onUpdateSettings({
              notificationEnabled: e.target.checked,
              notificationConsentAt: e.target.checked ? Date.now() : null,
            })
          }
        />
      </label>

      <label>
        <span>しばらくお休みする</span>
        <input
          type="checkbox"
          checked={settings.paused}
          onChange={(e) => onUpdateSettings({ paused: e.target.checked })}
        />
      </label>

      {/* Project と Area の両方をワンタップで対象に選べる */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
          探してほしいテーマ
        </span>
        {activeProjects.length > 0 || activeAreas.length > 0 ? (
          <div className="row-chips">
            {activeProjects.map((proj) => {
              const enabled = settings.enabledProjectIds.includes(proj.id);
              return (
                <button
                  key={proj.id}
                  type="button"
                  className={`chip ${enabled ? 'chip--ink' : 'chip--soft'}`}
                  onClick={() => handleToggleProject(proj.id)}
                >
                  {enabled ? '✓ 探す (Project): ' : 'お休み (Project): '}
                  {proj.name}
                </button>
              );
            })}
            {activeAreas.map((area) => {
              const enabled = enabledAreaIds.includes(area.id);
              return (
                <button
                  key={area.id}
                  type="button"
                  className={`chip ${enabled ? 'chip--ink' : 'chip--soft'}`}
                  onClick={() => handleToggleArea(area.id)}
                >
                  {enabled ? '✓ 探す (Area): ' : 'お休み (Area): '}
                  {area.name}
                </button>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            まだ Project や Area が登録されていません。
          </span>
        )}
      </div>

      {/* 月の検索予算上限（デフォルト $3.00 / 約450円） */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.75)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
            月の検索コスト上限
          </span>
          <span className="chip chip--ink" style={{ fontSize: '11px' }}>
            上限 ${budgetLimitUsd.toFixed(2)} / 月（現在 約${estimatedUsedUsd.toFixed(2)}）
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[1.0, 3.0, 5.0].map((val) => (
            <button
              key={val}
              type="button"
              className={`btn btn--pill btn--sm ${
                Math.abs(budgetLimitUsd - val) < 0.01 ? 'btn--ink' : 'btn--ghost'
              }`}
              onClick={() => onUpdateSettings({ budgetLimitUsd: val })}
            >
              ${val.toFixed(0)}（約{Math.round(val * 150)}円）{val === 3.0 ? '・おすすめ' : ''}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          ※上限に達すると自動で止まります。
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            行きやすい地域（任意）
          </span>
          <input
            type="text"
            value={settings.regionPreference}
            placeholder="例：東京・関東 / 京都・関西"
            onChange={(e) => onUpdateSettings({ regionPreference: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: '12.5px',
              marginTop: '4px',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>気になる時期（任意）</span>
          <input
            type="text"
            value={settings.periodPreference}
            placeholder="例：2026年11月〜12月"
            onChange={(e) => onUpdateSettings({ periodPreference: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: '12.5px',
              marginTop: '4px',
            }}
          />
        </div>
      </div>

      {/* 検索ワードの事前確認 */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '14px',
          background: 'rgba(243, 244, 246, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700 }}>
            送る検索ワード（これだけを送ります）
          </span>
          <span className="eyebrow eyebrow--accent">{queryPreview.statusNote}</span>
        </div>
        <code style={{ fontSize: '12.5px', color: 'var(--ink)', wordBreak: 'break-all' }}>
          {queryPreview.previewQuery}
        </code>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          ※写真・メモ・住所は含みません。
        </span>
      </div>

      {/* 参考にしている情報元 */}
      <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <strong>チェックする情報元:</strong>
        {curatedSources.map((src) => (
          <div key={src.id}>
            ・{src.name}（
            {src.curatorType === 'artist_official' ? '公式サイトを最優先' : '編集部の連載記事'}）
          </div>
        ))}
      </div>
    </div>
  );
};
