import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { call, twala, type Account, type Envelope } from './api';
import { ErrorNotice } from './components/ErrorNotice';
import { dateTime, label, STATUS_TONE } from './format';

export interface AppState {
  account: Account | null;
  refreshAccount: () => void;
  envelopeId: string | null;
  selectEnvelope: (id: string | null) => void;
  go: (section: string) => void;
  version: number;
  changed: () => void;
}

export const AppContext = createContext<AppState>(null!);
export const useApp = () => useContext(AppContext);

export function Section({ title, intro, calls, limits, children }: { title: string; intro: string; calls: string[]; limits?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h1>{title}</h1>
        <p className="muted">{intro}</p>
        <div className="calls">
          {calls.map((c) => <code key={c} className="call">{c}</code>)}
        </div>
        {limits && <p className="notice notice-warn small">Test key: {limits}</p>}
      </header>
      {children}
    </section>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="head-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// Runs one API action at a time, keeping its error for display.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, []);
  return { run, busy, error, setError };
}

export const Status = ({ value }: { value: string }) => <span className={`pill ${STATUS_TONE[value] ?? ''}`}>{label(value)}</span>;

// Loads whenever `deps` change and exposes a reload.
export function useLoad<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reload = useCallback(() => {
    if (!load) return setData(null);
    setError(null);
    load().then(setData, setError);
  }, deps);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

// The envelope that the per-envelope sections work on.
export function EnvelopePicker({ filter, hint }: { filter?: (e: Envelope) => boolean; hint?: string }) {
  const { envelopeId, selectEnvelope, version } = useApp();
  const { data, error, reload } = useLoad(() => call(twala.GET('/envelopes', { params: { query: { limit: 50 } } })), [version]);
  const items = (data?.items ?? []).filter((e) => !filter || filter(e) || e.envelopeId === envelopeId);
  return (
    <Card>
      <div className="picker">
        <label className="field grow">
          <span>Envelope {hint && <span className="muted">· {hint}</span>}</span>
          <select value={envelopeId ?? ''} onChange={(e) => selectEnvelope(e.target.value || null)}>
            <option value="">Choose an envelope…</option>
            {items.map((e) => (
              <option key={e.envelopeId} value={e.envelopeId}>
                {e.name ?? 'Untitled'} · {label(e.status)} · {dateTime(e.createdAt)}
              </option>
            ))}
          </select>
        </label>
        <button className="link" onClick={reload}>Refresh</button>
      </div>
      {data && items.length === 0 && <p className="muted small">No envelopes yet. Create one in Envelopes.</p>}
      <ErrorNotice error={error} />
    </Card>
  );
}

// Twala's links are served as attachments, so following one downloads the file and keeps this page.
export const download = (url: string) => window.location.assign(url);

export const randomId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
