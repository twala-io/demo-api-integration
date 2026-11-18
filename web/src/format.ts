export const STATUS_TONE: Record<string, string> = {
  pending: 'pill-warn',
  in_progress: 'pill-warn',
  sealing: 'pill-warn',
  notified: 'pill-warn',
  opened: 'pill-warn',
  completed: 'pill-ok',
  sealing_failed: 'pill-bad',
  declined: 'pill-bad',
  voided: 'pill-bad',
  expired: 'pill-bad',
};

export const label = (value: string) => {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(/[_.]/g, ' ').toLowerCase();
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/\b[Ii]p\b/g, 'IP');
};

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';
