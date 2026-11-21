// Data layer for the Handoff client. Every screen reads and writes through these functions.
// Today they run against in-memory synthetic data (mock-data.ts). To go live, replace the
// bodies with Supabase queries and Claude API calls made from a server you control — never
// put API keys in this app.
import { nowIso, fmtTime } from '../clock';
import { ACTIVITY, ADMIN_USERS, BRIEFS, CURRENT_USER_ID, HANDOFFS, MESSAGES, METRICS, ORGS, PATIENTS, READMISSIONS, USERS } from './mock-data';
import { buildPushNotification } from './notifications';
import type { ActivityAction, ActivityEvent, Brief, BriefItem, Handoff, Org, Patient, PushNotification, SourceRef, ThreadMessage, User, VoiceDraft, VoiceChip } from './types';

export * from './types';
export { buildPushNotification, assertPushIsPhiFree, EMERGENCY_LINE } from './notifications';

// ---------- store plumbing ----------
const db = {
  handoffs: structuredClone(HANDOFFS),
  briefs: structuredClone(BRIEFS),
  messages: structuredClone(MESSAGES),
  activity: structuredClone(ACTIVITY),
  revealed: new Map<string, string>(), // `${handoffId}:${sectionId}` → revealed at
  outbox: [] as PushNotification[],
};

type Listener = () => void;
const listeners = new Set<Listener>();
/** Screens re-query when anything changes (see useQuery). */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((l) => l());
const latency = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));
let seq = 1000;
const id = (p: string) => `${p}-${++seq}`;

function log(handoffId: string, action: ActivityAction, detail: string, actorId = CURRENT_USER_ID, privacy = false) {
  db.activity.push({ id: id('a'), handoffId, at: nowIso(), actorId, action, detail, privacy });
}
function notify(kind: Parameters<typeof buildPushNotification>[0]) {
  // Always built from a fixed template; never from patient or message content.
  db.outbox.push(buildPushNotification(kind));
}

// ---------- lookups ----------
export const getCurrentUser = (): User => USERS.find((u) => u.id === CURRENT_USER_ID)!;
export const getUser = (uid: string): User => USERS.find((u) => u.id === uid) ?? USERS.find((u) => u.id === 'system')!;
export const getOrg = (oid: string): Org => ORGS.find((o) => o.id === oid)!;
export const listOrgs = (): Org[] => ORGS;
export const getPatient = (pid: string): Patient => PATIENTS.find((p) => p.id === pid)!;
export async function listPatients(): Promise<Patient[]> {
  return latency(PATIENTS);
}

export interface HandoffView {
  handoff: Handoff;
  patient: Patient;
  from: Org;
  to: Org;
  sender: User;
  criticalIds: string[];
  criticalReviewed: number;
}

function criticalItems(b?: Brief): BriefItem[] {
  return b ? b.groups.flatMap((g) => g.items).filter((i) => i.priority === 'critical') : [];
}

function view(h: Handoff): HandoffView {
  const crit = criticalItems(db.briefs.find((b) => b.handoffId === h.id)).map((i) => i.id);
  return { handoff: h, patient: getPatient(h.patientId), from: getOrg(h.fromOrgId), to: getOrg(h.toOrgId), sender: getUser(h.sentBy), criticalIds: crit, criticalReviewed: crit.filter((c) => h.reviewedCriticalIds.includes(c)).length };
}

const ORDER = { overdue: 0, opened: 1, delivered: 1, sent: 1, acknowledged: 2 } as const;

/** Facility inbox / hospital board. Overdue first, then by due time. */
export async function listHandoffs(filter: { toOrgId?: string; fromOrgId?: string } = {}): Promise<HandoffView[]> {
  const rows = db.handoffs
    .filter((h) => (!filter.toOrgId || h.toOrgId === filter.toOrgId) && (!filter.fromOrgId || h.fromOrgId === filter.fromOrgId))
    .map(view)
    .sort((a, b) => ORDER[a.handoff.status] - ORDER[b.handoff.status] || a.handoff.ackDueAt.localeCompare(b.handoff.ackDueAt));
  return latency(rows);
}

export async function getHandoff(handoffId: string): Promise<HandoffView | undefined> {
  const h = db.handoffs.find((x) => x.id === handoffId);
  return latency(h ? view(h) : undefined);
}

// ---------- brief ----------
export async function getBrief(handoffId: string): Promise<Brief | undefined> {
  return latency(db.briefs.find((b) => b.handoffId === handoffId));
}

export function sourceFor(brief: Brief, sourceId: string): SourceRef {
  return brief.sources.find((s) => s.id === sourceId)!;
}

export async function setCriticalReviewed(handoffId: string, itemId: string, reviewed: boolean): Promise<void> {
  const h = db.handoffs.find((x) => x.id === handoffId)!;
  if (h.status === 'acknowledged') throw new Error('Acknowledgment is final');
  const item = criticalItems(db.briefs.find((b) => b.handoffId === handoffId)).find((i) => i.id === itemId);
  if (!item) throw new Error('Only critical items carry a reviewed checkbox');
  h.reviewedCriticalIds = reviewed ? [...new Set([...h.reviewedCriticalIds, itemId])] : h.reviewedCriticalIds.filter((x) => x !== itemId);
  const src = sourceFor(db.briefs.find((b) => b.handoffId === handoffId)!, item.sourceId);
  log(handoffId, 'reviewed_item', `${reviewed ? '' : 'Unchecked · '}${src.tag} · p.${src.page}`);
  emit();
}

/** Safety rule: refuses unless every critical item is reviewed. */
export async function acknowledgeHandoff(handoffId: string): Promise<Handoff> {
  const h = db.handoffs.find((x) => x.id === handoffId)!;
  const v = view(h);
  if (v.criticalReviewed < v.criticalIds.length) throw new Error(`Check ${v.criticalIds.length - v.criticalReviewed} more critical item(s) to acknowledge`);
  h.status = 'acknowledged';
  h.acknowledgedAt = nowIso().slice(0, 16);
  h.acknowledgedBy = CURRENT_USER_ID;
  const brief = db.briefs.find((b) => b.handoffId === handoffId)!;
  const pages = criticalItems(brief).map((i) => `p.${sourceFor(brief, i.sourceId).page}`).join(', ');
  log(handoffId, 'acknowledged', `${v.criticalIds.length} critical items · ${pages}`);
  db.messages.push({ id: id('m'), handoffId, authorId: 'system', at: nowIso(), text: `Acknowledged by ${getUser(CURRENT_USER_ID).name} · ${v.criticalIds.length} critical items`, status: 'sent' });
  emit();
  return latency(h);
}

export async function revealSensitive(handoffId: string, sectionId: string, reveal: boolean): Promise<void> {
  const key = `${handoffId}:${sectionId}`;
  if (reveal) {
    db.revealed.set(key, nowIso());
    const s = db.briefs.find((b) => b.handoffId === handoffId)?.sensitive.find((x) => x.id === sectionId);
    log(handoffId, 'revealed_sensitive', `${s?.title ?? 'Sensitive'} section`, CURRENT_USER_ID, true);
  } else db.revealed.delete(key);
  emit();
}
export const isRevealed = (handoffId: string, sectionId: string) => db.revealed.has(`${handoffId}:${sectionId}`);
export const revealedAt = (handoffId: string, sectionId: string) => db.revealed.get(`${handoffId}:${sectionId}`);

export async function logDownload(handoffId: string, reason: string): Promise<void> {
  log(handoffId, 'downloaded', `Reason: "${reason}"`, CURRENT_USER_ID, true);
  emit();
}

// ---------- thread ----------
export async function getThread(handoffId: string): Promise<ThreadMessage[]> {
  return latency(db.messages.filter((m) => m.handoffId === handoffId).sort((a, b) => a.at.localeCompare(b.at)));
}

export interface ThreadEntry extends ThreadMessage {
  author: User;
  org: Org;
}
export const withAuthor = (m: ThreadMessage): ThreadEntry => {
  const author = getUser(m.authorId);
  return { ...m, author, org: getOrg(author.orgId) };
};

export async function sendMessage(handoffId: string, input: { text: string; urgent?: boolean; quote?: ThreadMessage['quote'] }): Promise<ThreadMessage> {
  const msg: ThreadMessage = { id: id('m'), handoffId, authorId: CURRENT_USER_ID, at: nowIso(), text: input.text.trim(), urgent: input.urgent, quote: input.quote, status: 'sent' };
  db.messages.push(msg);
  log(handoffId, 'messaged', input.urgent ? 'Urgent message' : input.quote ? `Asked about: ${input.quote.text}` : 'Message');
  notify(input.urgent ? 'urgent_message' : 'new_message');
  emit();
  scriptedReply(handoffId, msg);
  return latency(msg);
}

/** Demo only: the hospital "replies" a few seconds later so the thread feels alive. */
function scriptedReply(handoffId: string, msg: ThreadMessage) {
  const reply = msg.urgent || msg.voice?.chips.some((c) => c.tone === 'critical')
    ? { authorId: 'priya', text: 'Hold nothing yet. Send to ED for DVT check, calling now.' }
    : msg.quote?.kind === 'unclear'
      ? { authorId: 'sam', text: 'Checking with the prescribing team. Will confirm the dose here.' }
      : null;
  if (!reply) return;
  setTimeout(() => {
    db.messages.push({ id: id('m'), handoffId, authorId: reply.authorId, at: nowIso(), text: reply.text, status: 'sent', quote: msg.voice ? { kind: 'brief', text: `Replying to ${getUser(msg.authorId).short} · voice memo ${fmtTime(msg.at)}`, page: 0 } : undefined });
    notify('new_message');
    emit();
  }, 4000);
}

// ---------- voice capture ----------
const DEMO_TRANSCRIPT = "Patient's left calf looks swollen this morning, blood pressure 160 over 95, should we hold anything?";

/** Words revealed during recording to simulate a live transcript. Replace with streaming STT. */
export const liveTranscriptWords = DEMO_TRANSCRIPT.split(' ');

/**
 * Turns a recording into a reviewable draft. Mock: returns a fixed transcript and suggestions.
 * Later: upload audio to your server → speech-to-text → Claude extracts category/symptom/vitals/urgency.
 */
export async function transcribeVoiceNote(input: { patientId: string; durationSec: number; audioUri?: string }): Promise<VoiceDraft> {
  return latency(
    { patientId: input.patientId, durationSec: Math.max(input.durationSec, 1), transcript: DEMO_TRANSCRIPT, category: 'Symptom', symptom: 'Calf swelling, left', vitals: 'BP 160/95', urgency: 'high', destination: 'message', patientConfirmed: false, typed: false },
    1800,
  );
}

export function handoffForPatient(patientId: string): Handoff | undefined {
  return db.handoffs.find((h) => h.patientId === patientId);
}

/** Safety rule: a voice note is only ever sent by explicit user action, after patient confirmation. */
export async function sendVoiceNote(draft: VoiceDraft): Promise<ThreadMessage> {
  if (!draft.patientConfirmed) throw new Error('Confirm the patient before sending');
  const h = handoffForPatient(draft.patientId);
  if (!h) throw new Error('No handoff thread for this patient');
  const urgent = draft.urgency === 'high' && !draft.typed;
  const chips: VoiceChip[] = draft.typed ? [] : [
    { label: 'Symptom', value: draft.symptom.toLowerCase().replace(', left', '') },
    { label: 'Vitals', value: draft.vitals },
    { label: 'Urgency', value: draft.urgency, tone: draft.urgency === 'high' ? 'critical' : 'neutral' },
  ];
  const msg: ThreadMessage = {
    id: id('m'), handoffId: h.id, authorId: CURRENT_USER_ID, at: nowIso(), urgent, status: 'sent', kind: draft.destination === 'update' ? 'update' : 'message',
    text: draft.typed ? draft.transcript : undefined,
    voice: draft.typed ? undefined : { durationSec: draft.durationSec, transcript: draft.transcript, chips, briefMatch: /calf/i.test(draft.transcript) ? { text: 'calf swelling', page: 4 } : undefined },
  };
  db.messages.push(msg);
  log(h.id, draft.typed ? 'messaged' : 'voice_note', `${draft.destination === 'update' ? 'Patient update' : 'Message'}${urgent ? ' · urgent' : ''}${draft.typed ? '' : ` · voice ${draft.durationSec}s`}`);
  notify(urgent ? 'urgent_message' : 'new_message');
  emit();
  if (draft.destination === 'message') scriptedReply(h.id, msg);
  return latency(msg);
}

// ---------- activity ----------
export interface ActivityView extends ActivityEvent {
  actor: User;
  org: Org;
}
export async function getActivity(handoffId: string): Promise<ActivityView[]> {
  const rows = db.activity
    .filter((a) => a.handoffId === handoffId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((a) => {
      const actor = getUser(a.actorId);
      return { ...a, actor, org: getOrg(actor.orgId) };
    });
  return latency(rows);
}

export async function logPageView(handoffId: string, what: string): Promise<void> {
  log(handoffId, 'opened', what, CURRENT_USER_ID, true);
  emit();
}

// ---------- notifications ----------
/** Push payloads that would have been sent (demo). Each is a fixed, PHI-free template. */
export const sentNotifications = (): PushNotification[] => [...db.outbox];

// ---------- hospital, quality, leadership, admin ----------
export async function getMetrics() {
  return latency(METRICS);
}
export async function listReadmissions() {
  return latency(READMISSIONS);
}
export async function listAdminUsers() {
  return latency(ADMIN_USERS);
}

/** Mock: pretend to summarize an uploaded packet. Later: your server calls Claude with the PDF. */
export async function generateBrief(input: { patientId: string; fileName: string; pageCount: number }): Promise<Brief> {
  const base = db.briefs.find((b) => b.handoffId === 'h-ml')!;
  return latency({ ...structuredClone(base), handoffId: `draft-${input.patientId}`, generatedAt: nowIso().slice(0, 16) }, 2500);
}

export async function approveAndSendBrief(handoffId: string): Promise<void> {
  log(handoffId, 'brief_approved', 'Brief approved and sent', 'sam');
  notify('new_handoff');
  emit();
}
