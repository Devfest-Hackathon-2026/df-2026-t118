import {
  buildNextDiscoveryQuestion,
  buildSafeSearchQuery,
  buildStableResearchJobId,
  canAcquireJobLease,
  evaluateNotificationDispatch,
  verifyAndRankDiscoveryCandidates,
} from '../domain/proactiveDiscoveryEngine.js';
import type {
  DiscoveryFeedback,
  ResearchJob,
  ResearchReport,
  RunDiscoveryCycleInput,
} from '../domain/proactiveDiscoverySchemas.js';
import {
  CuratedReferenceSearchAdapter,
  type DiscoverySearchAdapter,
} from '../infrastructure/discoverySearchAdapter.js';

export interface RunDiscoveryCycleResult {
  report: ResearchReport;
  job: ResearchJob;
  externalSearchCalls: number;
  rejectedCandidates: Array<{ candidateId: string; reason: string }>;
}

export async function runProactiveDiscoveryCycle(
  input: RunDiscoveryCycleInput,
  options?: {
    searchAdapter?: DiscoverySearchAdapter;
    existingJob?: ResearchJob | null;
    nowMs?: number;
    // サーバー側では Firestore を読み直して確認するため、非同期も受ける
    recheckConsentBeforePublish?: () => boolean | Promise<boolean>;
  }
): Promise<RunDiscoveryCycleResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const adapter = options?.searchAdapter ?? new CuratedReferenceSearchAdapter();
  const {
    uid,
    localDate,
    currentHour,
    settings,
    projects,
    areas = [],
    confirmedSubjects,
    previousFeedbacks,
    alreadyNotifiedDedupeKeys,
    existingReportForDate,
    simulateProviderError,
  } = input;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeAreas = areas.filter((a) => a.status === 'active');
  const activeTargets = [...activeProjects, ...activeAreas];
  const enabledAll = [
    ...(settings.enabledProjectIds || []),
    ...(settings.enabledAreaIds || []),
  ];
  const targetProject =
    activeTargets.find((t) => enabledAll.includes(t.id)) ||
    activeTargets[0] ||
    null;

  const jobId = buildStableResearchJobId(
    uid,
    localDate,
    targetProject?.id || 'no_project',
    'concert_discovery'
  );
  const reportId = `rep_${jobId}`;

  // 手動と定時が競合しても同一の公開レポートに収束させる（冪等性）
  if (existingReportForDate && existingReportForDate.localDate === localDate) {
    return {
      report: existingReportForDate,
      job: {
        jobId,
        uid,
        projectId: targetProject?.id || 'no_project',
        periodKey: localDate,
        kind: 'concert_discovery',
        status: 'completed',
        leaseUntil: nowMs,
        attempt: 1,
        startedAt: existingReportForDate.executedAt,
        completedAt: existingReportForDate.executedAt,
        failureCode: null,
        settingsVersion: settings.searchConsentVersion,
      },
      externalSearchCalls: 0,
      rejectedCandidates: [],
    };
  }

  const leaseCheck = canAcquireJobLease(options?.existingJob ?? null, nowMs);
  if (!leaseCheck.allowed && options?.existingJob) {
    return {
      report: {
        id: reportId,
        jobId,
        uid,
        localDate,
        projectId: targetProject?.id || null,
        status: 'paused_or_no_project',
        executedAt: nowMs,
        card: null,
        question: null,
        investigationMemo: {
          executedAt: nowMs,
          searchPerformed: false,
          queryUsed: null,
          targetProjectId: targetProject?.id || null,
          targetProjectName: targetProject?.name || null,
          sourcesReceived: [],
          summary: `ジョブが既に実行中または完了済みです（理由: ${leaseCheck.reason}）。二重実行を防止しました。`,
          uncertaintyNote: '外部検索は実行していません。',
        },
        notificationState: 'not_requested',
        feedback: null,
      },
      job: options.existingJob,
      externalSearchCalls: 0,
      rejectedCandidates: [],
    };
  }

  const nextQuestion = buildNextDiscoveryQuestion({
    projects: activeTargets,
    confirmedSubjects,
    settings,
    nowMs,
  });

  // 停止中または有効なProjectが存在しない場合
  if (settings.paused || !targetProject) {
    const job: ResearchJob = {
      jobId,
      uid,
      projectId: targetProject?.id || 'no_project',
      periodKey: localDate,
      kind: 'concert_discovery',
      status: 'aborted_no_consent',
      leaseUntil: nowMs,
      attempt: leaseCheck.nextAttempt,
      startedAt: nowMs,
      completedAt: nowMs,
      failureCode: settings.paused ? 'PAUSED_BY_USER' : 'NO_ACTIVE_PROJECT',
      settingsVersion: settings.searchConsentVersion,
    };

    return {
      report: {
        id: reportId,
        jobId,
        uid,
        localDate,
        projectId: targetProject?.id || null,
        status: nextQuestion ? 'question_only' : 'paused_or_no_project',
        executedAt: nowMs,
        card: null,
        question: nextQuestion,
        investigationMemo: {
          executedAt: nowMs,
          searchPerformed: false,
          queryUsed: null,
          targetProjectId: targetProject?.id || null,
          targetProjectName: targetProject?.name || null,
          sourcesReceived: [],
          summary: settings.paused
            ? '能動発見が一時停止（OFF）されているため、外部検索を行わず終了しました。'
            : '対象となる有効なProjectが未登録のため、外部検索を行わず質問のみ用意しました（AIが勝手にProjectを生成することはありません）。',
          uncertaintyNote: '外部検索呼び出しは 0 回です。',
        },
        notificationState: 'not_requested',
        feedback: null,
      },
      job,
      externalSearchCalls: 0,
      rejectedCandidates: [],
    };
  }

  // 本人確認済みの対象人物（拒否・削除・未確認・同名未解決を除外）
  const activeConfirmedSubject =
    confirmedSubjects.find(
      (s) =>
        s.confirmationState === 'confirmed' &&
        s.frequency !== 'no' &&
        s.frequency !== 'unknown' &&
        (!s.projectId || s.projectId === targetProject.id)
    ) ||
    confirmedSubjects.find(
      (s) =>
        s.confirmationState === 'confirmed' &&
        s.frequency !== 'no' &&
        s.frequency !== 'unknown'
    ) ||
    null;

  const queryCheck = buildSafeSearchQuery({
    settings,
    project: targetProject,
    subject: activeConfirmedSubject,
  });

  // A02: 検索同意がOFF、または検索条件（本人確認・Project許可）を満たさない場合は外部呼び出しゼロ
  if (!queryCheck.allowed || !queryCheck.query || !activeConfirmedSubject) {
    const isSearchOff = !settings.searchConsentGranted;
    const status = isSearchOff
      ? 'search_off'
      : nextQuestion
        ? 'question_only'
        : 'no_candidate';

    const notifEval = evaluateNotificationDispatch({
      settings,
      currentHour,
      hasActionableReport: Boolean(nextQuestion),
      projectStillActive: true,
    });

    const job: ResearchJob = {
      jobId,
      uid,
      projectId: targetProject.id,
      periodKey: localDate,
      kind: 'concert_discovery',
      status: isSearchOff ? 'aborted_no_consent' : 'completed',
      leaseUntil: nowMs,
      attempt: leaseCheck.nextAttempt,
      startedAt: nowMs,
      completedAt: nowMs,
      failureCode: queryCheck.blockedReason || null,
      settingsVersion: settings.searchConsentVersion,
    };

    return {
      report: {
        id: reportId,
        jobId,
        uid,
        localDate,
        projectId: targetProject.id,
        status,
        executedAt: nowMs,
        card: null,
        question: nextQuestion,
        investigationMemo: {
          executedAt: nowMs,
          searchPerformed: false,
          queryUsed: null,
          targetProjectId: targetProject.id,
          targetProjectName: targetProject.name,
          sourcesReceived: [],
          summary: isSearchOff
            ? '外部検索の同意が OFF のため、外部プロバイダー呼び出しを一切行わず質問カードのみ確認しました。'
            : `検索前提条件（${queryCheck.blockedReason}）が未確定のため、外部検索を行わず本人確認の質問を優先しました。`,
          uncertaintyNote: '外部検索呼び出し回数: 0 回（未確認情報を事実として通知しません）。',
        },
        notificationState: notifEval.notificationState,
        feedback: null,
      },
      job,
      externalSearchCalls: 0,
      rejectedCandidates: [],
    };
  }

  // サービス障害シミュレーションまたは外部I/O実行
  if (simulateProviderError) {
    const job: ResearchJob = {
      jobId,
      uid,
      projectId: targetProject.id,
      periodKey: localDate,
      kind: 'concert_discovery',
      status: 'failed',
      leaseUntil: nowMs,
      attempt: leaseCheck.nextAttempt,
      startedAt: nowMs,
      completedAt: nowMs,
      failureCode: 'PROVIDER_UNAVAILABLE',
      settingsVersion: settings.searchConsentVersion,
    };

    return {
      report: {
        id: reportId,
        jobId,
        uid,
        localDate,
        projectId: targetProject.id,
        status: 'provider_error',
        executedAt: nowMs,
        card: null,
        question: nextQuestion,
        investigationMemo: {
          executedAt: nowMs,
          searchPerformed: true,
          queryUsed: queryCheck.query,
          targetProjectId: targetProject.id,
          targetProjectName: targetProject.name,
          sourcesReceived: [],
          summary:
            '検索プロバイダーへの接続時にエラーが発生したため、調査済みと偽らず中断しました。',
          uncertaintyNote: '確認できなかったため、確定情報としての通知は行いません。',
        },
        notificationState: 'not_requested',
        feedback: null,
      },
      job,
      externalSearchCalls: 1,
      rejectedCandidates: [],
    };
  }

  const adapterRes = await adapter.searchConcertsAndCuratedEvents({
    query: queryCheck.query,
    subjectName: activeConfirmedSubject.canonicalName,
    regionPreference: settings.regionPreference,
    nowMs,
  });

  // 公開・通知直前の同意撤回・停止再確認（Section 4: 送信直前の同意取消・Project削除を再検証）
  if (
    options?.recheckConsentBeforePublish &&
    !(await options.recheckConsentBeforePublish())
  ) {
    const job: ResearchJob = {
      jobId,
      uid,
      projectId: targetProject.id,
      periodKey: localDate,
      kind: 'concert_discovery',
      status: 'aborted_no_consent',
      leaseUntil: nowMs,
      attempt: leaseCheck.nextAttempt,
      startedAt: nowMs,
      completedAt: nowMs,
      failureCode: 'CONSENT_REVOKED_BEFORE_PUBLISH',
      settingsVersion: settings.searchConsentVersion,
    };

    return {
      report: {
        id: reportId,
        jobId,
        uid,
        localDate,
        projectId: targetProject.id,
        status: 'search_off',
        executedAt: nowMs,
        card: null,
        question: null,
        investigationMemo: {
          executedAt: nowMs,
          searchPerformed: true,
          queryUsed: queryCheck.query,
          targetProjectId: targetProject.id,
          targetProjectName: targetProject.name,
          sourcesReceived: [],
          summary:
            '公開・通知直前に検索同意の撤回または停止が確認されたため、レポートの公開と通知を中止しました。',
          uncertaintyNote: '既に送信された最小限の検索語は撤回できませんが、結果の保存と通知は停止しました。',
        },
        notificationState: 'skipped_consent_off',
        feedback: null,
      },
      job,
      externalSearchCalls: 1,
      rejectedCandidates: [],
    };
  }

  const { verifiedCards, rejectedReasons } = verifyAndRankDiscoveryCandidates({
    candidates: adapterRes.candidates,
    allowedSourceUrls: adapterRes.allowedSourceUrls,
    subject: activeConfirmedSubject,
    project: targetProject,
    settings,
    previousFeedbacks,
    alreadyNotifiedDedupeKeys,
    nowDateStr: localDate,
    nowMs,
  });

  const topCard = verifiedCards[0] || null;
  const status: ResearchReport['status'] = topCard
    ? 'card_ready'
    : adapterRes.candidates.length > 0
      ? 'unverified_source'
      : nextQuestion
        ? 'question_only'
        : 'no_candidate';

  const notifEval = evaluateNotificationDispatch({
    settings,
    currentHour,
    hasActionableReport: Boolean(topCard || nextQuestion),
    projectStillActive: targetProject.status === 'active',
  });

  const job: ResearchJob = {
    jobId,
    uid,
    projectId: targetProject.id,
    periodKey: localDate,
    kind: 'concert_discovery',
    status: 'completed',
    leaseUntil: nowMs,
    attempt: leaseCheck.nextAttempt,
    startedAt: nowMs,
    completedAt: nowMs,
    failureCode: null,
    settingsVersion: settings.searchConsentVersion,
  };

  return {
    report: {
      id: reportId,
      jobId,
      uid,
      localDate,
      projectId: targetProject.id,
      status,
      executedAt: nowMs,
      card: topCard,
      question: nextQuestion,
      investigationMemo: {
        executedAt: nowMs,
        searchPerformed: true,
        queryUsed: queryCheck.query,
        targetProjectId: targetProject.id,
        targetProjectName: targetProject.name,
        sourcesReceived: adapterRes.candidates.map((c) => ({
          title: c.sourceTitle,
          url: c.sourceUrl,
          curatorName: c.curatorName,
          verifiedAt: c.fetchedAt,
          isOfficial: c.officialVerified,
        })),
        summary: topCard
          ? `本人確認済みの「${activeConfirmedSubject.canonicalName}」について公式情報・編集推薦を照合し、条件（地域・日程・会場・出典）を満たす1件を発見カードにしました。`
          : adapterRes.candidates.length > 0
            ? `候補が ${adapterRes.candidates.length} 件見つかりましたが、公式照合・地域・日程・重複条件を満たさなかったため通知を見送りました（確認できなかったものを確定情報として出しません）。`
            : `「${queryCheck.query}」で探しましたが、現在条件に合う公式発表の公演は見つかりませんでした（候補なしは正常終了です）。`,
        uncertaintyNote:
          adapterRes.adapterMode === 'curated_reference_fixture'
            ? '※検証用キュレーション参照データ（モック/固定データ）で照合しています。実運用時は公式ページで最新情報を確認してください。'
            : '※公開Web検索の出典を確認しています。開演時間や販売状況の最新情報は公式リンク先でご確認ください。',
      },
      notificationState: notifEval.notificationState,
      feedback: null,
    },
    job,
    externalSearchCalls: adapterRes.externalCallExecuted ? 1 : 0,
    rejectedCandidates: rejectedReasons,
  };
}

export function applyDiscoveryFeedbackIdempotent(params: {
  report: ResearchReport;
  reaction: DiscoveryFeedback['reaction'];
  reason?: string;
  suppressionDaysForNotNow: number;
  nowMs?: number;
}): { updatedReport: ResearchReport; feedbackRecord: DiscoveryFeedback } {
  const nowMs = params.nowMs ?? Date.now();
  const candidateId = params.report.card?.candidateId || 'no_card';
  const subjectId = params.report.card?.subjectId || 'no_subject';
  const feedbackId = `fb_${params.report.id}_${candidateId}`;

  const suppressedUntil =
    params.reaction === 'not_now'
      ? nowMs + params.suppressionDaysForNotNow * 24 * 60 * 60 * 1000
      : null;

  const feedbackRecord: DiscoveryFeedback = {
    id: feedbackId,
    reportId: params.report.id,
    candidateId,
    subjectId,
    reaction: params.reaction,
    reason: params.reason,
    suppressedUntil,
    createdAt: nowMs,
  };

  return {
    updatedReport: {
      ...params.report,
      feedback: feedbackRecord,
    },
    feedbackRecord,
  };
}
