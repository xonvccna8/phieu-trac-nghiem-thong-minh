import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { normalizeWordImport } from './server/wordImportAi';
import { solveQuestionWithAI } from './server/aiSolveService';

function aiWordImportDevApi() {
  return {
    name: 'ai-word-import-dev-api',
    configureServer(server: any) {
      const readJsonBody = async (req: any) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      };

      const setJsonHeaders = (res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
      };

      server.middlewares.use('/api/normalize-word', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = await readJsonBody(req);
          const result = await normalizeWordImport(body);

          res.statusCode = 200;
          setJsonHeaders(res);
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          setJsonHeaders(res);
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Không thể chuẩn hóa file Word bằng AI.',
          }));
        }
      });

      server.middlewares.use('/api/solve-question', async (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = await readJsonBody(req);
          const result = await solveQuestionWithAI(body);

          res.statusCode = 200;
          setJsonHeaders(res);
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          setJsonHeaders(res);
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Không thể dùng AI để giải câu hỏi này.',
          }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aiWordImportDevApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
