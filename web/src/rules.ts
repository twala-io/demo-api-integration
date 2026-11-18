import type { Account } from './api';

export type Group = 'signers' | 'approvers' | 'viewers';

export interface RecipientRow {
  group: Group;
  name: string;
  email: string;
  embedded: boolean;
  // A template role that needs a Twala account or identity verification can't be embedded.
  needsAccount?: boolean;
}

export const placeholderEmail = (n: number) => `signer${n}@example.com`;

// What Twala will refuse, checked before the call: `create` blocks saving, `send` blocks sending.
export function recipientProblems(rows: RecipientRow[], account: Account) {
  const create: string[] = [];
  const send: string[] = [];
  const me = account.sender.email.toLowerCase();
  const seen = new Set<string>();
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (seen.has(email)) create.push(`${r.email} is used twice. An envelope can't have two recipients with the same email (duplicate_recipient_email).`);
    seen.add(email);
    if (r.embedded && r.needsAccount) create.push(`${r.name} needs a Twala account or ID check, so they can't sign embedded (embedded_recipient_conflict). Send to them by email.`);
    if (account.mode === 'test' && !r.embedded && email !== me) {
      send.push(`${r.email} would get an email, but a test key only emails ${account.sender.email} (test_recipient_not_allowed). Make them embedded or use your email.`);
    }
  }
  return { create, send: [...create, ...send] };
}
