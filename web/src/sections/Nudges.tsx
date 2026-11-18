import { useState } from 'react';
import { call, twala } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { Json } from '../components/ApiLogDrawer';
import { Card, EnvelopePicker, Section, Status, useAction, useApp, useLoad } from '../ui';

export function NudgesSection() {
  const { envelopeId, version, changed } = useApp();
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const { run, busy, error } = useAction();
  const [result, setResult] = useState<unknown>(null);
  const path = { params: { path: { envelope_id: envelopeId! } } };
  const act = (fn: () => Promise<unknown>) => run(async () => (setResult(null), setResult(await fn()), changed()));
  const e = envelope.data;
  return (
    <Section
      title="Reminders and sealing"
      intro="Re-send the signing email to whoever is waiting, and retry sealing when it failed after everyone signed."
      calls={['POST /envelopes/{id}/reminders', 'POST /envelopes/{id}/sealing-attempts']}
      limits="reminders only go to recipients who sign by email, so an envelope waiting on an embedded recipient answers no_recipients_to_remind. Sealing can only be retried after it failed."
    >
      <EnvelopePicker />
      {e && (
        <Card title={e.name ?? 'Untitled'} actions={<Status value={e.status} />}>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => act(() => call(twala.POST('/envelopes/{envelope_id}/reminders', path)))}>Send reminder</button>
            <button className="btn" disabled={busy} onClick={() => act(() => call(twala.POST('/envelopes/{envelope_id}/sealing-attempts', path)))}>Retry sealing</button>
          </div>
          <ErrorNotice error={error} />
          {result != null && <><h4>Response</h4><Json value={result} /></>}
        </Card>
      )}
    </Section>
  );
}
