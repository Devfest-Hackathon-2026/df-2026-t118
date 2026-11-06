import type { CharacterKind, ParaCategory, PhaseKind } from '../models/islandModels';

export const STORAGE_KEY = 'island-real-state-v2';

export const NAMES: Record<CharacterKind, string> = {
  poko: 'ぽこ',
  tomori: 'ともり',
  fumi: 'ふみ',
};

export const AVATAR_PARTS: Record<CharacterKind, number> = {
  poko: 8,
  tomori: 9,
  fumi: 9,
};

export const PARA_TABS: Array<[string, string, ParaCategory]> = [
  ['P', 'Projects', 'Projects'],
  ['A', 'Areas', 'Areas'],
  ['R', 'Resources', 'Resources'],
  ['Ar', 'Archives', 'Archives'],
  ['S', 'いつか', 'Someday'],
];

export const stripes = (a: string, b: string, w: number): string =>
  `repeating-linear-gradient(135deg,${a} 0 ${w}px,${b} ${w}px ${w * 2}px)`;

export function shellColors(phase: PhaseKind): { bg: string; ink: string } {
  const night = phase === 'night';
  const bg = night
    ? 'radial-gradient(ellipse 70% 25% at 20% 20%,rgba(120,140,230,.35),transparent 70%),radial-gradient(ellipse 60% 25% at 85% 60%,rgba(247,166,214,.22),transparent 70%),var(--ink-deep)'
    : phase === 'morning'
      ? 'var(--butter)'
      : 'radial-gradient(ellipse 70% 20% at 18% 16%,rgba(255,255,255,.95),transparent 70%),radial-gradient(ellipse 55% 18% at 92% 44%,rgba(255,255,255,.85),transparent 70%),radial-gradient(ellipse 80% 20% at 40% 92%,rgba(255,255,255,.85),transparent 70%),var(--sky)';
  return {
    bg,
    ink: night ? 'var(--paper)' : 'var(--ink)',
  };
}
