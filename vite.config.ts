import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  AnalyzeItemInputSchema,
  ConfirmIntentInputSchema,
  NightOrganizeInputSchema,
  MorningProposeInputSchema,
} from './functions/src/domain/schemas.js';
import {
  runAnalyzeItem,
  runConfirmItemIntent,
  runNightOrganize,
  runMorningPropose,
} from './functions/src/application/aiUseCases.js';
import { RunDiscoveryCycleInputSchema } from './functions/src/domain/proactiveDiscoverySchemas.js';
import { runProactiveDiscoveryCycle } from './functions/src/application/proactiveDiscoveryUseCases.js';

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // 10MB 上限（スクショ画像の Base64 送信用）
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ローカル開発時（npm run dev / preview）でも .env の GEMINI_API_KEY をクライアントに露出させず
// Cloud Functions と同じ AI パイプライン（F2/F3/F5/F6）を実行するミドルウェア。
export function createIslandApiHandler(apiKey?: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) {
      return next();
    }
    if (req.url === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        backend: 'vite-node-middleware',
        geminiConfigured: Boolean(apiKey),
        endpoints: [
          '/api/analyzeItem',
          '/api/confirmItemIntent',
          '/api/nightOrganize',
          '/api/morningPropose',
          '/api/runDiscoveryCycle',
        ],
      });
    }
    if (req.method !== 'POST') {
      return next();
    }
    try {
      const raw = await readJsonBody(req);
      // クライアントは onCall 互換で { data: ... } を送る。ここでは中身だけを取り出す。
      const body =
        raw && typeof raw === 'object' && 'data' in raw
          ? (raw as { data: unknown }).data
          : raw;
      if (req.url === '/api/analyzeItem') {
        const input = AnalyzeItemInputSchema.parse(body);
        const out = await runAnalyzeItem(input, apiKey);
        return sendJson(res, 200, out);
      }
      if (req.url === '/api/confirmItemIntent') {
        const input = ConfirmIntentInputSchema.parse(body);
        const out = await runConfirmItemIntent(input, apiKey);
        return sendJson(res, 200, out);
      }
      if (req.url === '/api/nightOrganize') {
        const input = NightOrganizeInputSchema.parse(body);
        const out = await runNightOrganize(input, apiKey);
        return sendJson(res, 200, out);
      }
      if (req.url === '/api/morningPropose') {
        const input = MorningProposeInputSchema.parse(body);
        const out = await runMorningPropose(input, apiKey);
        return sendJson(res, 200, out);
      }
      if (req.url === '/api/runDiscoveryCycle') {
        const input = RunDiscoveryCycleInputSchema.parse(body);
        const out = await runProactiveDiscoveryCycle(input);
        return sendJson(res, 200, out);
      }
      return sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      return sendJson(res, 400, { error: msg });
    }
  };
}

function islandApiPlugin(apiKey?: string): Plugin {
  const handler = createIslandApiHandler(apiKey);

  return {
    name: 'island-api-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  return {
    plugins: [react(), islandApiPlugin(apiKey)],
    build: {
      outDir: 'dist',
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
