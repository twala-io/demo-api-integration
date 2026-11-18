import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config.js';
import { clear, recent, subscribe } from './apiLog.js';
import { proxy } from './proxy.js';
import { received, webhooks } from './webhooks.js';
import type { Status } from '../../shared/types.js';

const app = express();
app.use('/webhooks/twala', webhooks);
// The browser calls Twala's own paths here; the server adds the key and logs the call.
app.use('/api/twala', proxy);

app.get('/api/status', (_req, res) => {
  res.json({ apiBase: config.apiBase, keyMode: config.keyMode, key: config.maskedKey, webhooks: !!config.webhookSecret } satisfies Status);
});

app.get('/api/webhooks/received', (_req, res) => {
  res.json([...received]);
});

app.get('/api/log', (_req, res) => {
  res.json(recent());
});

app.delete('/api/log', (_req, res) => {
  clear();
  res.status(204).end();
});

app.get('/api/log/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).flushHeaders();
  const unsubscribe = subscribe((event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// When the UI has been built (as in the Docker image), serve it from here too.
// In development Vite serves the UI and proxies /api to this server.
const webDist = resolve('web/dist');
if (existsSync(webDist)) app.use(express.static(webDist));

app.use(((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ source: 'app', code: 'internal_error', message: String(err?.message ?? err) });
}) satisfies ErrorRequestHandler);

app.listen(config.port, () => {
  console.log(`API showcase server on http://localhost:${config.port} → ${config.apiBase} (${config.keyMode} key)`);
});
