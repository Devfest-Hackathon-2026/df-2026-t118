import type { RawDiscoveryCandidate } from '../domain/proactiveDiscoverySchemas.js';

export interface DiscoverySearchAdapterResult {
  adapterMode: 'curated_reference_fixture' | 'live_grounding_provider';
  allowedSourceUrls: string[];
  candidates: RawDiscoveryCandidate[];
  externalCallExecuted: boolean;
}

export interface DiscoverySearchAdapter {
  searchConcertsAndCuratedEvents(params: {
    query: string;
    subjectName: string;
    regionPreference: string;
    nowMs: number;
  }): Promise<DiscoverySearchAdapterResult>;
}

// 検証・PoC用の公式発表・編集媒体キュレーション参照データセット（モック/固定データであることを明示）
const CURATED_REFERENCE_CATALOG: Array<Omit<RawDiscoveryCandidate, 'fetchedAt'>> = [
  {
    candidateId: 'cand_ichiko_tokyo_matinee_202612',
    officialEventId: 'evt_ichiko_20261212_day',
    subjectName: '青葉市子',
    disambiguationHint: 'クラシックギター・シンガーソングライター（Windswept Adan）',
    eventName: '弾き語りコンサート「Luminescent Creatures」昼公演',
    eventDate: '2026-12-12',
    startTime: '14:00',
    venue: '東京オペラシティ コンサートホール（東京）',
    region: '東京・関東',
    sourceTitle: 'ICHIKO AOBA Official Website | Concert Schedule（検証用参照データ）',
    sourceUrl: 'https://ichikoaoba.com/live/2026-12-12-day',
    curatorName: '青葉市子 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式スケジュール掲載（詳細は公式ページで確認）',
    recommendationReason:
      '静かなギターと室内楽の響きをホールで味わえる公式発表の単独公演です。',
  },
  {
    candidateId: 'cand_ichiko_tokyo_evening_202612',
    officialEventId: 'evt_ichiko_20261212_night',
    subjectName: '青葉市子',
    disambiguationHint: 'クラシックギター・シンガーソングライター（Windswept Adan）',
    eventName: '弾き語りコンサート「Luminescent Creatures」夜公演',
    eventDate: '2026-12-12',
    startTime: '18:30',
    venue: '東京オペラシティ コンサートホール（東京）',
    region: '東京・関東',
    sourceTitle: 'ICHIKO AOBA Official Website | Concert Schedule（検証用参照データ）',
    sourceUrl: 'https://ichikoaoba.com/live/2026-12-12-night',
    curatorName: '青葉市子 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '同日夜公演（昼公演とは別枠）',
    recommendationReason: '同日18:30開演の夜公演枠です。',
  },
  {
    candidateId: 'cand_ichiko_kyoto_202612',
    officialEventId: 'evt_ichiko_20261220_kyoto',
    subjectName: '青葉市子',
    disambiguationHint: 'クラシックギター・シンガーソングライター（Windswept Adan）',
    eventName: '冬の京都 独奏会',
    eventDate: '2026-12-20',
    startTime: '17:00',
    venue: 'ロームシアター京都 サウスホール（京都）',
    region: '京都・関西',
    sourceTitle: 'ICHIKO AOBA Official Website | Kyoto Schedule（検証用参照データ）',
    sourceUrl: 'https://ichikoaoba.com/live/2026-12-20-kyoto',
    curatorName: '青葉市子 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式スケジュール掲載',
    recommendationReason: '関西エリアで開催される年末の独奏会です。',
  },
  {
    candidateId: 'cand_kaneko_tokyo_202611',
    officialEventId: 'evt_kaneko_20261128_budokan',
    subjectName: 'カネコアヤノ',
    disambiguationHint: 'シンガーソングライター・バンドセット（タオルケットは穏やかな）',
    eventName: '単独演奏会「燦々」特別公演',
    eventDate: '2026-11-28',
    startTime: '18:00',
    venue: '日本武道館（東京）',
    region: '東京・関東',
    sourceTitle: 'カネコアヤノ Official Site | LIVE INFO（検証用参照データ）',
    sourceUrl: 'https://kanekoayano.net/live/2026-11-28',
    curatorName: 'カネコアヤノ 公式サイト & POPEYE Web 音楽連載紹介',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式発表済み',
    recommendationReason:
      '本人が確認したアーティストの公式ライブ情報と、カルチャー誌編集部の推薦記事が一致した公演です。',
  },
  {
    candidateId: 'cand_quruli_kyoto_202612',
    officialEventId: 'evt_quruli_20261205_kyoto',
    subjectName: 'くるり',
    disambiguationHint: '京都出身のロックバンド（岸田繁・佐藤征史）',
    eventName: '京都音楽博覧会 アフターセッション',
    eventDate: '2026-12-05',
    startTime: '17:30',
    venue: '京都磔磔（京都・関西）',
    region: '京都・関西',
    sourceTitle: 'くるり / QURULI Official Website（検証用参照データ）',
    sourceUrl: 'https://www.quruli.net/live/2026-12-05',
    curatorName: 'くるり 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式発表済み',
    recommendationReason: '京都の老舗ライブハウスで開催される公式発表ライブです。',
  },
  {
    candidateId: 'cand_design_exhibition_tokyo_202611',
    officialEventId: 'evt_design_2121_202611',
    subjectName: '佐藤卓',
    disambiguationHint: 'グラフィックデザイナー（デザインあ・21_21 DESIGN SIGHT）',
    eventName: '企画展「デザインの観察と余白」ギャラリーツアー',
    eventDate: '2026-11-22',
    startTime: '15:00',
    venue: '21_21 DESIGN SIGHT（東京・六本木）',
    region: '東京・関東',
    sourceTitle: 'Casa BRUTUS 編集部キュレーション & 21_21 公式（検証用参照データ）',
    sourceUrl: 'https://www.2121designsight.jp/program/observation-2026',
    curatorName: '21_21 DESIGN SIGHT 公式 / デザイン誌編集部選',
    curatorType: 'editor_magazine',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '会期中・公式ページ案内あり',
    recommendationReason:
      '信頼する編集媒体が推薦し、会場公式サイトで開催日時が確認できた展示イベントです。',
  },
  // S04 検証用：公式未確認の噂ブログ（verifyAndRankDiscoveryCandidates で必ず除外される）
  {
    candidateId: 'cand_unverified_rumor',
    subjectName: '青葉市子',
    eventName: '【未確認】シークレット路上ライブの噂',
    eventDate: '2026-12-24',
    venue: '場所未定（東京）',
    region: '東京・関東',
    sourceTitle: '非公式まとめブログ',
    sourceUrl: 'https://unverified-rumor-blog.example.com/post/1',
    curatorName: '匿名まとめサイト',
    curatorType: 'verified_api',
    officialVerified: false,
    termsPermitted: true,
    eventStatus: 'scheduled',
    recommendationReason: 'SNSの噂まとめ（公式未確認）',
  },
];

export class CuratedReferenceSearchAdapter implements DiscoverySearchAdapter {
  public callCount = 0;
  public lastQueries: string[] = [];

  async searchConcertsAndCuratedEvents(params: {
    query: string;
    subjectName: string;
    regionPreference: string;
    nowMs: number;
  }): Promise<DiscoverySearchAdapterResult> {
    this.callCount += 1;
    this.lastQueries.push(params.query);

    const normSubject = params.subjectName.trim().toLowerCase();
    const matched = CURATED_REFERENCE_CATALOG.filter(
      (item) =>
        item.subjectName.trim().toLowerCase() === normSubject ||
        params.query.toLowerCase().includes(item.subjectName.trim().toLowerCase())
    ).map((item) => ({
      ...item,
      fetchedAt: params.nowMs,
    }));

    // 実際にアダプタが取得した公式・編集媒体のURLのみを許可リストとして返す（AIの架空URL生成を防ぐ）
    const allowedSourceUrls = matched
      .filter((m) => m.officialVerified)
      .map((m) => m.sourceUrl);

    return {
      adapterMode: 'curated_reference_fixture',
      allowedSourceUrls,
      candidates: matched,
      externalCallExecuted: true,
    };
  }
}
