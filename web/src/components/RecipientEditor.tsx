import type { Account } from '../api';
import { placeholderEmail, type Group, type RecipientRow } from '../rules';

const GROUPS: { value: Group; label: string }[] = [
  { value: 'signers', label: 'Signer' },
  { value: 'approvers', label: 'Approver' },
  { value: 'viewers', label: 'Viewer' },
];

// Viewers have no embedded option in the API, and neither does anyone who needs a Twala account.
export const canEmbed = (r: RecipientRow) => r.group !== 'viewers' && !r.needsAccount;

export const newRow = (n: number): RecipientRow => ({ group: 'signers', name: `Signer ${n}`, email: placeholderEmail(n), embedded: true });

export const meRow = (account: Account): RecipientRow => ({ group: 'signers', name: account.sender.name, email: account.sender.email, embedded: true });

type Props = { rows: RecipientRow[]; onChange: (rows: RecipientRow[]) => void; account: Account; labels?: string[]; single?: boolean };

export function RecipientEditor({ rows, onChange, account, labels, single }: Props) {
  const fixed = !!labels || single;
  const set = (i: number, patch: Partial<RecipientRow>) =>
    onChange(rows.map((r, j) => {
      if (j !== i) return r;
      const next = { ...r, ...patch };
      return canEmbed(next) ? next : { ...next, embedded: false };
    }));
  return (
    <div className="recipient-rows">
      {rows.map((r, i) => (
        <div key={i} className="recipient-row">
          <span className="muted small order">{i + 1}</span>
          {labels ? <span className="small role-label">{labels[i]}</span> : (
            <select value={r.group} onChange={(e) => set(i, { group: e.target.value as Group })}>
              {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          )}
          <input required placeholder="Name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input required type="email" placeholder="Email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} />
          <select value={r.embedded ? 'embedded' : 'email'} disabled={!canEmbed(r)} onChange={(e) => set(i, { embedded: e.target.value === 'embedded' })}>
            <option value="embedded">Embedded (signs in this app)</option>
            <option value="email">By email</option>
          </select>
          <button type="button" className="link small" onClick={() => set(i, { email: account.sender.email, name: account.sender.name })}>Use me</button>
          {!fixed && rows.length > 1 && (
            <button type="button" className="link small" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</button>
          )}
        </div>
      ))}
      {!fixed && (
        <button type="button" className="link small add" onClick={() => onChange([...rows, newRow(rows.length + 1)])}>+ Add recipient</button>
      )}
    </div>
  );
}

export function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="notice notice-warn small">
      {items.map((p) => <div key={p}>{p}</div>)}
    </div>
  );
}
