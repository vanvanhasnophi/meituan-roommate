import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * 本地开发时直接在 Vite 中间件里跑 Serverless 函数，
 * 让 `npm run dev` 与线上行为一致（同一份 api/*.ts 代码，无需 vercel dev）。
 *
 *   - /api/**        交给 api/household.ts 处理
 *   - /room-mate     回退到 index.html（等价于 vercel.json 的 rewrite）
 */
function localPlatformPlugin(): Plugin {
  return {
    name: 'tongwu-local-platform',
    configureServer(server) {
      // 这些中间件会先于 Vite 内部中间件执行
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/room-mate' || url.pathname.startsWith('/room-mate/')) {
          req.url = '/index.html';
        }
        next();
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const query = Object.fromEntries(url.searchParams.entries());

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');

        const writable = res as typeof res & {
          status: (code: number) => typeof res;
          json: (payload: unknown) => typeof res;
        };
        writable.status = (code: number) => {
          res.statusCode = code;
          return res;
        };
        writable.json = (payload: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
          return res;
        };

        try {
          const mod = await server.ssrLoadModule('/api/household.ts');
          await mod.default(
            {
              method: req.method,
              query,
              body: raw ? JSON.parse(raw) : undefined,
              headers: req.headers,
            },
            res,
          );
        } catch (err) {
          server.config.logger.error(`[api] ${String(err)}`);
          res.statusCode = 500;
          writable.json({ ok: false, error: String(err) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localPlatformPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
