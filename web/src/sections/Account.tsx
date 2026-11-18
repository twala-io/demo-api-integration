import { useApp, Card, Section } from '../ui';

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="usage">
      <div className="usage-label"><span>{label}</span><span className="muted">{used} / {max}</span></div>
      <progress value={used} max={max} />
    </div>
  );
}

export function AccountSection() {
  const { account, refreshAccount } = useApp();
  if (!account) return null;
  const { app, mode, sender, account: owner, credits, features, limits } = account;
  return (
    <Section title="Account" intro="Who the API key acts as, and what it is allowed to do." calls={['GET /account']}>
      <Card title={app.name} actions={<button className="link" onClick={refreshAccount}>Refresh</button>}>
        <dl className="facts">
          <div><dt>Mode</dt><dd>{mode === 'test' ? 'Test' : 'Live'}</dd></div>
          <div><dt>Sends as</dt><dd>{sender.name}<div className="muted small">{sender.email}</div></dd></div>
          <div><dt>Account</dt><dd>{owner.name} <span className="muted small">({owner.type})</span></dd></div>
          <div><dt>API credits</dt><dd>{credits.balance}</dd></div>
          <div><dt>Documents per envelope</dt><dd>{limits.documentsPerEnvelope ?? 'No limit'}</dd></div>
          <div><dt>Recipients per envelope</dt><dd>{limits.recipientsPerEnvelope}</dd></div>
          <div><dt>Fields per envelope</dt><dd>{limits.fieldsPerEnvelope}</dd></div>
          <div><dt>Largest PDF</dt><dd>{mb(limits.fileSizeBytes)}</dd></div>
          <div><dt>Timestamps</dt><dd>{features.timestamps ? 'Available' : 'Not available'}</dd></div>
          <div><dt>Identity verification</dt><dd>{features.identityVerification ? 'Available' : 'Not available'}</dd></div>
        </dl>
        {mode === 'test' && (
          <div className="usages">
            <Usage label="Test envelopes sent today" used={limits.testEnvelopesToday} max={limits.testEnvelopesPerDay} />
            <Usage label="Test timestamps today" used={limits.testTimestampsToday} max={limits.testTimestampsPerDay} />
          </div>
        )}
      </Card>
      {mode === 'test' && (
        <Card title="Test key rules">
          <ul className="rules">
            <li>Envelopes are free and watermarked. Up to {limits.testEnvelopesPerDay} sent and {limits.testTimestampsPerDay} timestamps a day, reset at midnight Philippine time.</li>
            <li>Only <strong>{sender.email}</strong> can get emails. Anyone else must be an embedded recipient, who signs inside this app.</li>
            <li>One envelope can't have two recipients with the same email, so you can be at most one of them. This app gives other recipients placeholder emails.</li>
            <li>Embedded recipients can't need a Twala account, an access code or identity verification.</li>
          </ul>
        </Card>
      )}
    </Section>
  );
}
