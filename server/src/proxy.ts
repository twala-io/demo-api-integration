import express, { Router } from 'express';
import { TwalaApiError, twalaFetch } from './twala/client.js';
import { config } from './config.js';

// Every operation in Twala's public API, and nothing else, may pass through.
const ID = '[^/]+';
const OPERATIONS = [
  'GET /account',
  'GET /envelopes',
  'POST /envelopes',
  'GET /envelopes/ID',
  'PATCH /envelopes/ID',
  'DELETE /envelopes/ID',
  'GET /envelopes/ID/documents',
  'POST /envelopes/ID/documents',
  'GET /envelopes/ID/documents/ID',
  'DELETE /envelopes/ID/documents/ID',
  'GET /envelopes/ID/recipients',
  'POST /envelopes/ID/recipients',
  'PATCH /envelopes/ID/recipients/ID',
  'DELETE /envelopes/ID/recipients/ID',
  'GET /envelopes/ID/recipients/ID/fields',
  'PUT /envelopes/ID/recipients/ID/fields',
  'GET /envelopes/ID/form-data',
  'GET /envelopes/ID/audit-events',
  'POST /envelopes/ID/reminders',
  'POST /envelopes/ID/sealing-attempts',
  'POST /envelopes/ID/views/recipient',
  'POST /envelopes/ID/views/sender',
  'GET /events',
  'GET /events/ID',
  'GET /templates',
  'GET /templates/ID',
  'POST /timestamps',
  'GET /timestamps',
  'GET /timestamps/ID',
  'GET /timestamps/ID/document',
  'GET /timestamps/ID/audit-events',
  'POST /timestamps/ID/sealing-attempts',
].map((op) => new RegExp(`^${op.replaceAll('ID', ID)}$`));

export const proxy = Router();

proxy.use(express.raw({ type: () => true, limit: '40mb' }), async (req, res) => {
  const path = req.path.replace(/\/+$/, '') || '/';
  if (!OPERATIONS.some((op) => op.test(`${req.method} ${path}`))) {
    return void res.status(404).json({ source: 'app', code: 'unknown_operation', message: `${req.method} ${path} is not a Twala API operation.` });
  }
  const hasBody = Buffer.isBuffer(req.body) && req.body.length > 0;
  try {
    const response = await twalaFetch(
      new Request(config.apiBase + req.url, {
        method: req.method,
        headers: hasBody ? { 'Content-Type': req.get('content-type') ?? 'application/json' } : {},
        body: hasBody ? req.body : undefined,
      }),
    );
    res.status(response.status).type(response.headers.get('content-type') ?? 'application/json');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    const message = err instanceof TwalaApiError ? err.message : String(err);
    res.status(502).json({ source: 'app', code: 'network_error', message });
  }
});
