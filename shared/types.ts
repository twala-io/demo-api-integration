import type { components } from '../server/src/twala/schema.js';

type Schemas = components['schemas'];

export type Account = Schemas['AccountOutput'];
export type Envelope = Schemas['EnvelopeOutput'];
export type EnvelopeUpdate = Schemas['EnvelopeUpdateInput'];
export type Recipient = Schemas['RecipientOutput'];
export type Document = Schemas['DocumentOutput'];
export type Field = Schemas['FieldOutput'];
export type FieldInput = Schemas['FieldsReplaceInput']['fields'][number];
export type SignerInput = Schemas['SignerInput'];
export type Template = Schemas['TemplateOutput'];
export type TemplateRole = Schemas['TemplateRoleOutput'];
export type Timestamp = Schemas['TimestampOutput'];
export type TwalaEvent = Schemas['EventOutput'];

export interface ApiLogEntry {
  id: number;
  startedAt: string;
  durationMs: number;
  method: string;
  url: string;
  path: string;
  attempt: number;
  idempotencyKey: string | null;
  requestBody: unknown;
  status: number | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  errorCode: string | null;
  networkError: string | null;
}

export type LogEvent = { type: 'entry'; entry: ApiLogEntry } | { type: 'clear' } | { type: 'webhook'; event: TwalaEvent };

export interface Status {
  apiBase: string;
  keyMode: 'test' | 'live' | 'missing' | 'malformed';
  key: string | undefined;
  webhooks: boolean;
}
