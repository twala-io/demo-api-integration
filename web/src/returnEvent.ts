const MESSAGES: Record<string, [string, 'ok' | 'warn']> = {
  signing_complete: ['The recipient signed.', 'ok'],
  decline: ['The recipient declined.', 'warn'],
  send_complete: ["The envelope was sent from Twala's editor.", 'ok'],
  save: ["The draft was saved in Twala's editor.", 'ok'],
  session_timeout: ['The session timed out.', 'warn'],
  ttl_expired: ['The link had expired or was already used. Open it again.', 'warn'],
  exception: ['Something went wrong in Twala.', 'warn'],
};

export interface ReturnEvent {
  event: string;
  envelopeId: string | null;
  message: string;
  tone: 'ok' | 'warn';
}

// Twala's return event is only a hint, so sections re-read the envelope.
export function takeReturnEvent(): ReturnEvent | null {
  const params = new URLSearchParams(window.location.search);
  const event = params.get('event');
  if (!event) return null;
  const cancel = params.get('section') === 'sending' ? "Twala's editor was closed without saving." : 'The recipient chose to finish later.';
  const [message, tone] = event === 'cancel' ? [cancel, 'warn' as const] : (MESSAGES[event] ?? [`Returned with "${event}".`, 'warn' as const]);
  return { event, envelopeId: params.get('envelopeId'), message, tone };
}
