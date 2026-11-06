import { deterministicFallbackEmbedding } from '../domain/clustering.js';

// Gemini REST API を直接または Genkit 経由で呼び出す共通アダプタ
export async function callGeminiJson<T>(params: {
  apiKey?: string;
  systemInstruction: string;
  userPrompt: string;
  imageDataUrl?: string;
  responseSchema: Record<string, unknown>;
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: params.systemInstruction }],
        },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Gemini Embedding API (text-embedding-004) で 768 次元のベクトルを取得する。
// API キー未設定時やオフライン時は、文字 N-gram から決定論的ベクトルを生成してクラスタリングが動くようにする。
export async function computeEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (key) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { embedding?: { values?: number[] } };
        if (data.embedding?.values && data.embedding.values.length > 0) {
          return data.embedding.values;
        }
      }
    } catch {
      // フォールバックへ進む
    }
  }
  return deterministicFallbackEmbedding(text, 64);
}
