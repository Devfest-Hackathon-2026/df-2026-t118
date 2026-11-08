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

// 検証・PoC 用の固定データセット。外部 API は呼ばない（adapterMode: 'curated_reference_fixture'）。
//
// ここに出てくる人物・団体・会場・媒体・URL は **すべて架空** で、実在のものとは関係ない。
// 実在の人物について実在しない公演を「公式確認済み」として表示すると、デモが偽装になり、
// 当人にも迷惑がかかる。URL はすべて example.com 配下にしてあり、実在しないことが分かるようにしている。
const CURATED_REFERENCE_CATALOG: Array<Omit<RawDiscoveryCandidate, 'fetchedAt'>> = [
  {
    candidateId: 'cand_demo_kotone_tokyo_matinee_202612',
    officialEventId: 'evt_demo_kotone_20261212_day',
    subjectName: '蒼井ことね',
    disambiguationHint: 'クラシックギター・シンガーソングライター（潮の記譜）',
    eventName: '弾き語りコンサート「Lantern Field」昼公演',
    eventDate: '2026-12-12',
    startTime: '14:00',
    venue: 'みなと市民ホール 大ホール（東京）',
    region: '東京・関東',
    sourceTitle: 'ICHIKO AOBA Official Website | Concert Schedule（検証用参照データ）',
    sourceUrl: 'https://example.com/aoi-kotone/live/2026-12-12-day',
    curatorName: '蒼井ことね 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式スケジュール掲載（詳細は公式ページで確認）',
    recommendationReason:
      '静かなギターと室内楽の響きをホールで味わえる公式発表の単独公演です。',
  },
  {
    candidateId: 'cand_demo_kotone_tokyo_evening_202612',
    officialEventId: 'evt_demo_kotone_20261212_night',
    subjectName: '蒼井ことね',
    disambiguationHint: 'クラシックギター・シンガーソングライター（潮の記譜）',
    eventName: '弾き語りコンサート「Lantern Field」夜公演',
    eventDate: '2026-12-12',
    startTime: '18:30',
    venue: 'みなと市民ホール 大ホール（東京）',
    region: '東京・関東',
    sourceTitle: 'ICHIKO AOBA Official Website | Concert Schedule（検証用参照データ）',
    sourceUrl: 'https://example.com/aoi-kotone/live/2026-12-12-night',
    curatorName: '蒼井ことね 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '同日夜公演（昼公演とは別枠）',
    recommendationReason: '同日18:30開演の夜公演枠です。',
  },
  {
    candidateId: 'cand_demo_kotone_kyoto_202612',
    officialEventId: 'evt_demo_kotone_20261220_kyoto',
    subjectName: '蒼井ことね',
    disambiguationHint: 'クラシックギター・シンガーソングライター（潮の記譜）',
    eventName: '冬の京都 独奏会',
    eventDate: '2026-12-20',
    startTime: '17:00',
    venue: '西京シアター 小ホール（京都）',
    region: '京都・関西',
    sourceTitle: 'ICHIKO AOBA Official Website | Kyoto Schedule（検証用参照データ）',
    sourceUrl: 'https://example.com/aoi-kotone/live/2026-12-20-kyoto',
    curatorName: '蒼井ことね 公式インフォメーション',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式スケジュール掲載',
    recommendationReason: '関西エリアで開催される年末の独奏会です。',
  },
  {
    candidateId: 'cand_demo_ayano_tokyo_202611',
    officialEventId: 'evt_demo_ayano_20261128_budokan',
    subjectName: '綾野かなえ',
    disambiguationHint: 'シンガーソングライター・バンドセット（タオルケットは穏やかな）',
    eventName: '単独演奏会「陽だまり」特別公演',
    eventDate: '2026-11-28',
    startTime: '18:00',
    venue: 'みずべアリーナ（東京）',
    region: '東京・関東',
    sourceTitle: '綾野かなえ Official Site | LIVE INFO（検証用参照データ）',
    sourceUrl: 'https://example.com/ayano-kanae/live/2026-11-28',
    curatorName: '綾野かなえ 公式サイト & 『まち本』音楽連載紹介',
    curatorType: 'artist_official',
    officialVerified: true,
    termsPermitted: true,
    eventStatus: 'scheduled',
    priceOrStatusNote: '公式発表済み',
    recommendationReason:
      '本人が確認したアーティストの公式ライブ情報と、カルチャー誌編集部の推薦記事が一致した公演です。',
  },
  {
    candidateId: 'cand_demo_harukaze_kyoto_202612',
    officialEventId: 'evt_demo_harukaze_20261205_kyoto',
    subjectName: 'ハルカゼ楽団',
    disambiguationHint: '京都出身のロックバンド（岸田繁・佐藤征史）',
    eventName: '西京まちなか音楽祭 アフターセッション',
    eventDate: '2026-12-05',
    startTime: '17:30',
    venue: 'ライブハウス月見草（京都・関西）',
    region: '京都・関西',
    sourceTitle: 'ハルカゼ楽団 / QURULI Official Website（検証用参照データ）',
    sourceUrl: 'https://example.com/harukaze/live/2026-12-05',
    curatorName: 'ハルカゼ楽団 公式インフォメーション',
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
    subjectName: '榊原たく',
    disambiguationHint: 'グラフィックデザイナー（デザインあ・まちかどデザインミュージアム）',
    eventName: '企画展「日用品の観察と余白」ギャラリーツアー',
    eventDate: '2026-11-22',
    startTime: '15:00',
    venue: 'まちかどデザインミュージアム（東京・六本木）',
    region: '東京・関東',
    sourceTitle: '架空のデザイン誌『まち本』編集部キュレーション & まちかどデザインミュージアム 公式（検証用参照データ）',
    sourceUrl: 'https://example.com/machikado-museum/program/observation-2026',
    curatorName: 'まちかどデザインミュージアム 公式 / 架空のデザイン誌編集部選',
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
    subjectName: '蒼井ことね',
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
