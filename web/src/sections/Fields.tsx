import { useState, type FormEvent } from 'react';
import { call, twala, type Document, type Field, type FieldInput, type Recipient } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { label } from '../format';
import { Card, EnvelopePicker, Section, useAction, useApp, useLoad } from '../ui';

const TYPES = ['signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox'];
const AUTO_FILL = ['date', 'name', 'email'];
const docKey = (d: Document) => d.documentId ?? d.documentIdGuid;

// GET returns ids, nulls and an autoFill some types refuse, so each field is trimmed before PUT.
const writable = ({ fieldId, documentIdGuid, ...field }: Field) =>
  Object.fromEntries(Object.entries(field).filter(([k, v]) => v != null && (k !== 'autoFill' || AUTO_FILL.includes(field.type)))) as FieldInput;

function RecipientFields({ envelopeId, r, editable, documents }: { envelopeId: string; r: Recipient; editable: boolean; documents: Document[] }) {
  const path = { params: { path: { envelope_id: envelopeId, recipient_id: r.recipientId ?? r.recipientIdGuid } } };
  const { data, error: loadError, setData } = useLoad(() => call(twala.GET('/envelopes/{envelope_id}/recipients/{recipient_id}/fields', path)), [envelopeId, r.recipientIdGuid]);
  const [draft, setDraft] = useState({ type: 'text', label: '', documentId: '', pageNumber: 1, xPercent: 12, yPercent: 80 });
  const { run, busy, error } = useAction();
  const save = (fields: FieldInput[], then?: () => void) => run(async () => (setData(await call(twala.PUT('/envelopes/{envelope_id}/recipients/{recipient_id}/fields', { ...path, body: { fields } }))), then?.()));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const documentId = draft.documentId || (documents[0] && docKey(documents[0]));
    save([...(data ?? []).map(writable), { ...draft, label: draft.label || undefined, documentId } as FieldInput], () => setDraft({ ...draft, label: '' }));
  };
  return (
    <div className="line-group">
      <strong className="small">{r.name} <span className="muted">· {r.recipientId}</span></strong>
      <ErrorNotice error={loadError} />
      {data?.length === 0 && <span className="muted small">No fields.</span>}
      {data?.map((f) => (
        <div key={f.fieldId} className="line">
          <span className="small">{f.label ?? label(f.type)} <span className="muted">· {f.type} · {f.documentId} p{f.pageNumber} · {Math.round(f.xPercent)}%, {Math.round(f.yPercent)}%</span></span>
          {editable && <button className="link small" disabled={busy} onClick={() => save(data.filter((x) => x.fieldId !== f.fieldId).map(writable))}>Remove</button>}
        </div>
      ))}
      {editable && (
        <form className="inline-form" onSubmit={add}>
          <label className="mini"><span>Type</span><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select></label>
          {documents.length > 1 && (
            <label className="mini"><span>Document</span><select value={draft.documentId || docKey(documents[0])} onChange={(e) => setDraft({ ...draft, documentId: e.target.value })}>
              {documents.map((d) => <option key={d.documentIdGuid} value={docKey(d)}>{d.name}</option>)}
            </select></label>
          )}
          <label className="mini"><span>Label</span><input placeholder="Optional" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
          <label className="mini"><span>Page</span><input type="number" min={1} value={draft.pageNumber} onChange={(e) => setDraft({ ...draft, pageNumber: Number(e.target.value) })} /></label>
          <label className="mini"><span>Left %</span><input type="number" min={0} max={100} value={draft.xPercent} onChange={(e) => setDraft({ ...draft, xPercent: Number(e.target.value) })} /></label>
          <label className="mini"><span>Top %</span><input type="number" min={0} max={100} value={draft.yPercent} onChange={(e) => setDraft({ ...draft, yPercent: Number(e.target.value) })} /></label>
          <button className="btn" disabled={busy}>Add field</button>
        </form>
      )}
      <ErrorNotice error={error} />
    </div>
  );
}

export function FieldsSection() {
  const { envelopeId, version, account } = useApp();
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const docs = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}/documents', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const e = envelope.data;
  const people = e ? [...(e.recipients.signers ?? []), ...(e.recipients.approvers ?? [])].sort((a, b) => a.routingOrder - b.routingOrder) : [];
  return (
    <Section
      title="Fields"
      intro="Read the fields a recipient fills in, and replace the whole set on a draft. Adding or removing one field sends the full list back."
      calls={['GET /envelopes/{id}/recipients/{recipientId}/fields', 'PUT /envelopes/{id}/recipients/{recipientId}/fields']}
      limits={`up to ${account?.limits.fieldsPerEnvelope ?? 500} fields per envelope. Fields can only be changed on drafts.`}
    >
      <EnvelopePicker />
      {e && (
        <Card title="Fields by recipient">
          {e.status !== 'draft' && <p className="notice small">This envelope isn't a draft, so its fields are read-only.</p>}
          {people.map((r) => <RecipientFields key={r.recipientIdGuid} envelopeId={e.envelopeId} r={r} editable={e.status === 'draft'} documents={docs.data ?? []} />)}
          <p className="muted small">Positions are percentages of the page, from the top-left corner. Fields read with GET are trimmed of their ids and empty values before PUT, because PUT refuses them.</p>
        </Card>
      )}
      <ErrorNotice error={envelope.error} />
    </Section>
  );
}
