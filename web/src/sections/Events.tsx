import { useEffect, useState } from 'react';
import { api, call, twala, type TwalaEvent } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { Json } from '../components/ApiLogDrawer';
import { dateTime } from '../format';
import { onStream } from '../stream';
import { Card, Section, useApp, useLoad } from '../ui';

export function EventsSection({ webhooks }: { webhooks: boolean }) {
  const { version } = useApp();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<TwalaEvent | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const list = useLoad(() => call(twala.GET('/events', { params: { query: { type: type || undefined, page, limit: 20 } } })), [type, page, version]);
  const received = useLoad(() => api<string[]>('/api/webhooks/received'), [version]);
  useEffect(() => onStream((e) => e.type === 'webhook' && (list.reload(), received.reload())), [list.reload, received.reload]);

  const toggle = (id: string) => {
    setOpenError(null);
    if (open?.id === id) return setOpen(null);
    call(twala.GET('/events/{event_id}', { params: { path: { event_id: id } } })).then(setOpen, setOpenError);
  };

  return (
    <Section
      title="Events and webhooks"
      intro="Everything that happens to your envelopes and timestamps is an event. Read them from the events feed, or receive them as webhooks."
      calls={['GET /events', 'GET /events/{id}', 'POST /webhooks/twala (received)']}
      limits="webhooks need a public HTTPS address; run the tunnel and add the endpoint in Twala in Test mode (see README). The feed keeps 30 days."
    >
      <Card title="Webhooks">
        {webhooks
          ? <p className="notice notice-ok small">Receiving webhooks. Each is verified with TWALA_WEBHOOK_SECRET; new events refresh this page as they arrive. {received.data?.length ?? 0} received since the server started.</p>
          : <p className="notice small">Webhooks are off. Set TWALA_WEBHOOK_SECRET to turn them on. The events feed below works without them.</p>}
      </Card>
      <Card title="Events" actions={<button className="link" onClick={list.reload}>Refresh</button>}>
        <div className="inline-form">
          <input placeholder="Filter by type, e.g. envelope.sent" value={type} onChange={(e) => (setType(e.target.value.trim()), setPage(1))} />
        </div>
        <ErrorNotice error={list.error ?? openError} />
        {list.data?.items.length === 0 && <p className="muted">No events.</p>}
        <div className="rows">
          {list.data?.items.map((e) => {
            const subject = (e.data.recipient as { name?: string } | undefined)?.name ?? (e.data.envelope as { name?: string } | undefined)?.name ?? (e.data.timestamp as { name?: string } | undefined)?.name;
            const got = received.data?.includes(e.id);
            return (
              <div key={e.id}>
                <button className={`row ${open?.id === e.id ? 'row-on' : ''}`} onClick={() => toggle(e.id)}>
                  <span><strong>{e.type}</strong>{subject && <span className="muted small"> · {subject}</span>}</span>
                  <span className="muted small">{dateTime(e.createdAt)}</span>
                  {webhooks ? <span className={`pill ${got ? 'pill-ok' : ''}`}>{got ? 'Webhook received' : 'No webhook'}</span> : <span />}
                </button>
                {open?.id === e.id && <div className="event-body"><Json value={open} /></div>}
              </div>
            );
          })}
        </div>
        {list.data && list.data.pages > 1 && (
          <div className="actions">
            <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="muted small">Page {list.data.page} of {list.data.pages}</span>
            <button className="btn" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </Card>
    </Section>
  );
}
