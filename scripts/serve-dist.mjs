/**
 * 本地生产预览服务器：尽量复刻 Vercel 的行为，用于上线前自检。
 *
 *   - 静态托管 dist/，未知路径回退 index.html
 *   - /room-mate 与 /room-mate/** 重写到 index.html（对应 vercel.json 的 rewrite）
 *   - / 302 跳转到 /room-mate（对应 vercel.json 的 redirect）
 *   - /api/household 交由 api/household.ts 处理（用 esbuild 打包后载入）
 *
 * 用法：npm run build && node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** 打包并载入 Serverless handler（与 Vercel 的打包方式一致） */
async function loadApiHandler() {
  const out = join(ROOT, '.tmp', 'api-bundle.mjs');
  await esbuild.build({
    entryPoints: [join(ROOT, 'api', 'household.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: out,
    external: ['@libsql/client'],
    logLevel: 'warning',
  });
  const mod = await import(`${out}?t=${Date.now()}`);
  return mod.default;
}

/** 把 node 的 req/res 适配成 Vercel 风格，直接复用线上 handler */
function adapt(res) {
  const original = {
    statusCode: res.statusCode,
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
    return res;
  };
  return original;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const handler = await loadApiHandler();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    adapt(res);
    const query = Object.fromEntries(url.searchParams.entries());
    const body = req.method === 'PUT' || req.method === 'POST' ? await readBody(req) : undefined;
    try {
      await handler({ method: req.method, query, body, headers: req.headers }, res);
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  if (url.pathname === '/') {
    res.statusCode = 302;
    res.setHeader('Location', '/room-mate');
    res.end();
    return;
  }

  // vercel.json：/room-mate 与 /room-mate/** 重写到 index.html
  let filePath = join(DIST, url.pathname);
  if (url.pathname === '/room-mate' || url.pathname.startsWith('/room-mate/')) {
    filePath = join(DIST, 'index.html');
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.end(data);
  } catch {
    try {
      const html = await readFile(join(DIST, 'index.html'));
      res.setHeader('Content-Type', MIME['.html']);
      res.end(html);
    } catch {
      res.statusCode = 404;
      res.end('Not Found — 请先执行 npm run build');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  同屋 · 合租生活管家（生产预览）`);
  console.log(`  应用入口   http://localhost:${PORT}/room-mate`);
  console.log(`  API        http://localhost:${PORT}/api/household?code=ROOM-5283`);
  console.log(`  存储驱动   ${process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL ? 'SQLite (libSQL)' : '内存 + 浏览器本地'}\n`);
});
