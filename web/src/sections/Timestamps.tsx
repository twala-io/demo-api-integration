import { useEffect, useState } from 'react';
import { call, twala } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { dateTime, label } from '../format';
import { fileToBase64, samplePdf } from '../sample';
import { Card, download, Section, Status, useAction, useApp, useLoad } from '../ui';

function Detail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const path = { params: { path: { timestamp_id: id } } };
  const t = useLoad(() => call(twala.GET('/timestamps/{timestamp_id}', path)), [id]);
  const history = useLoad(() => call(twala.GET('/timestamps/{timestamp_id}/audit-events', path)), [id]);
  const { run, busy, error } = useAction();
  const reload = () => (t.reload(), history.reload(), onChanged());
  const d = t.data;
  if (!d) return <Card><ErrorNotice error={t.error} /></Card>;
  return (
    <Card title={d.name} actions={<Status value={d.status} />}>
      <p className="muted small mono">{d.timestampId}</p>
      <dl className="facts">
        <div><dt>Created</dt><dd>{dateTime(d.createdAt)}</dd></div>
        <div><dt>Completed</dt><dd>{dateTime(d.completedAt)}</dd></div>
        <div><dt>Size</dt><dd>{Math.ceil((d.sizeBytes ?? 0) / 1024)} KB</dd></div>
      </dl>
      <p className="small mono">SHA-256 {d.sha256 ?? 'not sealed yet'}</p>
      <div>
        <h4>History</h4>
        {history.data?.map((h, i) => (
          <div key={i} className="line"><span className="small">{label(h.action)}</span><span className="muted small">{dateTime(h.occurredAt)}</span></div>
        ))}
      </div>
      <ErrorNotice error={error ?? history.error} />
      <div className="actions">
        <button className="btn" disabled={busy || d.status !== 'completed'} onClick={() => run(async () => download((await call(twala.GET('/timestamps/{timestamp_id}/document', path))).url))}>Download sealed copy</button>
        <button className="btn" disabled={busy} onClick={() => run(async () => (await call(twala.POST('/timestamps/{timestamp_id}/sealing-attempts', path)), reload()))}>Retry sealing</button>
      </div>
    </Card>
  );
}

export function TimestampsSection() {
  const { refreshAccount, account } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const list = useLoad(() => call(twala.GET('/timestamps', { params: { query: { page, limit: 10 } } })), [page, tick]);
  const { run, busy, error } = useAction();
  const sealing = list.data?.items.some((t) => t.status === 'sealing');

  // Sealing runs in the background, so the list checks back while anything is still sealing.
  useEffect(() => {
    if (!sealing) return;
    const timer = setTimeout(() => setTick((n) => n + 1), 5000);
    return () => clearTimeout(timer);
  }, [sealing, list.data]);

  const upload = () =>
    run(async () => {
      const documents = files.length
        ? await Promise.all(files.map(async (f) => ({ name: f.name, documentBase64: await fileToBase64(f), metadata: { source: 'api-showcase' } })))
        : [{ name: 'Sample.pdf', documentBase64: await samplePdf('Timestamp sample', []), metadata: { source: 'api-showcase' } }];
      const created = await call(twala.POST('/timestamps', { body: { documents } }));
      setFiles([]);
      setSelected(created.timestamps[0]?.timestampId ?? null);
      setPage(1);
      setTick((n) => n + 1);
      refreshAccount();
    });

  return (
    <Section
      title="Timestamps"
      intro="Seal PDFs with a trusted timestamp to prove what a document was and when you had it. Sealing runs in the background."
      calls={['POST /timestamps', 'GET /timestamps', 'GET /timestamps/{id}', 'GET /timestamps/{id}/audit-events', 'GET /timestamps/{id}/document', 'POST /timestamps/{id}/sealing-attempts']}
      limits={`each document counts toward ${account?.limits.testTimestampsPerDay ?? 50} test timestamps a day. Retry only works after sealing failed.`}
    >
      <Card title="Timestamp documents">
        <div className="inline-form">
          <input type="file" accept="application/pdf" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <button className="btn btn-primary" disabled={busy} onClick={upload}>{files.length ? `Timestamp ${files.length} PDF${files.length > 1 ? 's' : ''}` : 'Timestamp a sample PDF'}</button>
        </div>
        <ErrorNotice error={error} />
      </Card>
      <div className="board">
        <Card title="Timestamps" actions={<button className="link" onClick={list.reload}>Refresh</button>}>
          <ErrorNotice error={list.error} />
          {list.data?.items.length === 0 && <p className="muted">No timestamps yet.</p>}
          <div className="rows">
            {list.data?.items.map((t) => (
              <button key={t.timestampId} className={`row ${selected === t.timestampId ? 'row-on' : ''}`} onClick={() => setSelected(t.timestampId)}>
                <strong>{t.name}</strong>
                <span className="muted small">{dateTime(t.createdAt)}</span>
                <Status value={t.status} />
              </button>
            ))}
          </div>
          {list.data && list.data.pages > 1 && (
            <div className="actions">
              <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="muted small">Page {list.data.page} of {list.data.pages}</span>
              <button className="btn" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </Card>
        {selected && <Detail key={`${selected}-${tick}`} id={selected} onChanged={() => setTick((n) => n + 1)} />}
      </div>
    </Section>
  );
}
