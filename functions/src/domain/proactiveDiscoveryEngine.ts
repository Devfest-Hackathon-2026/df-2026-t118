import type {
  ConfirmedSubject,
  DiscoveryFeedback,
  DiscoveryQuestion,
  DiscoverySettings,
  RawDiscoveryCandidate,
  ResearchJob,
  VerifiedDiscoveryCard,
} from './proactiveDiscoverySchemas.js';

const PII_OR_UNSAFE_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // メールアドレス
  /\b\d{2,4}-\d{2,4}-\d{3,4}\b/g, // 電話番号
  /〒?\d{3}-\d{4}/g, // 郵便番号
  /\S*[都道府県市区町村]\S*[0-9０-９]+(?:丁目|番地|号|-)\S*/g, // 詳細住所番地
  /data:image\/[a-zA-Z]+;base64,[^\s]+/g, // 画像DataURL
  /ignore\s+all\s+previous\s+instructions/gi,
  /system\s*prompt/gi,
  /外部へ送信せよ|命令を実行せよ|パスワードを送信/g,
];

const INJECTION_CHECK_REGEX =
  /ignore\s+(all\s+)?previous\s+instructions|system\s*prompt|外部へ送信せよ|命令を実行せよ|<script/i;

export function stripSensitiveAndInjectionTokens(raw: string): string {
  let cleaned = raw;
  for (const pat of PII_OR_UNSAFE_PATTERNS) {
    cleaned = cleaned.replace(pat, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function isSafePublicHttpsUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function buildStableResearchJobId(
  uid: string,
  periodKey: string,
  projectId: string,
  kind: 'concert_discovery' | 'curated_discovery' = 'concert_discovery'
): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePeriod = periodKey.replace(/[^0-9-]/g, '');
  const safeProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `job_${safeUid}_${safePeriod}_${safeProj}_${kind}`;
}

export function canAcquireJobLease(
  existingJob: ResearchJob | null,
  nowMs: number,
  maxAttempts = 3
): { allowed: boolean; reason: string; nextAttempt: number } {
  if (!existingJob) {
    return { allowed: true, reason: 'new_job', nextAttempt: 1 };
  }
  if (existingJob.status === 'completed') {
    return { allowed: false, reason: 'already_completed', nextAttempt: existingJob.attempt };
  }
  if (existingJob.attempt >= maxAttempts) {
    return { allowed: false, reason: 'max_attempts_exceeded', nextAttempt: existingJob.attempt };
  }
  if (existingJob.status === 'claimed' && existingJob.leaseUntil > nowMs) {
    return { allowed: false, reason: 'lease_active', nextAttempt: existingJob.attempt };
  }
  return {
    allowed: true,
    reason: 'lease_expired_retry',
    nextAttempt: existingJob.attempt + 1,
  };
}

export function buildSafeSearchQuery(params: {
  settings: DiscoverySettings;
  project: { id: string; name: string; status: 'active' | 'archived' } | null;
  subject: ConfirmedSubject | null;
}): { allowed: boolean; query: string | null; blockedReason?: string } {
  const { settings, project, subject } = params;

  if (settings.paused) {
    return { allowed: false, query: null, blockedReason: 'paused_by_user' };
  }
  if (!settings.searchConsentGranted) {
    return { allowed: false, query: null, blockedReason: 'search_consent_off' };
  }
  if (!project || project.status !== 'active') {
    return { allowed: false, query: null, blockedReason: 'no_active_project' };
  }
  const enabledAll = [
    ...(settings.enabledProjectIds || []),
    ...(settings.enabledAreaIds || []),
  ];
  if (!enabledAll.includes(project.id)) {
    return { allowed: false, query: null, blockedReason: 'project_not_permitted_for_search' };
  }
  if (
    typeof settings.budgetLimitUsd === 'number' &&
    typeof settings.estimatedUsedUsd === 'number' &&
    settings.estimatedUsedUsd >= settings.budgetLimitUsd
  ) {
    return { allowed: false, query: null, blockedReason: 'budget_limit_reached' };
  }
  if (!subject) {
    return { allowed: false, query: null, blockedReason: 'no_confirmed_subject' };
  }
  if (subject.confirmationState !== 'confirmed') {
    return {
      allowed: false,
      query: null,
      blockedReason:
        subject.confirmationState === 'pending_disambiguation'
          ? 'homonym_pending_disambiguation'
          : 'subject_not_confirmed_by_user',
    };
  }
  if (subject.frequency === 'no' || subject.frequency === 'unknown') {
    return { allowed: false, query: null, blockedReason: 'subject_frequency_not_positive' };
  }

  // カスタム検索語オーバーライドがある場合もサニタイズし、本人確認済み人物名が含まれているか検証する
  if (settings.customQueryOverride && settings.customQueryOverride.trim()) {
    const cleanedCustom = stripSensitiveAndInjectionTokens(settings.customQueryOverride);
    if (!cleanedCustom.includes(subject.canonicalName)) {
      return {
        allowed: false,
        query: null,
        blockedReason: 'custom_query_missing_confirmed_subject',
      };
    }
    return { allowed: true, query: cleanedCustom.slice(0, 120) };
  }

  const safeArtist = stripSensitiveAndInjectionTokens(subject.canonicalName);
  const safeRegion = stripSensitiveAndInjectionTokens(settings.regionPreference || '');
  const safePeriod = stripSensitiveAndInjectionTokens(settings.periodPreference || '');

  if (!safeArtist) {
    return { allowed: false, query: null, blockedReason: 'empty_sanitized_subject' };
  }

  const parts = [safeArtist, '公式 公演 ライブ'];
  if (safeRegion) parts.push(safeRegion);
  if (safePeriod) parts.push(safePeriod);

  return {
    allowed: true,
    query: parts.join(' ').slice(0, 120),
  };
}

export function buildEventDedupeKey(candidate: RawDiscoveryCandidate): string {
  if (candidate.officialEventId && candidate.officialEventId.trim()) {
    return `official_${candidate.officialEventId.trim()}`;
  }
  // 昼夜公演は開演時刻（startTime）で別扱いとし、不確実な場合は結合しない
  const normSubject = candidate.subjectName.trim().toLowerCase();
  const normEvent = candidate.eventName.trim().toLowerCase();
  const normDate = candidate.eventDate.trim();
  const normVenue = candidate.venue.trim().toLowerCase();
  const normTime = (candidate.startTime || 'time_unspecified').trim();
  return `evt_${normSubject}__${normEvent}__${normDate}__${normVenue}__${normTime}`;
}

export function verifyAndRankDiscoveryCandidates(params: {
  candidates: RawDiscoveryCandidate[];
  allowedSourceUrls: string[];
  subject: ConfirmedSubject;
  project: { id: string; name: string };
  settings: DiscoverySettings;
  previousFeedbacks: DiscoveryFeedback[];
  alreadyNotifiedDedupeKeys: string[];
  nowDateStr: string; // YYYY-MM-DD
  nowMs: number;
}): {
  verifiedCards: VerifiedDiscoveryCard[];
  rejectedReasons: Array<{ candidateId: string; reason: string }>;
} {
  const {
    candidates,
    allowedSourceUrls,
    subject,
    project,
    settings,
    previousFeedbacks,
    alreadyNotifiedDedupeKeys,
    nowDateStr,
    nowMs,
  } = params;

  const allowedUrlSet = new Set(allowedSourceUrls.map((u) => u.trim()));
  const seenDedupeKeys = new Set(alreadyNotifiedDedupeKeys);
  const rejectedReasons: Array<{ candidateId: string; reason: string }> = [];
  const verifiedCards: VerifiedDiscoveryCard[] = [];

  // フィードバック状態の集計
  const dislikedCandidateIds = new Set(
    previousFeedbacks.filter((f) => f.reaction === 'dislike').map((f) => f.candidateId)
  );
  const dislikedSubjectIds = new Set(
    previousFeedbacks.filter((f) => f.reaction === 'dislike').map((f) => f.subjectId)
  );
  const notNowSuppressedSubjectIds = new Set(
    previousFeedbacks
      .filter(
        (f) =>
          f.reaction === 'not_now' &&
          typeof f.suppressedUntil === 'number' &&
          f.suppressedUntil > nowMs
      )
      .map((f) => f.subjectId)
  );
  const likedSubjectIds = new Set(
    previousFeedbacks.filter((f) => f.reaction === 'like').map((f) => f.subjectId)
  );

  if (dislikedSubjectIds.has(subject.id)) {
    for (const c of candidates) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'subject_explicitly_disliked' });
    }
    return { verifiedCards: [], rejectedReasons };
  }

  if (notNowSuppressedSubjectIds.has(subject.id)) {
    for (const c of candidates) {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: 'temporarily_suppressed_by_not_now',
      });
    }
    return { verifiedCards: [], rejectedReasons };
  }

  for (const c of candidates) {
    // 1. 過去の明示拒否チェック
    if (dislikedCandidateIds.has(c.candidateId)) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'candidate_disliked' });
      continue;
    }

    // 2. 権利・利用条件・公式照合チェック
    if (!c.termsPermitted) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'terms_not_permitted' });
      continue;
    }
    if (!c.officialVerified) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'not_officially_verified' });
      continue;
    }

    // 3. 架空URL・非HTTPS・プロンプトインジェクション排除
    if (!isSafePublicHttpsUrl(c.sourceUrl) || !allowedUrlSet.has(c.sourceUrl.trim())) {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: 'unverified_or_hallucinated_source_url',
      });
      continue;
    }
    if (
      INJECTION_CHECK_REGEX.test(c.eventName) ||
      INJECTION_CHECK_REGEX.test(c.recommendationReason) ||
      INJECTION_CHECK_REGEX.test(c.sourceTitle)
    ) {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: 'prompt_injection_detected_in_candidate',
      });
      continue;
    }

    // 4. 同一人物・同名人物（Homonym）の照合
    if (c.subjectName.trim().toLowerCase() !== subject.canonicalName.trim().toLowerCase()) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'subject_name_mismatch' });
      continue;
    }
    if (
      subject.disambiguationHint &&
      c.disambiguationHint &&
      !c.disambiguationHint.includes(subject.disambiguationHint) &&
      !subject.disambiguationHint.includes(c.disambiguationHint)
    ) {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: 'homonym_disambiguation_mismatch',
      });
      continue;
    }

    // 5. 開催状態・過去公演・中止公演の除外
    if (c.eventStatus !== 'scheduled') {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: `event_status_${c.eventStatus}`,
      });
      continue;
    }
    if (!c.eventDate || c.eventDate < nowDateStr || !c.venue.trim()) {
      rejectedReasons.push({
        candidateId: c.candidateId,
        reason: 'past_or_missing_date_venue',
      });
      continue;
    }

    // 6. 地域指定の照合（本人が地域を指定している場合）
    const prefRegion = settings.regionPreference.trim();
    if (prefRegion) {
      const regionTokens = prefRegion
        .split(/[・、,\s/]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const matchesRegion =
        regionTokens.length === 0 ||
        regionTokens.some(
          (tok) => c.region.includes(tok) || c.venue.includes(tok) || tok.includes(c.region)
        );
      if (!matchesRegion) {
        rejectedReasons.push({ candidateId: c.candidateId, reason: 'region_mismatch' });
        continue;
      }
    }

    // 7. 重複・昼夜公演の区別照合
    const dedupeKey = buildEventDedupeKey(c);
    if (seenDedupeKeys.has(dedupeKey)) {
      rejectedReasons.push({ candidateId: c.candidateId, reason: 'duplicate_or_already_notified' });
      continue;
    }
    seenDedupeKeys.add(dedupeKey);

    // 8. 説明可能な順位付け（本人との接点・Project関係・人による推薦・鮮度・反応）
    const scoreBreakdown: string[] = [];
    let score = 0;

    if (c.curatorType === 'artist_official') {
      score += 40;
      scoreBreakdown.push('公式発表・一次情報 (+40)');
    } else if (c.curatorType === 'editor_magazine') {
      score += 30;
      scoreBreakdown.push('編集者・キュレーション媒体推薦 (+30)');
    } else {
      score += 20;
      scoreBreakdown.push('条件確認済みAPI (+20)');
    }

    if (subject.frequency === 'often') {
      score += 25;
      scoreBreakdown.push('よく聴く・確認済みアーティスト (+25)');
    } else if (subject.frequency === 'sometimes') {
      score += 15;
      scoreBreakdown.push('たまに聴く・確認済みアーティスト (+15)');
    }

    if (likedSubjectIds.has(subject.id)) {
      score += 15;
      scoreBreakdown.push('過去の「好き」反応を反映 (+15)');
    }

    if (prefRegion && (c.region.includes(prefRegion) || prefRegion.includes(c.region))) {
      score += 10;
      scoreBreakdown.push(`希望地域（${prefRegion}）に一致 (+10)`);
    }

    verifiedCards.push({
      candidateId: c.candidateId,
      dedupeKey,
      projectId: project.id,
      subjectId: subject.id,
      subjectName: subject.canonicalName,
      title: `${c.subjectName}「${c.eventName}」`,
      whyFound: `あなたのテーマ「${project.name}」と、お気に入りの「${subject.canonicalName}」${
        prefRegion ? `（${prefRegion}）` : ''
      }から見つけました。${c.recommendationReason}`,
      recommendedBy: `${c.curatorName}（${
        c.curatorType === 'artist_official'
          ? '公式サイト'
          : c.curatorType === 'editor_magazine'
            ? '編集者おすすめ'
            : '公式カレンダー'
      }）`,
      curatorType: c.curatorType,
      eventDate: c.eventDate,
      startTime: c.startTime,
      venue: c.venue,
      region: c.region,
      sourceTitle: c.sourceTitle,
      sourceUrl: c.sourceUrl,
      verifiedAt: c.fetchedAt,
      priceOrStatusNote: c.priceOrStatusNote,
      score,
      scoreBreakdown,
    });
  }

  verifiedCards.sort((a, b) => b.score - a.score);
  return { verifiedCards, rejectedReasons };
}

export function buildNextDiscoveryQuestion(params: {
  projects: Array<{ id: string; name: string; status: 'active' | 'archived' }>;
  confirmedSubjects: ConfirmedSubject[];
  settings: DiscoverySettings;
  nowMs: number;
}): DiscoveryQuestion | null {
  const { projects, confirmedSubjects, settings, nowMs } = params;
  if (settings.paused) return null;

  const activeProjects = projects.filter((p) => p.status === 'active');
  if (activeProjects.length === 0) {
    // A01: Project不在でもAIがProjectを自動生成して埋め合わせない。質問のみまたは連絡なし
    return {
      id: `q_artist_intro_${nowMs}`,
      projectId: null,
      kind: 'artist_check',
      prompt: '最近よく聴いているアーティストや、気になっている作家はいますか？',
      options: ['名前を入力して教える', '今はわからない', '答えない'],
      allowFreeText: true,
      status: 'pending',
      createdAt: nowMs,
    };
  }

  const targetProject =
    activeProjects.find((p) => settings.enabledProjectIds.includes(p.id)) || activeProjects[0];

  // 1. 同名人物・未確定候補がある場合は本人確認質問を最優先にする
  const pendingSubject = confirmedSubjects.find(
    (s) =>
      s.confirmationState === 'pending_disambiguation' || s.confirmationState === 'unconfirmed'
  );
  if (pendingSubject) {
    return {
      id: `q_confirm_${pendingSubject.id}`,
      projectId: targetProject.id,
      kind:
        pendingSubject.confirmationState === 'pending_disambiguation'
          ? 'disambiguation'
          : 'artist_check',
      prompt:
        pendingSubject.confirmationState === 'pending_disambiguation'
          ? `「${pendingSubject.canonicalName}」は同名の活動者がいます。代表作や分野を教えてもらえますか？`
          : `「${pendingSubject.canonicalName}」は普段どのくらい聴いたり見たりしますか？`,
      options: ['よく聴く・好き', 'たまに聴く', '違う（別の人・興味なし）', 'わからない'],
      allowFreeText: true,
      status: 'pending',
      candidateSubjectId: pendingSubject.id,
      createdAt: nowMs,
    };
  }

  // 2. 確認済みアーティストがまだ1人もいない場合
  const hasConfirmed = confirmedSubjects.some(
    (s) =>
      s.confirmationState === 'confirmed' && s.frequency !== 'no' && s.frequency !== 'unknown'
  );
  if (!hasConfirmed) {
    return {
      id: `q_artist_${targetProject.id}`,
      projectId: targetProject.id,
      kind: 'artist_check',
      prompt: `「${targetProject.name}」に関連して、最近聴いているアーティストや好きな作家はいますか？`,
      options: ['名前を入力して教える', 'わからない', '答えない'],
      allowFreeText: true,
      status: 'pending',
      createdAt: nowMs,
    };
  }

  // 3. アーティストは確認済みだがイベントの地域・期間が未設定の場合
  if (!settings.regionPreference.trim()) {
    return {
      id: `q_region_${targetProject.id}`,
      projectId: targetProject.id,
      kind: 'region_period',
      prompt: '公演や展示を探すとき、行きやすい地域はどこですか？（位置情報は自動取得しません）',
      options: ['東京・関東', '京都・関西', 'オンライン・全国', '今は指定しない・答えない'],
      allowFreeText: true,
      status: 'pending',
      createdAt: nowMs,
    };
  }

  return null;
}

export function isWithinQuietHours(
  currentHour: number,
  quietStart: number,
  quietEnd: number
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart > quietEnd) {
    // 例: 22時〜翌8時
    return currentHour >= quietStart || currentHour < quietEnd;
  }
  return currentHour >= quietStart && currentHour < quietEnd;
}

export function evaluateNotificationDispatch(params: {
  settings: DiscoverySettings;
  currentHour: number;
  hasActionableReport: boolean;
  projectStillActive: boolean;
}): {
  shouldAttemptPush: boolean;
  notificationState:
    | 'not_requested'
    | 'skipped_consent_off'
    | 'skipped_quiet_hours'
    | 'provider_accepted_unverified_device';
  genericTitle: string;
  genericBody: string;
} {
  const { settings, currentHour, hasActionableReport, projectStillActive } = params;
  // A04: ロック画面にProject名・質問の回答・検索内容を出さない汎用文面
  const genericTitle = 'しまからお知らせがあるよ';
  const genericBody = '連絡箱に新しい発見メモが届いています。時間のあるときに眺めてみてね。';

  if (!hasActionableReport || !projectStillActive || settings.paused) {
    return {
      shouldAttemptPush: false,
      notificationState: 'not_requested',
      genericTitle,
      genericBody,
    };
  }
  if (!settings.notificationEnabled) {
    return {
      shouldAttemptPush: false,
      notificationState: 'skipped_consent_off',
      genericTitle,
      genericBody,
    };
  }
  if (isWithinQuietHours(currentHour, settings.quietHoursStart, settings.quietHoursEnd)) {
    return {
      shouldAttemptPush: false,
      notificationState: 'skipped_quiet_hours',
      genericTitle,
      genericBody,
    };
  }

  return {
    shouldAttemptPush: true,
    // A04: 通知サービス受付と端末への実機到達・開封を区別し、到達保証と偽らない
    notificationState: 'provider_accepted_unverified_device',
    genericTitle,
    genericBody,
  };
}
