import type { PushKind, PushNotification } from './types';

// Alert wording rule: push, lock screen, banners and badges never carry patient name, DOB,
// diagnosis, facility or message text. Only these fixed strings (+ the 911 line for urgent).
const BODY: Record<PushKind, string> = {
  new_handoff: 'New handoff waiting in Handoff.',
  new_message: 'New message waiting in Handoff.',
  urgent_message: 'Urgent message waiting in Handoff.',
};

export const EMERGENCY_LINE = 'For emergencies call 911.';

/**
 * The only way to build notification text. Takes a kind, not a message or patient, so no
 * caller can leak patient information into a push payload.
 */
export function buildPushNotification(kind: PushKind): PushNotification {
  return { kind, title: 'Handoff', body: BODY[kind], subtitle: kind === 'urgent_message' ? EMERGENCY_LINE : undefined };
}

/** Defensive check for any payload headed to APNs/FCM: rejects anything but the fixed strings. */
export function assertPushIsPhiFree(n: PushNotification): void {
  const allowed = new Set([...Object.values(BODY), EMERGENCY_LINE, 'Handoff']);
  for (const s of [n.title, n.body, n.subtitle]) {
    if (s !== undefined && !allowed.has(s)) throw new Error('Push text must use a fixed, PHI-free template');
  }
}
