import React, { useState } from 'react';
import { PARA_TABS } from '../../domain/constants/islandConstants';
import type { Bundle, ParaCategory, SavedItem } from '../../domain/models/islandModels';
import { Icon } from '../common/UiParts';

export const S8SearchSheet: React.FC<{
  activeTab: string;
  items: SavedItem[];
  bundles: Bundle[];
  onChangeTab: (tabKey: string) => void;
  onSelectBundle: (bundleId: string) => void;
  onSelectItem: (itemId: string) => void;
  onAddProject?: (name: string, goal: string) => void;
  onAddArea?: (name: string) => void;
  onRestoreItem?: (itemId: string) => void;
  onRestoreBundle?: (bundleId: string) => void;
}> = ({
  activeTab,
  items,
  bundles,
  onChangeTab,
  onSelectBundle,
  onSelectItem,
  onAddProject,
  onAddArea,
  onRestoreItem,
  onRestoreBundle,
}) => {
  const [query, setQuery] = useState<string>('');
  const [addingCluster, setAddingCluster] = useState<boolean>(false);
  const [newClusterName, setNewClusterName] = useState<string>('');
  const [newClusterGoal, setNewClusterGoal] = useState<string>('');

  const currentTabEntry = PARA_TABS.find(([k]) => k === activeTab) || PARA_TABS[0];
  const currentPara: ParaCategory = currentTabEntry[2];
  const q = query.trim().toLowerCase();

  const matchingBundles = bundles.filter((b) => {
    const inTab = q ? true : b.para === currentPara;
    if (!inTab) return false;
    if (!q) return true;
    return (
      b.intent.toLowerCase().includes(q) ||
      b.tool.toLowerCase().includes(q) ||
      b.points.some((p) => p.toLowerCase().includes(q))
    );
  });

  const matchingItems = items
    .filter((it) => {
      const inTab = q ? true : it.para === currentPara;
      if (!inTab) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        (it.intent || '').toLowerCase().includes(q) ||
        (it.resourceTopic || '').toLowerCase().includes(q) ||
        it.note.toLowerCase().includes(q) ||
        it.source.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleCreateCluster = () => {
    const trimmed = newClusterName.trim();
    if (!trimmed) return;
    if (currentPara === 'Projects' && onAddProject) {
      onAddProject(trimmed, newClusterGoal.trim());
    } else if (currentPara === 'Areas' && onAddArea) {
      onAddArea(trimmed);
    }
    setNewClusterName('');
    setNewClusterGoal('');
    setAddingCluster(false);
  };

  return (
    <>
      <span className="display display--md">Search</span>

      <div className="searchbar">
        <Icon name="search" className="icon--muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ことばや気持ちでさがす"
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            font: '400 14px var(--jp)',
            color: 'var(--ink)',
          }}
        />
        {query ? (
          <button
            className="iconbtn iconbtn--soft iconbtn--sm"
            onClick={() => setQuery('')}
            aria-label="クリア"
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>

      <div className="tabs">
        {PARA_TABS.map(([k, label, para]) => {
          const count =
            bundles.filter((b) => b.para === para).length +
            items.filter((i) => i.para === para && !i.bundleId).length;
          return (
            <button
              key={k}
              className={`chip${activeTab === k && !q ? ' chip--ink' : ' chip--soft'}`}
              onClick={() => {
                setQuery('');
                setAddingCluster(false);
                onChangeTab(k);
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {(currentPara === 'Projects' && onAddProject) ||
      (currentPara === 'Areas' && onAddArea) ? (
        <div>
          {!addingCluster ? (
            <button
              className="btn btn--ghost btn--pill btn--sm"
              onClick={() => setAddingCluster(true)}
            >
              <Icon name="add" />
              新しい {currentPara === 'Projects' ? 'Project（取り組み）' : 'Area（領域）'} を追加
            </button>
          ) : (
            <div className="card" style={{ gap: '8px' }}>
              <span className="eyebrow eyebrow--accent">
                NEW {currentPara === 'Projects' ? 'PROJECT' : 'AREA'}
              </span>
              <div className="inputpill">
                <input
                  type="text"
                  placeholder={
                    currentPara === 'Projects'
                      ? '例：アプリのデモを完成させる'
                      : '例：食事・料理'
                  }
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                />
              </div>
              {currentPara === 'Projects' ? (
                <div className="inputpill">
                  <input
                    type="text"
                    placeholder="目的・ゴール（任意）"
                    value={newClusterGoal}
                    onChange={(e) => setNewClusterGoal(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="row2">
                <button
                  className="btn btn--ghost btn--pill btn--sm"
                  onClick={() => setAddingCluster(false)}
                >
                  キャンセル
                </button>
                <button
                  className="btn btn--ink btn--pill btn--sm"
                  onClick={handleCreateCluster}
                >
                  追加する
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {matchingBundles.map((b) => {
        const countInBundle = items.filter(
          (i) => b.itemIds.includes(i.id) || i.bundleId === b.id || i.placementId === b.id
        ).length;
        return (
          <div
            key={`b-${b.id}`}
            className="hit"
            onClick={() => onSelectBundle(b.id)}
            style={{ cursor: 'pointer' }}
          >
            <Icon
              name={b.para === 'Areas' ? 'storefront' : 'construction'}
              className="icon--accent"
            />
            <div className="hit__body" style={{ flex: 1 }}>
              <span className="hit__title">
                {b.intent}
                {b.approvalStatus === 'pending' ? '（夜の束ね案・承認待ち）' : ''}
              </span>
              <span className="hit__sub">
                {b.para === 'Projects' ? 'Project' : b.para === 'Areas' ? 'Area' : b.para} ·
                保存物 {countInBundle}つ
                {b.buildingLevel > 0 ? ' · 建物完成' : ''}
              </span>
            </div>
            {b.para === 'Archives' && onRestoreBundle ? (
              <button
                className="btn btn--ghost btn--pill btn--sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestoreBundle(b.id);
                }}
              >
                復元
              </button>
            ) : (
              <Icon name="chevron_right" className="icon--muted" />
            )}
          </div>
        );
      })}

      {matchingItems.map((it) => (
        <div
          key={`i-${it.id}`}
          className="hit"
          onClick={() => onSelectItem(it.id)}
          style={{ cursor: 'pointer' }}
        >
          <Icon
            name={
              it.para === 'Projects'
                ? 'construction'
                : it.para === 'Areas'
                  ? 'storefront'
                  : it.para === 'Someday'
                    ? 'inventory_2'
                    : 'local_library'
            }
            className="icon--accent"
          />
          <div className="hit__body" style={{ flex: 1 }}>
            <span className="hit__title">{it.intent || it.title}</span>
            <span className="hit__sub">
              {it.kind} · {it.title} ({it.para})
              {it.resourceTopic ? ` · テーマ: ${it.resourceTopic}` : ''}
              {it.intentStatus === 'reference' ? ' · 参考資料' : ''}
            </span>
          </div>
          {it.para === 'Archives' && onRestoreItem ? (
            <button
              className="btn btn--ghost btn--pill btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onRestoreItem(it.id);
              }}
            >
              復元
            </button>
          ) : (
            <Icon name="chevron_right" className="icon--muted" />
          )}
        </div>
      ))}

      {matchingBundles.length === 0 && matchingItems.length === 0 ? (
        <div className="hit">
          <Icon name="local_library" className="icon--muted" />
          <div className="hit__body">
            <span className="hit__title">まだ何もないよ</span>
            <span className="hit__sub">
              島の「＋ 保存する」から気になるものを保存すると、ここに溜まっていきます
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
};
