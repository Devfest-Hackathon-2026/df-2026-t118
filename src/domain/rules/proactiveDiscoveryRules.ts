import type { AreaEntity, ProjectEntity, UserSurveyProfile } from '../models/islandModels';
import type {
  ConfirmedSubject,
  CuratedSource,
  DiscoverySettings,
  ProfileFact,
} from '../models/proactiveDiscoveryModels';

const AMBIGUOUS_HOMONYM_NAMES = new Set([
  '蓮',
  'ren',
  'ハル',
  'haru',
  'ケイ',
  'kei',
  'アオイ',
  'aoi',
  'タカシ',
]);

export function buildDefaultDiscoverySettings(
  profile?: UserSurveyProfile,
  projects: ProjectEntity[] = [],
  areas: AreaEntity[] = []
): DiscoverySettings {
  const activeProjIds = projects.filter((p) => p.status === 'active').map((p) => p.id);
  const activeAreaIds = areas.filter((a) => a.status === 'active').map((a) => a.id);
  return {
    aiConsentGranted: profile?.aiConsentGranted ?? true,
    aiConsentAt: profile?.aiConsentAt ?? null,
    aiConsentVersion: 'v1',
    // A02: 外部検索同意のデフォルトは必ず OFF
    searchConsentGranted: false,
    searchConsentAt: null,
    searchConsentVersion: 'v1',
    // A04: 端末通知同意のデフォルトは必ず OFF
    notificationEnabled: false,
    notificationConsentAt: null,
    enabledProjectIds: activeProjIds,
    enabledAreaIds: activeAreaIds,
    budgetLimitUsd: 3.0,
    estimatedUsedUsd: 0.04,
    regionPreference: '東京・関東',
    periodPreference: '2026年11月〜12月',
    timezone: profile?.timezone || 'Asia/Tokyo',
    quietHoursStart: 22,
    quietHoursEnd: 8,
    dailyReportLimit: 1,
    questionCooldownDays: 3,
    suppressionDaysForNotNow: 14,
    paused: false,
    updatedAt: Date.now(),
  };
}

export function buildDefaultCuratedSources(): CuratedSource[] {
  return [
    {
      id: 'src_artist_official',
      name: '本人確認済みアーティスト・作家の公式サイト（一次情報）',
      url: 'https://ichikoaoba.com/',
      curatorType: 'artist_official',
      selectedBy: 'user',
      termsVerified: true,
      allowDisplay: true,
      allowStorage: true,
      allowAiProcessing: true,
    },
    {
      id: 'src_editor_magazine',
      name: 'POPEYE Web / Casa BRUTUS 等の編集者キュレーション連載',
      url: 'https://popeyemagazine.jp/',
      curatorType: 'editor_magazine',
      selectedBy: 'operator',
      termsVerified: true,
      allowDisplay: true,
      allowStorage: false,
      allowAiProcessing: true,
    },
  ];
}

export function buildDefaultConfirmedSubjects(
  projects: ProjectEntity[] = []
): ConfirmedSubject[] {
  const firstProjId = projects.find((p) => p.status === 'active')?.id || null;
  return [
    {
      id: 'subj_ichiko_aoba',
      canonicalName: '青葉市子',
      category: 'artist',
      disambiguationHint: 'クラシックギター・シンガーソングライター（Windswept Adan）',
      officialUrl: 'https://ichikoaoba.com/',
      workExample: 'アダンの風 / Luminescent Creatures',
      frequency: 'often',
      confirmationState: 'confirmed',
      source: 'manual_input',
      projectId: firstProjId,
      updatedAt: Date.now(),
    },
  ];
}

export function buildDefaultProfileFacts(
  subjects: ConfirmedSubject[],
  settings: DiscoverySettings
): ProfileFact[] {
  const facts: ProfileFact[] = subjects
    .filter((s) => s.confirmationState !== 'deleted')
    .map((s) => ({
      id: `fact_${s.id}`,
      kind: 'artist' as const,
      value: `${s.canonicalName}${s.disambiguationHint ? `（${s.disambiguationHint}）` : ''}`,
      source:
        s.source === 'manual_input' && s.confirmationState === 'confirmed'
          ? ('user_confirmed' as const)
          : ('ai_hypothesis' as const),
      status:
        s.confirmationState === 'confirmed'
          ? ('confirmed' as const)
          : s.confirmationState === 'rejected'
            ? ('rejected' as const)
            : ('unconfirmed' as const),
      projectId: s.projectId,
      updatedAt: s.updatedAt,
    }));

  if (settings.regionPreference.trim()) {
    facts.push({
      id: 'fact_region_pref',
      kind: 'region',
      value: settings.regionPreference.trim(),
      source: 'user_confirmed',
      status: 'confirmed',
      projectId: null,
      updatedAt: settings.updatedAt,
    });
  }
  return facts;
}

export function checkHomonymNeedsDisambiguation(
  name: string,
  disambiguationHint?: string,
  officialUrl?: string
): boolean {
  const trimmed = name.trim().toLowerCase();
  if (disambiguationHint?.trim() || officialUrl?.trim()) {
    return false;
  }
  if (AMBIGUOUS_HOMONYM_NAMES.has(trimmed) || name.trim().length <= 1) {
    return true;
  }
  return false;
}

export function previewMinimalSearchQuery(params: {
  settings: DiscoverySettings;
  projects: ProjectEntity[];
  areas?: AreaEntity[];
  confirmedSubjects: ConfirmedSubject[];
}): {
  canSearch: boolean;
  previewQuery: string;
  statusNote: string;
  activeProjectName: string | null;
  activeSubjectName: string | null;
} {
  const { settings, projects, areas = [], confirmedSubjects } = params;
  const activeTarget =
    projects.find(
      (p) => p.status === 'active' && settings.enabledProjectIds.includes(p.id)
    ) ||
    areas.find(
      (a) => a.status === 'active' && (settings.enabledAreaIds || []).includes(a.id)
    ) ||
    null;
  const activeSubject =
    confirmedSubjects.find(
      (s) =>
        s.confirmationState === 'confirmed' &&
        s.frequency !== 'no' &&
        s.frequency !== 'unknown' &&
        (!activeTarget || !s.projectId || s.projectId === activeTarget.id)
    ) ||
    confirmedSubjects.find(
      (s) =>
        s.confirmationState === 'confirmed' &&
        s.frequency !== 'no' &&
        s.frequency !== 'unknown'
    ) ||
    null;

  if (settings.paused) {
    return {
      canSearch: false,
      previewQuery: '（お休み中：今は外へ探しに行きません）',
      statusNote: 'お休み中',
      activeProjectName: activeTarget?.name || null,
      activeSubjectName: activeSubject?.canonicalName || null,
    };
  }
  if (!settings.searchConsentGranted) {
    return {
      canSearch: false,
      previewQuery: '（外でイベントを探すスイッチがオフのため、検索ワードは送信されません）',
      statusNote: '外の検索オフ（送信なし）',
      activeProjectName: activeTarget?.name || null,
      activeSubjectName: activeSubject?.canonicalName || null,
    };
  }
  if (
    typeof settings.budgetLimitUsd === 'number' &&
    typeof settings.estimatedUsedUsd === 'number' &&
    settings.estimatedUsedUsd >= settings.budgetLimitUsd
  ) {
    return {
      canSearch: false,
      previewQuery: `（月の予算上限 $${settings.budgetLimitUsd.toFixed(2)} に達したため、外での検索をお休みしています）`,
      statusNote: '予算上限で自動ストップ',
      activeProjectName: activeTarget?.name || null,
      activeSubjectName: activeSubject?.canonicalName || null,
    };
  }
  if (!activeTarget) {
    return {
      canSearch: false,
      previewQuery: '（探したいテーマ［Project / Area］がまだ選ばれていません）',
      statusNote: 'テーマ未選択',
      activeProjectName: null,
      activeSubjectName: activeSubject?.canonicalName || null,
    };
  }
  if (!activeSubject) {
    return {
      canSearch: false,
      previewQuery: '（好きなアーティストや作家を教えてもらえると探せます）',
      statusNote: '好きな人・作家の登録待ち',
      activeProjectName: activeTarget.name,
      activeSubjectName: null,
    };
  }

  if (
    settings.customQueryOverride &&
    settings.customQueryOverride.trim().includes(activeSubject.canonicalName)
  ) {
    return {
      canSearch: true,
      previewQuery: settings.customQueryOverride.trim(),
      statusNote: 'カスタマイズ検索ワード',
      activeProjectName: activeTarget.name,
      activeSubjectName: activeSubject.canonicalName,
    };
  }

  const parts = [activeSubject.canonicalName, '公式 公演 ライブ'];
  if (settings.regionPreference.trim()) parts.push(settings.regionPreference.trim());
  if (settings.periodPreference.trim()) parts.push(settings.periodPreference.trim());

  return {
    canSearch: true,
    previewQuery: parts.join(' '),
    statusNote: '名前と地域・時期だけを送ります（写真や個人メモは送りません）',
    activeProjectName: activeTarget.name,
    activeSubjectName: activeSubject.canonicalName,
  };
}
