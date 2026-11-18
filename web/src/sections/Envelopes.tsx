import { useState, type FormEvent } from 'react';
import { call, twala, type EnvelopeUpdate, type SignerInput } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { Json } from '../components/ApiLogDrawer';
import { meRow, Problems, RecipientEditor } from '../components/RecipientEditor';
import { dateTime } from '../format';
import { recipientProblems, type RecipientRow } from '../rules';
import { fileToBase64, slot } from '../pdf';
import { Card, randomId, Section, Status, useAction, useApp, useLoad } from '../ui';

const DOC = 'doc-1';
const FILTERS = [
  { name: 'All', status: '' },
  { name: 'Draft', status: 'draft' },
  { name: 'Pending', status: 'pending,in_progress' },
  { name: 'Completed', status: 'completed' },
  { name: 'Voided', status: 'voided' },
];

// Each signer gets a signature and a date field in their own slot on page 1.
export function toRecipients(rows: RecipientRow[], documentId: string) {
  const out: { signers: SignerInput[]; approvers: SignerInput[]; viewers: Omit<SignerInput, 'clientUserId' | 'fields'>[] } = { signers: [], approvers: [], viewers: [] };
  rows.forEach((r, i) => {
    const base = { recipientId: `${r.group.slice(0, -1)}-${i + 1}`, name: r.name, email: r.email, routingOrder: i + 1 };
    const embedded = r.embedded ? { clientUserId: randomId('user') } : {};
    if (r.group === 'viewers') return void out.viewers.push(base);
    const { xPercent, yPercent, dateXPercent } = slot(i);
    const fields = r.group === 'signers'
      ? [
          { type: 'signature' as const, documentId, pageNumber: 1, xPercent, yPercent },
          { type: 'date' as const, autoFill: true, documentId, pageNumber: 1, xPercent: dateXPercent, yPercent },
        ]
      : [];
    out[r.group].push({ ...base, ...embedded, fields });
  });
  return out;
}

function CreateEnvelope() {
  const { account, selectEnvelope, changed, refreshAccount } = useApp();
  const [name, setName] = useState('Test envelope');
  const [message, setMessage] = useState('Please review and sign.');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RecipientRow[]>(() => [meRow(account!)]);
  const { run, busy, error } = useAction();
  const problems = recipientProblems(rows, account!);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'sent' ? 'sent' : 'draft';
    run(async () => {
      const documentBase64 = await fileToBase64(file!);
      const created = await call(
        twala.POST('/envelopes', {
          body: {
            name,
            message,
            status,
            metadata: { source: 'api-showcase' },
            documents: [{ documentId: DOC, name: file!.name, documentBase64 }],
            recipients: toRecipients(rows, DOC),
          },
        }),
      );
      selectEnvelope(created.envelopeId);
      changed();
      refreshAccount();
    });
  };

  return (
    <Card title="Create an envelope">
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span>Name</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Message to recipients</span><input value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          <label className="field">
            <span>Document</span>
            <input type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span className="muted">PDF, signature fields go on page 1.</span>
          </label>
        </div>
        <div>
          <h4>Recipients, in signing order</h4>
          <RecipientEditor rows={rows} onChange={setRows} account={account!} />
          <p className="muted small">Signers get a signature and a date field. Embedded recipients sign in the Embedded signing section.</p>
        </div>
        <Problems items={problems.send} />
        <ErrorNotice error={error} />
        <div className="actions">
          <button className="btn" value="draft" disabled={busy || !file || problems.create.length > 0}>Save as draft</button>
          <button className="btn btn-primary" value="sent" disabled={busy || !file || problems.send.length > 0}>{busy ? 'Working…' : 'Create and send'}</button>
        </div>
      </form>
    </Card>
  );
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function EnvelopeList() {
  const { envelopeId, selectEnvelope, version } = useApp();
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(true);
  const [page, setPage] = useState(1);
  // metadata[key] is documented but missing from the OpenAPI document, hence the cast.
  const query = { status: status || undefined, page, limit: 10, ...(mine ? { 'metadata[source]': 'api-showcase' } : {}) } as { page: number };
  const { data, error, reload } = useLoad(() => call(twala.GET('/envelopes', { params: { query } })), [status, mine, page, version]);
  return (
    <Card title="Envelopes" actions={<button className="link" onClick={reload}>Refresh</button>}>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f.name} className={`chip ${status === f.status ? 'chip-on' : ''}`} onClick={() => (setStatus(f.status), setPage(1))}>{f.name}</button>
        ))}
        <label className="small check"><input type="checkbox" checked={mine} onChange={(e) => (setMine(e.target.checked), setPage(1))} /> Only made here <code>metadata[source]</code></label>
      </div>
      <ErrorNotice error={error} />
      {data?.items.length === 0 && <p className="muted">No envelopes.</p>}
      <div className="rows">
        {data?.items.map((e) => (
          <button key={e.envelopeId} className={`row ${envelopeId === e.envelopeId ? 'row-on' : ''}`} onClick={() => selectEnvelope(e.envelopeId)}>
            <span><strong>{e.name ?? 'Untitled'}</strong> <span className="muted small">· {count((e.recipients.signers?.length ?? 0) + (e.recipients.approvers?.length ?? 0) + (e.recipients.viewers?.length ?? 0), 'recipient')}</span></span>
            <span className="muted small">{dateTime(e.createdAt)}</span>
            <Status value={e.status} />
          </button>
        ))}
      </div>
      {data && data.pages > 1 && (
        <div className="actions">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted small">Page {data.page} of {data.pages}</span>
          <button className="btn" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </Card>
  );
}

function EnvelopeDetail({ id }: { id: string }) {
  const { selectEnvelope, changed, version, refreshAccount } = useApp();
  const { data: e, error: loadError, reload } = useLoad(() => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: id } } })), [id, version]);
  const { run, busy, error } = useAction();
  const [edit, setEdit] = useState<{ name: string; message: string; expires: string } | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const path = { params: { path: { envelope_id: id } } };
  const patch = (body: EnvelopeUpdate) =>
    run(async () => {
      await call(twala.PATCH('/envelopes/{envelope_id}', { ...path, body }));
      setEdit(null);
      reload();
      changed();
      refreshAccount();
    });

  if (!e) return <Card><ErrorNotice error={loadError} />{!loadError && <p className="muted">Loading…</p>}</Card>;
  const active = ['pending', 'in_progress'].includes(e.status);
  const everyone = [...(e.recipients.signers ?? []), ...(e.recipients.approvers ?? []), ...(e.recipients.viewers ?? [])].sort((a, b) => a.routingOrder - b.routingOrder);

  return (
    <Card title={e.name ?? 'Untitled'} actions={<><Status value={e.status} /><button className="link" onClick={() => selectEnvelope(null)}>Close</button></>}>
      <p className="muted small mono">{e.envelopeId}</p>
      <dl className="facts">
        <div><dt>Created</dt><dd>{dateTime(e.createdAt)}</dd></div>
        <div><dt>Sent</dt><dd>{dateTime(e.sentAt)}</dd></div>
        <div><dt>Completed</dt><dd>{dateTime(e.completedAt)}</dd></div>
        <div><dt>Expires</dt><dd>{dateTime(e.expiresAt)}</dd></div>
      </dl>
      {e.voidedReason && <p className="notice notice-bad small">Voided: {e.voidedReason}</p>}
      <ol className="recipients">
        {everyone.map((r) => (
          <li key={r.recipientIdGuid}>
            <span>{r.name} <span className="muted small">· {r.email} · {r.deliveryMethod}</span></span>
            <Status value={r.status} />
          </li>
        ))}
      </ol>
      {edit && (
        <form className="inline-form" onSubmit={(ev) => {
          ev.preventDefault();
          const expiresAt = edit.expires ? new Date(`${edit.expires}T23:59:59+08:00`).toISOString() : null;
          patch(e.status === 'draft' ? { name: edit.name, message: edit.message, expiresAt } : { expiresAt });
        }}>
          {e.status === 'draft' && (
            <>
              <input required value={edit.name} onChange={(ev) => setEdit({ ...edit, name: ev.target.value })} placeholder="Name" />
              <input value={edit.message} onChange={(ev) => setEdit({ ...edit, message: ev.target.value })} placeholder="Message" />
            </>
          )}
          {e.status !== 'draft' && <span className="small muted">Once sent, only the expiry can change. Expires</span>}
          <input type="date" title="Expires (end of day, PHT)" value={edit.expires} onChange={(ev) => setEdit({ ...edit, expires: ev.target.value })} />
          <button className="btn" disabled={busy}>Save</button>
          <button type="button" className="link small" onClick={() => setEdit(null)}>Cancel</button>
        </form>
      )}
      <ErrorNotice error={error} />
      <div className="actions">
        {['draft', 'pending', 'in_progress'].includes(e.status) && !edit && (
          <button className="btn" disabled={busy} onClick={() => setEdit({ name: e.name ?? '', message: e.message ?? '', expires: e.expiresAt?.slice(0, 10) ?? '' })}>Edit</button>
        )}
        {e.status === 'draft' && (
          <>
            <button className="btn" disabled={busy} onClick={() => run(async () => (await call(twala.DELETE('/envelopes/{envelope_id}', path)), selectEnvelope(null), changed()))}>Delete</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => patch({ status: 'sent' })}>Send</button>
          </>
        )}
        {active && (
          <button className="btn" disabled={busy} onClick={() => setVoiding('')}>Void</button>
        )}
      </div>
      {voiding !== null && (
        <dialog className="modal" ref={(d) => { if (d && !d.open) d.showModal(); }} onClose={() => setVoiding(null)}>
          <form className="stack" onSubmit={(ev) => (ev.preventDefault(), patch({ status: 'voided', voidedReason: voiding || null }), setVoiding(null))}>
            <h3>Void this envelope?</h3>
            <p className="muted small">Recipients can no longer sign it. This can't be undone.</p>
            <label className="field"><span>Reason (optional, shown to recipients)</span><input autoFocus value={voiding} onChange={(ev) => setVoiding(ev.target.value)} placeholder="e.g. Sent by mistake" /></label>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setVoiding(null)}>Cancel</button>
              <button className="btn btn-danger">Void envelope</button>
            </div>
          </form>
        </dialog>
      )}
      <details><summary className="small">Response of GET /envelopes/{'{id}'}</summary><Json value={e} /></details>
    </Card>
  );
}

export function EnvelopesSection() {
  const { envelopeId } = useApp();
  return (
    <Section
      title="Envelopes"
      intro="Create an envelope with documents and recipients, then list, update, send, void or delete it."
      calls={['POST /envelopes', 'GET /envelopes', 'GET /envelopes/{id}', 'PATCH /envelopes/{id}', 'DELETE /envelopes/{id}']}
      limits="sending counts toward the daily limit; drafts don't. Only drafts can be deleted, and only drafts and envelopes awaiting signature can be edited."
    >
      <CreateEnvelope />
      <div className="board">
        <EnvelopeList />
        {envelopeId && <EnvelopeDetail key={envelopeId} id={envelopeId} />}
      </div>
    </Section>
  );
}
