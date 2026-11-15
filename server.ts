import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { getDb, IS_DEMO_MODE } from './server/db';
import { ensureSeeded } from './server/seed';
import { registerCoreRoutes } from './server/routes';
import { registerModuleRoutes } from './server/routes_modules';
import { recordSystemError, requireSafeOrigin } from './server/security';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Initialize database & deterministic seeding
  const db = getDb();
  ensureSeeded(db);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Serve public uploaded static assets (like the official DPBI logo)
  app.use('/assets', express.static(path.resolve(process.cwd(), 'public', 'assets')));

  // CSRF / Origin validation for state-changing API requests
  app.use('/api', requireSafeOrigin);

  // Register API Routes
  registerCoreRoutes(app);
  registerModuleRoutes(app);

  // API 404 handler (prevent falling through to HTML for unknown /api/* calls)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.', code: 404 });
  });

  // Safe global API error handler (never expose stack trace or DB details)
  app.use('/api', (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const refId = recordSystemError(db, 500, req.originalUrl, err);
    res.status(500).json({
      error: 'Terjadi kesalahan internal pada layanan. Hubungi pengelola dengan menyertakan kode referensi.',
      code: 500,
      referenceId: refId,
    });
  });

  // Frontend middleware (Vite in dev, static dist in production)
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      try {
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[SATU DPBI] Server berjalan pada port ${PORT} | Mode: ${IS_DEMO_MODE ? 'DEMO_SIMULASI' : 'PRODUKSI'}`
    );
  });
}

startServer().catch((err) => {
  console.error('[SATU DPBI] Gagal memulai server:', err);
  process.exit(1);
});
