import { call, twala } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { Card, EnvelopePicker, Section, Status, useAction, useApp, useLoad } from '../ui';

const returnUrl = (section: string) => `${window.location.origin}/?section=${section}`;

export function EmbeddedSendingSection() {
  const { envelopeId, version } = useApp();
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const { run, busy, error } = useAction();
  const e = envelope.data;
  const open = () =>
    run(async () => {
      const view = await call(twala.POST('/envelopes/{envelope_id}/views/sender', { params: { path: { envelope_id: envelopeId! } }, body: { returnUrl: returnUrl('sending') } }));
      window.location.assign(view.url);
    });
  return (
    <Section
      title="Embedded sending"
      intro="Open a draft in Twala's editor, where you can place fields, add recipients and send. Twala sends you back here when you're done."
      calls={['POST /envelopes/{id}/views/sender']}
      limits="the link works once and expires in minutes. http://localhost return addresses are fine for test keys."
    >
      <EnvelopePicker filter={(x) => x.status === 'draft'} hint="drafts only" />
      {e && (
        <Card title={e.name ?? 'Untitled'} actions={<Status value={e.status} />}>
          {e.status === 'draft'
            ? <p className="small">Twala's editor will open in this tab. Use <strong>Save and close</strong> or <strong>Send</strong> to come back.</p>
            : <p className="notice small">Only drafts can be opened in the editor. Create one with <strong>Save as draft</strong> in Envelopes.</p>}
          <ErrorNotice error={error} />
          <div className="actions"><button className="btn btn-primary" disabled={busy || e.status !== 'draft'} onClick={open}>Open Twala's editor</button></div>
        </Card>
      )}
    </Section>
  );
}

export function EmbeddedSigningSection() {
  const { envelopeId, version } = useApp();
  const envelope = useLoad(envelopeId ? () => call(twala.GET('/envelopes/{envelope_id}', { params: { path: { envelope_id: envelopeId } } })) : null, [envelopeId, version]);
  const { run, busy, error } = useAction();
  const e = envelope.data;
  const active = !!e && ['pending', 'in_progress'].includes(e.status);
  const people = e ? [...(e.recipients.signers ?? []), ...(e.recipients.approvers ?? [])].sort((a, b) => a.routingOrder - b.routingOrder) : [];
  const sign = (recipientId: string) =>
    run(async () => {
      const view = await call(
        twala.POST('/envelopes/{envelope_id}/views/recipient', {
          params: { path: { envelope_id: envelopeId! } },
          body: { recipientId, returnUrl: returnUrl('signing'), authenticationInstant: new Date().toISOString() },
        }),
      );
      window.location.assign(view.url);
    });
  return (
    <Section
      title="Embedded signing"
      intro="Let an embedded recipient sign inside your app. Twala opens its signing page for them and sends them back here with the outcome."
      calls={['POST /envelopes/{id}/views/recipient']}
      limits="only embedded recipients can sign here, and only when it's their turn. Each link works once and expires in minutes."
    >
      <EnvelopePicker filter={(x) => ['pending', 'in_progress'].includes(x.status)} hint="sent envelopes" />
      {e && (
        <Card title={e.name ?? 'Untitled'} actions={<Status value={e.status} />}>
          {!active && <p className="notice small">Only sent envelopes awaiting signature can be signed.</p>}
          <ol className="recipients">
            {people.map((r) => {
              const turn = active && r.deliveryMethod === 'embedded' && ['notified', 'opened'].includes(r.status);
              return (
                <li key={r.recipientIdGuid}>
                  <span>{r.name} <span className="muted small">· {r.deliveryMethod === 'embedded' ? 'embedded' : `by email (${r.email})`}</span></span>
                  <span className="head-actions">
                    {turn && <button className="btn btn-primary" disabled={busy} onClick={() => sign(r.recipientId ?? r.recipientIdGuid)}>Sign as {r.name}</button>}
                    <Status value={r.status} />
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="muted small">Recipients sign in order. One who signs by email gets Twala's email when it's their turn.</p>
          <ErrorNotice error={error} />
        </Card>
      )}
    </Section>
  );
}
