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

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const timeoutMs = params.timeoutMs ?? 8000;

  for (const model of models) {
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
        continue;
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = text ? parseJsonSafely<T>(text) : null;
      if (parsed) return parsed;
    } catch {
      clearTimeout(timer);
    }
  }

  return null;
}

// Gemini Embedding API (text-embedding-004) で 768 次元のベクトルを取得する。
// API キー未設定時やオフライン時は、セマンティック概念＋文字 N-gram から決定論的ベクトルを生成してクラスタリングが動くようにする。
export async function computeEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          taskType: 'SEMANTIC_SIMILARITY',
          content: { parts: [{ text }] },
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { embedding?: { values?: number[] } };
        if (data.embedding?.values && data.embedding.values.length > 0) {
          return data.embedding.values;
        }
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return deterministicFallbackEmbedding(text, 64);
}
