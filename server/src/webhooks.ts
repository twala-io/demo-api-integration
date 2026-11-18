import express, { Router } from 'express';
import { Webhook } from 'standardwebhooks';
import type { TwalaEvent } from '../../shared/types.js';
import { publish } from './apiLog.js';
import { config } from './config.js';

export const received = new Set<string>();

export const webhooks = Router();

webhooks.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  if (!config.webhookSecret) return void res.status(503).json({ code: 'webhooks_not_configured' });
  let event: TwalaEvent;
  try {
    event = new Webhook(config.webhookSecret).verify(req.body, req.headers as Record<string, string>) as TwalaEvent;
  } catch {
    return void res.status(401).json({ code: 'invalid_signature' });
  }
  // Twala retries with the same webhook-id, so a repeat is acknowledged and ignored.
  if (!received.has(event.id)) {
    received.add(event.id);
    publish({ type: 'webhook', event });
  }
  res.status(204).end();
});
