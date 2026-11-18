import { useState, type FormEvent } from 'react';
import { call, twala, type Recipient } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { canEmbed, newRow, Problems, RecipientEditor } from '../components/RecipientEditor';
import { recipientProblems, type RecipientRow } from '../rules';
import { slot } from '../pdf';
import { Card, EnvelopePicker, randomId, Section, Status, useAction, useApp, useLoad } from '../ui';

function Row({ envelopeId, r, status, reload }: { envelopeId: string; r: Recipient; status: string; reload: () => void }) {
  const { account, changed } = useApp();
  const [edit, setEdit] = useState<{ name: string; email: string } | null>(null);
  const { run, busy, error } = useAction();
  const path = { params: { path: { envelope_id: envelopeId, recipient_id: r.recipientId ?? r.recipientIdGuid } } };
  const done = () => (setEdit(null), reload(), changed());
  const active = ['pending', 'in_progress'].includes(status);
  const testEmail = account?.mode === 'test' && r.deliveryMethod === 'email' && edit && edit.email.toLowerCase() !== account.sender.email.toLowerCase();
  return (
    <li>
      <span>
        <strong>{r.name}</strong> <span className="muted small">· {r.recipientId} · {r.email} · {r.deliveryMethod}{r.requireAccount ? ' · needs account' : ''}</span>
      </span>
      <span className="head-actions">
        {active && !['completed', 'declined'].includes(r.status) && !edit && <button className="link small" onClick={() => setEdit({ name: r.name, email: r.email })}>Correct</button>}
        {status === 'draft' && <button className="link small" disabled={busy} onClick={() => run(async () => (await call(twala.DELETE('/envelopes/{envelope_id}/recipients/{recipient_id}', path)), done()))}>Remove</button>}
        <Status value={r.status} />
      </span>
      {edit && (
        <form className="inline-form" onSubmit={(e) => (e.preventDefault(), run(async () => (await call(twala.PATCH('/envelopes/{envelope_id}/recipients/{recipient_id}', { ...path, body: edit })), done())))}>
          <input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input required type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          <button className="btn" disabled={busy}>Save</button>
          <button type="button" className="link small" onClick={() => setEdit(null)}>Cancel</button>
        </form>
      )}
      {testEmail && <Problems items={[`This recipient signs by email, so in test mode the new email must be ${account!.sender.email}.`]} />}
      <ErrorNotice error={error} />
    </li>
  );
}

function AddRecipient({ envelopeId, existing, reload }: { envelopeId: string; existing: Recipient[]; reload: () => void }) {
  const { account, changed } = useApp();
  const [rows, setRows] = useState<RecipientRow[]>([newRow(existing.length + 1)]);
  const { run, busy, error } = useAction();
  const taken: RecipientRow[] = existing.map((r) => ({ group: 'signers', name: r.name, email: r.email, embedded: r.deliveryMethod === 'embedded' }));
  const problems = recipientProblems([...taken, ...rows], account!);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const [r] = rows;
    const order = existing.length + 1;
    const recipient = { recipientId: randomId(r.group.slice(0, -1)), name: r.name, email: r.email, routingOrder: order };
    const { xPercent, yPercent } = slot(existing.length);
    const body = r.group === 'viewers'
      ? { viewers: [recipient] }
      : { [r.group]: [{ ...recipient, ...(r.embedded && canEmbed(r) ? { clientUserId: randomId('user') } : {}), fields: r.group === 'signers' ? [{ type: 'signature' as const, documentId: 'doc-1', pageNumber: 1, xPercent, yPercent }] : [] }] };
    run(async () => {
      await call(twala.POST('/envelopes/{envelope_id}/recipients', { params: { path: { envelope_id: envelopeId } }, body }));
      setRows([newRow(existing.length + 2)]);
      reload();
      changed();
    });
  };
  return (
    <form className="stack" onSubmit={submit}>
      <h4>Add a recipient</h4>
      <RecipientEditor rows={rows} onChange={setRows} single start={existing.length + 1} />
      <p className="muted small">A new signer gets a signature field on the first document (<code>doc-1</code>), page 1.</p>
      <Problems items={problems.create} />
      <ErrorNotice error={error} />
      <div className="actions"><button className="btn" disabled={busy || problems.create.length > 0}>Add recipient</button></div>
    </form>
  );
}

export function RecipientsSection() {
  const { envelopeId, version } = useApp();
  const recipients = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}/recipients', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const all = recipients.data ? [...(recipients.data.signers ?? []), ...(recipients.data.approvers ?? []), ...(recipients.data.viewers ?? [])].sort((a, b) => a.routingOrder - b.routingOrder) : [];
  const status = envelope.data?.status ?? '';
  return (
    <Section
      title="Recipients"
      intro="List an envelope's recipients, add or remove them on a draft, and correct a name or email once it's sent."
      calls={['GET /envelopes/{id}/recipients', 'POST /envelopes/{id}/recipients', 'PATCH /envelopes/{id}/recipients/{recipientId}', 'DELETE /envelopes/{id}/recipients/{recipientId}']}
      limits="recipients other than you must be embedded, and no two can share an email. Adding and removing work only on drafts; correcting only on sent envelopes."
    >
      <EnvelopePicker />
      {envelopeId && (
        <Card title="Recipients" actions={<><Status value={status || 'loading'} /><button className="link" onClick={recipients.reload}>Refresh</button></>}>
          <ErrorNotice error={recipients.error} />
          <ol className="recipients">
            {all.map((r) => <Row key={r.recipientIdGuid} envelopeId={envelopeId} r={r} status={status} reload={recipients.reload} />)}
          </ol>
          {status === 'draft' && <AddRecipient envelopeId={envelopeId} existing={all} reload={recipients.reload} />}
        </Card>
      )}
    </Section>
  );
}
