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
}> = ({
  activeTab,
  items,
  bundles,
  onChangeTab,
  onSelectBundle,
  onSelectItem,
}) => {
  const [query, setQuery] = useState<string>('');
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

  const matchingItems = items.filter((it) => {
    const inTab = q ? true : it.para === currentPara;
    if (!inTab) return false;
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) ||
      (it.intent || '').toLowerCase().includes(q) ||
      it.note.toLowerCase().includes(q) ||
      it.source.toLowerCase().includes(q)
    );
  });

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
                onChangeTab(k);
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {matchingBundles.map((b) => (
        <div
          key={`b-${b.id}`}
          className="hit"
          onClick={() => onSelectBundle(b.id)}
          style={{ cursor: 'pointer' }}
        >
          <Icon name="construction" className="icon--accent" />
          <div className="hit__body" style={{ flex: 1 }}>
            <span className="hit__title">{b.intent}</span>
            <span className="hit__sub">
              束 ({b.para}) · 保存物 {b.itemIds.length}つ
              {b.buildingLevel > 0 ? ' · 建物完成' : ''}
            </span>
          </div>
          <Icon name="chevron_right" className="icon--muted" />
        </div>
      ))}

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
            </span>
          </div>
          <Icon name="chevron_right" className="icon--muted" />
        </div>
      ))}

      {matchingBundles.length === 0 && matchingItems.length === 0 ? (
        <div className="hit">
          <Icon name="local_library" className="icon--muted" />
          <div className="hit__body">
            <span className="hit__title">まだ何もないよ</span>
            <span className="hit__sub">
              島の「＋」から気になるものを保存すると、ここに溜まっていきます
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
};
