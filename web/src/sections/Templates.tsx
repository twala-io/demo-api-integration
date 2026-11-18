import { useEffect, useState, type FormEvent } from 'react';
import { call, twala, type Account, type Template, type TemplateRole } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import { Problems, RecipientEditor } from '../components/RecipientEditor';
import { dateTime, label } from '../format';
import { placeholderEmail, recipientProblems, type RecipientRow } from '../rules';
import { Card, randomId, Section, useAction, useApp, useLoad } from '../ui';

const byOrder = (t: Template) => [...(t.roles ?? [])].sort((a, b) => a.routingOrder - b.routingOrder);
const needsAccount = (r: TemplateRole) => r.requireAccount || r.requireIdentityVerification;

// You fill the first role that must get email, or else the first role, embedded.
function defaultRows(roles: TemplateRole[], account: Account): RecipientRow[] {
  const byEmail = (r: TemplateRole) => r.type === 'viewer' || needsAccount(r);
  const mine = roles.find(byEmail) ?? roles[0];
  return roles.map((r, i) => {
    const me = r === mine;
    return {
      group: `${r.type}s` as RecipientRow['group'],
      name: me ? account.sender.name : (r.roleName ?? `Role ${i + 1}`),
      email: me ? account.sender.email : placeholderEmail(i + 1),
      embedded: !byEmail(r),
      needsAccount: needsAccount(r),
    };
  });
}

function UseTemplate({ template }: { template: Template }) {
  const { account, selectEnvelope, changed, refreshAccount, go } = useApp();
  const roles = byOrder(template);
  const [rows, setRows] = useState(() => defaultRows(roles, account!));
  const [name, setName] = useState(template.name);
  const { run, busy, error } = useAction();
  useEffect(() => (setRows(defaultRows(byOrder(template), account!)), setName(template.name)), [template, account]);
  const problems = recipientProblems(rows, account!);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'sent' ? 'sent' : 'draft';
    run(async () => {
      const created = await call(
        twala.POST('/envelopes', {
          body: {
            templateId: template.templateId,
            name,
            status,
            metadata: { source: 'api-showcase' },
            templateRoles: roles.map((role, i) => ({
              ...(role.roleName ? { roleName: role.roleName } : { roleId: role.roleId }),
              recipientId: `role-${i + 1}`,
              name: rows[i].name,
              email: rows[i].email,
              ...(rows[i].embedded ? { clientUserId: randomId('user') } : {}),
            })),
          },
        }),
      );
      selectEnvelope(created.envelopeId);
      changed();
      refreshAccount();
      go('envelopes');
    });
  };

  return (
    <Card title={template.name}>
      <p className="muted small mono">{template.templateId} · {template.documents?.map((d) => d.pageCount ? `${d.name} (${d.pageCount} p)` : d.name).join(', ')}</p>
      <table className="table">
        <thead><tr><th>#</th><th>Role</th><th>Type</th><th>Fields</th><th>Needs</th></tr></thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.roleId}>
              <td>{r.routingOrder}</td>
              <td>{r.roleName ?? <span className="muted">Unnamed</span>}</td>
              <td>{label(r.type)}</td>
              <td>{r.fields?.length ?? 0}</td>
              <td className="small">{[r.requireAccount && 'Twala account', r.requireIdentityVerification && 'ID check'].filter(Boolean).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Envelope name</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div>
          <h4>Who fills each role</h4>
          <RecipientEditor rows={rows} onChange={setRows} account={account!} labels={roles.map((r) => r.roleName ?? label(r.type))} />
          <p className="muted small">Roles that need a Twala account or an ID check, and viewers, can't be embedded, so they get email. On a test key only you can get email.</p>
        </div>
        <Problems items={problems.send} />
        <ErrorNotice error={error} />
        <div className="actions">
          <button className="btn" value="draft" disabled={busy || problems.create.length > 0}>Save as draft</button>
          <button className="btn btn-primary" value="sent" disabled={busy || problems.send.length > 0}>Create and send</button>
        </div>
      </form>
    </Card>
  );
}

export function TemplatesSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => call(twala.GET('/templates', { params: { query: { limit: 50 } } })), []);
  // include=fields is documented but missing from the OpenAPI document, hence the cast.
  const detail = useLoad(selected ? () => call(twala.GET('/templates/{template_id}', { params: { path: { template_id: selected }, query: { include: 'fields' } } as { path: { template_id: string } } })) : null, [selected]);
  return (
    <Section
      title="Templates"
      intro="Templates are created in Twala, not through the API. This screen lists them, reads one with its roles and fields, and creates an envelope from it."
      calls={['GET /templates', 'GET /templates/{id}?include=fields', 'POST /envelopes (templateId)']}
      limits="only remote-signing templates are listed. You can fill at most one role yourself; roles needing an account or ID check must be you."
    >
      <Card title="Templates" actions={<button className="link" onClick={list.reload}>Refresh</button>}>
        <ErrorNotice error={list.error} />
        {list.data?.items.length === 0 && <p className="muted">No templates yet. Save a remote-signing template in Twala, then click Refresh.</p>}
        <div className="rows">
          {list.data?.items.map((t) => (
            <button key={t.templateId} className={`row ${selected === t.templateId ? 'row-on' : ''}`} onClick={() => setSelected(t.templateId)}>
              <strong>{t.name}</strong>
              <span className="muted small">Updated {dateTime(t.updatedAt)}</span>
              <span />
            </button>
          ))}
        </div>
      </Card>
      <ErrorNotice error={detail.error} />
      {detail.data && <UseTemplate key={detail.data.templateId} template={detail.data} />}
    </Section>
  );
}
