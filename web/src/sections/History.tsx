import { call, twala } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { dateTime, label } from '../format';
import { Card, EnvelopePicker, Section, useApp, useLoad } from '../ui';

export function HistorySection() {
  const { envelopeId, version } = useApp();
  const path = { params: { path: { envelope_id: envelopeId! } } };
  const audit = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}/audit-events', path)) : null, [envelopeId, version]);
  const form = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}/form-data', path)) : null, [envelopeId, version]);
  return (
    <Section
      title="Audit trail and form data"
      intro="Read what happened to an envelope and when, and what each recipient typed or ticked."
      calls={['GET /envelopes/{id}/audit-events', 'GET /envelopes/{id}/form-data']}
    >
      <EnvelopePicker />
      {envelopeId && (
        <div className="board">
          <Card title="Audit trail" actions={<button className="link" onClick={audit.reload}>Refresh</button>}>
            <ErrorNotice error={audit.error} />
            {audit.data?.map((h, i) => (
              <div key={i} className="line">
                <span className="small">{label(h.action)}{h.actor?.name ? <span className="muted"> · {h.actor.name}</span> : null}</span>
                <span className="muted small">{dateTime(h.occurredAt)}</span>
              </div>
            ))}
          </Card>
          <Card title="Form data" actions={<button className="link" onClick={form.reload}>Refresh</button>}>
            <ErrorNotice error={form.error} />
            {form.data?.recipients?.map((r) => (
              <div key={r.recipientIdGuid} className="line-group">
                <strong className="small">{r.name} <span className="muted">· {label(r.status)}</span></strong>
                {r.values?.length ? r.values.map((v) => (
                  <div key={v.fieldId} className="line">
                    <span className="muted small">{v.label ?? v.fieldKey ?? label(v.type)}</span>
                    <span className="small">{v.value ?? (v.checked != null ? (v.checked ? 'Checked' : 'Unchecked') : v.filled ? 'Signed' : '—')}</span>
                  </div>
                )) : <span className="muted small">No fields.</span>}
              </div>
            ))}
          </Card>
        </div>
      )}
    </Section>
  );
}
