// Domain types for the Handoff client. Everything the UI reads goes through these shapes,
// so a real backend (Supabase, Claude API) can replace the mock without touching screens.

export type Priority = 'critical' | 'important' | 'info';
export type HandoffStatus = 'sent' | 'delivered' | 'opened' | 'acknowledged' | 'overdue';

export interface Patient {
  id: string;
  name: string; // includes "(synthetic)" — comes from the record, not the UI
  initials: string;
  dob: string; // MM/DD/YYYY
  ageYears: number;
  mrn: string;
  reasonForStay: string;
}

export interface Org {
  id: string;
  name: string;
  short: string;
  kind: 'hospital' | 'snf';
  onCallNumber: string; // placeholder until the directory is wired
}

export interface User {
  id: string;
  name: string; // "Dana Kim, RN (demo)"
  short: string; // "Dana Kim"
  initials: string;
  role: string;
  orgId: string;
  email: string;
}

export interface Handoff {
  id: string;
  patientId: string;
  fromOrgId: string;
  toOrgId: string;
  sentBy: string; // user id
  dischargedAt: string; // ISO local
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  openedBy?: string;
  ackDueAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  escalatedAt?: string;
  status: HandoffStatus;
  pageCount: number;
  /** ids of critical brief items reviewed so far (persisted per handoff) */
  reviewedCriticalIds: string[];
  unreadMessages: number;
}

export interface SourceRef {
  id: string;
  page: number;
  section: string;
  tag: string; // label on the highlight, e.g. "START apixaban"
  quote: string;
}

export interface BriefItem {
  id: string;
  priority: Priority;
  kind?: string; // "Started", "Stopped"
  text: string;
  sourceId: string;
}

export type BriefGroupIcon = 'pill' | 'alert-triangle' | 'bandage' | 'calendar' | 'restriction';

export interface BriefGroup {
  id: string;
  title: string;
  icon: BriefGroupIcon;
  items: BriefItem[];
  note?: string; // "Changed doses: none found in packet."
}

export interface UnclearItem {
  id: string;
  text: string;
  sourceId: string;
  suggestedQuestion: string;
  open: boolean;
}

export interface SensitiveSection {
  id: string;
  title: string;
  body: string; // placeholder text in the demo
}

export interface Brief {
  handoffId: string;
  generatedAt: string;
  model: string; // provenance shown to hospital reviewers
  groups: BriefGroup[];
  unclear: UnclearItem[];
  sensitive: SensitiveSection[];
  sources: SourceRef[];
}

export interface VoiceChip {
  label: string;
  value: string;
  tone?: 'neutral' | 'critical';
}

export interface ThreadMessage {
  id: string;
  handoffId: string;
  authorId: string;
  at: string;
  text?: string;
  voice?: { durationSec: number; transcript: string; chips: VoiceChip[]; briefMatch?: { text: string; page: number } };
  urgent?: boolean;
  quote?: { kind: 'unclear' | 'brief'; text: string; page: number };
  status: 'sending' | 'sent' | 'queued';
  kind?: 'message' | 'update';
}

export type ActivityAction =
  | 'sent' | 'delivered' | 'opened' | 'reviewed_item' | 'acknowledged' | 'revealed_sensitive'
  | 'downloaded' | 'viewed_source' | 'messaged' | 'voice_note' | 'escalated' | 'brief_generated' | 'brief_approved';

export interface ActivityEvent {
  id: string;
  handoffId: string;
  at: string; // ISO with seconds
  actorId: string; // user id or "system"
  action: ActivityAction;
  detail: string;
  privacy?: boolean; // shown with a lock; visible to both sides
}

export type Urgency = 'low' | 'medium' | 'high';

/** A captured note before it is sent. Never sent automatically. */
export interface VoiceDraft {
  patientId: string;
  durationSec: number;
  transcript: string;
  category: 'Symptom' | 'Vitals' | 'Medication question' | 'Wound' | 'Other';
  symptom: string;
  vitals: string;
  urgency: Urgency;
  destination: 'message' | 'update';
  patientConfirmed: boolean;
  typed: boolean;
}

export type PushKind = 'new_handoff' | 'new_message' | 'urgent_message';
export interface PushNotification {
  kind: PushKind;
  title: 'Handoff';
  body: string;
  subtitle?: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string; // display, e.g. "47"
  unit?: string;
  parts?: { n: string; unit: string }[];
  target: string;
  tone: 'ok' | 'bad' | 'pending';
}

export interface ReadmissionCase {
  id: string;
  patientId: string;
  readmittedAt: string;
  daysAfterDischarge: number;
  reason: string;
  handoffId: string;
  findings: { text: string; tone: 'ok' | 'bad' | 'warn' }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  orgId: string;
  role: 'Clinician' | 'Discharge coordinator' | 'Quality reviewer' | 'Admin' | 'Leadership';
  mfa: 'passkey' | 'authenticator' | 'none';
  lastActive: string;
  status: 'active' | 'invited' | 'suspended';
}
