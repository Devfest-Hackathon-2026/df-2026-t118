// Cloud Functions のエントリポイント。
// ここから export したものは firebase-functions のローダーが「デプロイ対象のトリガー」として
// 解析する。Genkit のインスタンス（ai）や defineFlow の戻り値を export すると、ローダーが
// それらを解析しようとして無限再帰に落ちる（RangeError: Maximum call stack size exceeded）。
// Flow は callableHandlers.js の読み込み時に定義されるため、再 export は不要。
export {
  analyzeItem,
  confirmItemIntent,
  nightOrganize,
  morningPropose,
  runDiscoveryCycle,
} from './presentation/callableHandlers.js';

export {
  scheduledNightOrganize,
  scheduledMorningPropose,
} from './presentation/scheduledHandlers.js';
