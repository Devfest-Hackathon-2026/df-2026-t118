import { deterministicFallbackEmbedding } from '../domain/clustering.js';

// Gemini の JSON レスポンス文字列から Markdown コードフェンス等を除去して安全にパースする
export function parseJsonSafely<T>(rawText: string): T | null {
  if (!rawText) return null;
  const trimmed = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// 生成に使うモデル。先頭から順に試す。
// gemini-2.5-flash / gemini-2.0-flash は「no longer available to new users」で 404 になり、
// 本番で全リクエストが黙ってフォールバックに落ちていたため差し替えた。
// 2 番目の gemini-flash-latest は常に最新の flash を指すエイリアスで、同じ事故の再発を防ぐための保険。
const GENERATION_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'] as const;

// 埋め込みモデル。embedContent は v1 のみで提供されており、v1beta では 404 になる。
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

// 失敗を黙って握りつぶすと、本番で AI が動いていないことに気づけない。理由だけ残す（APIキーは出さない）。
function warnGeminiFailure(stage: string, detail: string) {
  console.warn(`[gemini] ${stage} に失敗しました: ${detail}`);
}

// Gemini REST API をタイムアウト制御・モデルフォールバック付きで呼び出す共通アダプタ
export async function callGeminiJson<T>(params: {
  apiKey?: string;
  systemInstruction: string;
  userPrompt: string;
  imageDataUrl?: string;
  responseSchema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T | null> {
  const key = params.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!key) return null;

  const parts: Array<Record<string, unknown>> = [{ text: params.userPrompt }];
  if (params.imageDataUrl && params.imageDataUrl.startsWith('data:image/')) {
    const commaIdx = params.imageDataUrl.indexOf(',');
    const meta = params.imageDataUrl.slice(5, commaIdx);
    const mimeType = meta.split(';')[0] || 'image/png';
    const data = params.imageDataUrl.slice(commaIdx + 1);
    if (data) {
      parts.unshift({
        inlineData: {
          mimeType,
          data,
        },
      });
    }
  }

  const timeoutMs = params.timeoutMs ?? 8000;

  for (const model of GENERATION_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemInstruction }],
          },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: params.temperature ?? 0.35,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        warnGeminiFailure(`生成（${model}）`, `HTTP ${res.status} ${body.slice(0, 200)}`);
        continue;
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      // 思考を返すモデルは parts[0] が text を持たないことがあるため、text を持つ最初の part を使う
      const text = json.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      const parsed = text ? parseJsonSafely<T>(text) : null;
      if (parsed) return parsed;
      warnGeminiFailure(`生成（${model}）`, 'レスポンスを JSON として解釈できませんでした');
    } catch (err) {
      clearTimeout(timer);
      warnGeminiFailure(
        `生成（${model}）`,
        err instanceof Error ? err.message : 'ネットワークまたはタイムアウト'
      );
    }
  }

  warnGeminiFailure('生成', 'すべてのモデルで失敗したため、ルールベースの結果を返します');
  return null;
}

// Gemini Embedding API で 768 次元のベクトルを取得する。
// API キー未設定時やオフライン時は、セマンティック概念＋文字 N-gram から決定論的ベクトルを生成してクラスタリングが動くようにする。
export async function computeEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: EMBEDDING_DIMENSIONS,
          content: { parts: [{ text }] },
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { embedding?: { values?: number[] } };
        if (data.embedding?.values && data.embedding.values.length > 0) {
          return data.embedding.values;
        }
        warnGeminiFailure('埋め込み', 'レスポンスにベクトルが含まれていませんでした');
      } else {
        const body = await res.text().catch(() => '');
        warnGeminiFailure('埋め込み', `HTTP ${res.status} ${body.slice(0, 200)}`);
      }
    } catch (err) {
      clearTimeout(timer);
      warnGeminiFailure(
        '埋め込み',
        err instanceof Error ? err.message : 'ネットワークまたはタイムアウト'
      );
    }
  }
  return deterministicFallbackEmbedding(text, 64);
}
