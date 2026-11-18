import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, call, twala, type Account, type Status } from './api';
import { ApiLogDrawer } from './components/ApiLogDrawer';
import { ErrorNotice } from './components/ErrorNotice';
import { StatusBar } from './components/StatusBar';
import { takeReturnEvent } from './returnEvent';
import { AccountSection } from './sections/Account';
import { DocumentsSection } from './sections/Documents';
import { EmbeddedSendingSection, EmbeddedSigningSection } from './sections/Embedded';
import { EnvelopesSection } from './sections/Envelopes';
import { EventsSection } from './sections/Events';
import { FieldsSection } from './sections/Fields';
import { HistorySection } from './sections/History';
import { NudgesSection } from './sections/Nudges';
import { RecipientsSection } from './sections/Recipients';
import { TemplatesSection } from './sections/Templates';
import { TimestampsSection } from './sections/Timestamps';
import { onStream } from './stream';
import { AppContext } from './ui';

const SECTIONS: { id: string; name: string; render: (webhooks: boolean) => ReactNode }[] = [
  { id: 'account', name: 'Account', render: () => <AccountSection /> },
  { id: 'envelopes', name: 'Envelopes', render: () => <EnvelopesSection /> },
  { id: 'recipients', name: 'Recipients', render: () => <RecipientsSection /> },
  { id: 'documents', name: 'Documents', render: () => <DocumentsSection /> },
  { id: 'fields', name: 'Fields', render: () => <FieldsSection /> },
  { id: 'templates', name: 'Templates', render: () => <TemplatesSection /> },
  { id: 'sending', name: 'Embedded sending', render: () => <EmbeddedSendingSection /> },
  { id: 'signing', name: 'Embedded signing', render: () => <EmbeddedSigningSection /> },
  { id: 'nudges', name: 'Reminders and sealing', render: () => <NudgesSection /> },
  { id: 'history', name: 'Audit trail and form data', render: () => <HistorySection /> },
  { id: 'timestamps', name: 'Timestamps', render: () => <TimestampsSection /> },
  { id: 'events', name: 'Events and webhooks', render: (webhooks) => <EventsSection webhooks={webhooks} /> },
];

const returned = takeReturnEvent();
const params = new URLSearchParams(window.location.search);
const STORED = 'showcase.envelopeId';
const stored = () => {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
};

export function App() {
  const [section, setSection] = useState(() => SECTIONS.find((s) => s.id === params.get('section'))?.id ?? 'account');
  const [status, setStatus] = useState<Status | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState<unknown>(null);
  const [envelopeId, setEnvelopeId] = useState<string | null>(returned?.envelopeId || stored());
  const [banner, setBanner] = useState(returned);
  const [version, setVersion] = useState(0);

  const refreshAccount = useCallback(() => {
    setAccountError(null);
    api<Status>('/api/status').then(setStatus, () => setStatus(null));
    call(twala.GET('/account')).then(setAccount, setAccountError);
  }, []);
  useEffect(refreshAccount, [refreshAccount]);

  const go = useCallback((id: string) => {
    setSection(id);
    window.history.replaceState(null, '', `/?section=${id}`);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => window.history.replaceState(null, '', `/?section=${section}`), []);

  const selectEnvelope = useCallback((id: string | null) => {
    setEnvelopeId(id);
    try {
      if (id) localStorage.setItem(STORED, id);
      else localStorage.removeItem(STORED);
    } catch {}
  }, []);
  // Forget a remembered envelope that this key can't see, e.g. after switching accounts.
  useEffect(() => {
    if (envelopeId) twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } }).then(({ response }) => response.status === 404 && selectEnvelope(null));
  }, []);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => onStream((event) => event.type === 'webhook' && (changed(), refreshAccount())), [changed, refreshAccount]);

  const current = SECTIONS.find((s) => s.id === section)!;
  return (
    <AppContext.Provider value={{ account, refreshAccount, envelopeId, selectEnvelope, go, version, changed }}>
      <div className="shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">T</span>Twala API showcase</div>
          {account?.mode === 'test' && (
            <span className="muted small">
              Test usage today: {account.limits.testEnvelopesToday}/{account.limits.testEnvelopesPerDay} envelopes · {account.limits.testTimestampsToday}/{account.limits.testTimestampsPerDay} timestamps
            </span>
          )}
          <StatusBar status={status} accountError={accountError} onRefresh={refreshAccount} />
        </header>
        <div className="layout">
          <nav className="sidebar">
            {SECTIONS.map((s) => (
              <button key={s.id} className={`nav ${s.id === section ? 'nav-on' : ''}`} onClick={() => go(s.id)}>{s.name}</button>
            ))}
          </nav>
          <main className="content">
            {banner && (
              <div className={`notice notice-${banner.tone} banner`}>
                <span>{banner.message} <span className="muted small">event={banner.event}</span></span>
                <button className="link" onClick={() => setBanner(null)}>Dismiss</button>
              </div>
            )}
            {account ? current.render(!!status?.webhooks) : <ErrorNotice error={accountError} />}
            {!account && !accountError && <p className="muted">Connecting to Twala…</p>}
          </main>
        </div>
        <ApiLogDrawer />
      </div>
    </AppContext.Provider>
  );
}
