import type { Status } from '../api';
import { RequestFailed } from '../api';

const KEY_LABELS: Record<Status['keyMode'], string> = {
  test: 'Test key',
  live: 'Live key',
  missing: 'No API key',
  malformed: 'Unrecognized key',
};

export function StatusBar({ status, accountError, onRefresh }: { status: Status | null; accountError: unknown; onRefresh: () => void }) {
  if (!status) return <div className="status"><span className="pill pill-bad">App server unreachable</span><button className="link" onClick={onRefresh}>Refresh</button></div>;
  const keyError = accountError instanceof RequestFailed ? accountError.error.code : accountError ? 'unreachable' : null;
  const keyOk = status.keyMode === 'test' && !keyError;
  return (
    <div className="status">
      <span className="pill" title={status.apiBase}>{new URL(status.apiBase).host}</span>
      <span className={`pill ${keyOk ? 'pill-ok' : 'pill-bad'}`} title={status.key}>{keyError ?? KEY_LABELS[status.keyMode]}</span>
      <button className="link" onClick={onRefresh}>Refresh</button>
    </div>
  );
}
