// Synthetic demo data for the hospital quality, leadership and admin screens.
// No real patients, people or organizations. Shapes mirror the design canvas
// (ReadmissionReview, MetricsDashboard, AdminConsole) so screens stay data-driven.
import { getPatient } from './index';
import type { Patient } from './types';

const latency = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

// ---------- readmission review ----------
export type FailurePoint = 'notack' | 'unanswered' | 'missing' | 'notopened' | 'unrelated' | 'other';
export const FAILURE_OPTIONS: { key: FailurePoint; label: string }[] = [
  { key: 'notack', label: 'Critical item not acknowledged' },
  { key: 'unanswered', label: 'Question unanswered (over 12 hours)' },
  { key: 'missing', label: 'Item missing from brief' },
  { key: 'notopened', label: 'Brief not opened in time' },
  { key: 'unrelated', label: 'Unrelated / unavoidable' },
  { key: 'other', label: 'Other (explain in notes)' },
];

export type TimelineKind = 'plain' | 'ok' | 'bad' | 'urgent' | 'admit';
export interface ReviewEvent {
  t: string;
  title: string;
  detail: string;
  kind: TimelineKind;
  tag?: string;
}
/** A finding bullet; `refs` are brief source references rendered as links. */
export type FindingPart = string | { b: string } | { page: number };
export interface ReadmissionReview {
  id: string;
  patient: Patient;
  queueName: string; // privacy default: first name + last initial
  birthYear: string;
  queueLine: string;
  queueAi: string;
  queueTone: 'neutral' | 'critical' | 'important';
  stay: string;
  daysAfter: number;
  diagnosis: string;
  arrival: string;
  timelineRange: string;
  events: ReviewEvent[];
  aiPick: FailurePoint;
  confidence: 'low' | 'medium' | 'high';
  findings: FindingPart[][];
  notChecked: string;
  secondary?: { label: string; summary: string };
  handoffId?: string;
}

const thomas: Patient = { id: 'tn', name: 'Thomas Nguyen (synthetic)', initials: 'TN', dob: '06/02/1938', ageYears: 88, mrn: 'DEMO-0014', reasonForStay: 'Left knee replacement' };
const henry: Patient = { id: 'hw', name: 'Henry Walsh (synthetic)', initials: 'HW', dob: '01/27/1945', ageYears: 81, mrn: 'DEMO-0021', reasonForStay: 'COPD exacerbation' };

const REVIEWS = (): ReadmissionReview[] => [
  {
    id: 'rv-ml',
    patient: getPatient('ml'),
    queueName: 'Maria L.',
    birthYear: '1957',
    queueLine: 'Readmitted 11/21 · day 1 · DVT',
    queueAi: 'AI: Unrelated / unavoidable',
    queueTone: 'neutral',
    stay: 'Right hip replacement · discharged 11/20 10:12 to Oak Valley Skilled Nursing (demo)',
    daysAfter: 1,
    diagnosis: 'Left calf deep vein thrombosis (DVT)',
    arrival: 'Arrived via ED 11/21/2026 08:40 · admitted 09:30 · Medicine 3N',
    timelineRange: '11/20 10:12 – 11/21 09:30',
    events: [
      { t: '11/20 10:12', title: 'Packet uploaded', detail: 'Sam Ortiz, RN · 64 pages', kind: 'plain' },
      { t: '10:15', title: 'Brief approved and sent', detail: 'Reviewed by Sam Ortiz · 1 item edited · 1 question left for receiver', kind: 'plain' },
      { t: '10:15', title: 'Delivered to Oak Valley', detail: 'Oak Valley Skilled Nursing (demo) inbox', kind: 'plain' },
      { t: '11:02', title: 'Opened', detail: 'Dana Kim, RN · 47 min after delivery', kind: 'plain' },
      { t: '11:24', title: 'Acknowledged', detail: '3 critical items incl. START apixaban and warning signs · due 14:15', kind: 'ok', tag: 'On time · 1 h 9 m' },
      { t: '11:26', title: 'Question from Oak Valley', detail: 'Insulin glargine listed with no dose (p.12): dose and timing?', kind: 'bad', tag: 'Unanswered 20 h 16 m' },
      { t: '11:31', title: 'Hospital reply', detail: '"Checking with the prescribing team." No dose given afterwards.', kind: 'plain' },
      { t: '11/21 07:42', title: 'Urgent voice memo', detail: 'Jordan Reyes, LPN: left calf swollen, BP 160/95', kind: 'urgent' },
      { t: '07:46', title: 'Hospital reply', detail: 'Dr. Priya Shah: hold nothing, send to ED for DVT check', kind: 'ok', tag: 'Replied in 4 min' },
      { t: '09:30', title: 'Readmitted', detail: 'Left calf DVT · Medicine 3N', kind: 'admit' },
    ],
    aiPick: 'unrelated',
    confidence: 'medium',
    findings: [
      ['The readmission reason matches 2 brief items: ', { b: 'START apixaban' }, ' (', { page: 12 }, ') and the ', { b: 'calf swelling' }, ' warning sign (', { page: 4 }, '). Both were acknowledged on time.'],
      ['The facility reported calf swelling and got a reply in 4 minutes; the patient went to the ED within the hour.'],
      ["One gap found: the insulin glargine question went unanswered for 20 h 16 m. It isn't linked to a DVT."],
    ],
    notChecked: "Not checked: whether apixaban doses were given at the facility. Handoff can't see facility medication records.",
    secondary: { label: 'Also record secondary gap: question unanswered 20 h (insulin glargine)', summary: 'secondary: question unanswered' },
    handoffId: 'h-ml',
  },
  {
    id: 'rv-tn',
    patient: thomas,
    queueName: 'Thomas N.',
    birthYear: '1938',
    queueLine: 'Readmitted 11/19 · day 9 · pulmonary embolism',
    queueAi: 'AI: Critical item not acknowledged',
    queueTone: 'critical',
    stay: 'Left knee replacement · discharged 11/10 13:40 to Brightwater Home Health (demo)',
    daysAfter: 9,
    diagnosis: 'Pulmonary embolism',
    arrival: 'Arrived via ED 11/19/2026 21:05 · admitted 23:10 · Medicine 3N',
    timelineRange: '11/10 13:40 – 11/19 23:10',
    events: [
      { t: '11/10 13:40', title: 'Packet uploaded', detail: 'Sam Ortiz, RN · 52 pages', kind: 'plain' },
      { t: '13:52', title: 'Brief approved and sent', detail: 'Reviewed by Sam Ortiz · no edits', kind: 'plain' },
      { t: '13:52', title: 'Delivered to Brightwater', detail: 'Brightwater Home Health (demo) inbox', kind: 'plain' },
      { t: '11/11 09:15', title: 'Opened', detail: 'Intake coordinator · 19 h 23 m after delivery', kind: 'plain' },
      { t: '09:20', title: 'Acknowledged (partial)', detail: '2 of 3 critical items · START enoxaparin not marked reviewed', kind: 'bad', tag: 'Critical item not acknowledged' },
      { t: '11/19 21:05', title: 'Arrived at ED', detail: 'Shortness of breath, chest pain', kind: 'urgent' },
      { t: '23:10', title: 'Readmitted', detail: 'Pulmonary embolism · Medicine 3N', kind: 'admit' },
    ],
    aiPick: 'notack',
    confidence: 'high',
    findings: [
      ['The readmission reason matches the brief item ', { b: 'START enoxaparin' }, ' (', { page: 9 }, '), which was never marked reviewed.'],
      ['No messages about anticoagulation were sent in the thread.'],
    ],
    notChecked: "Not checked: whether enoxaparin was given at home. Handoff can't see agency medication records.",
  },
  {
    id: 'rv-hw',
    patient: henry,
    queueName: 'Henry W.',
    birthYear: '1945',
    queueLine: 'Readmitted 11/17 · day 12 · COPD flare',
    queueAi: 'AI: Item missing from brief',
    queueTone: 'important',
    stay: 'COPD exacerbation · discharged 11/05 11:20 to Maple Street Primary Care (demo)',
    daysAfter: 12,
    diagnosis: 'COPD exacerbation',
    arrival: 'Arrived via ED 11/17/2026 06:30 · admitted 08:05 · Medicine 3N',
    timelineRange: '11/05 11:20 – 11/17 08:05',
    events: [
      { t: '11/05 11:20', title: 'Packet uploaded', detail: 'Sam Ortiz, RN · 38 pages', kind: 'plain' },
      { t: '11:31', title: 'Brief approved and sent', detail: 'Reviewed by Sam Ortiz · no edits', kind: 'plain' },
      { t: '13:02', title: 'Opened', detail: 'Maple Street front desk · 1 h 31 m after delivery', kind: 'plain' },
      { t: '13:40', title: 'Acknowledged', detail: '2 critical items · due 15:31', kind: 'ok', tag: 'On time · 2 h 9 m' },
      { t: '11/17 08:05', title: 'Readmitted', detail: 'COPD exacerbation · Medicine 3N', kind: 'admit' },
    ],
    aiPick: 'missing',
    confidence: 'low',
    findings: [
      ['The packet lists a ', { b: 'prednisone taper' }, ' (', { page: 22 }, ') that does not appear in the brief.'],
      ['The brief was acknowledged on time and no questions were asked.'],
    ],
    notChecked: "Not checked: whether a follow-up visit happened. Handoff can't see clinic schedules.",
  },
];

let reviewsCache: ReadmissionReview[] | undefined;
export async function listReadmissionReviews(): Promise<ReadmissionReview[]> {
  reviewsCache ??= REVIEWS();
  return latency(reviewsCache);
}

// ---------- leadership metrics ----------
export type KpiTone = 'ok' | 'warn' | 'bad';
export interface Kpi {
  label: string;
  value: string;
  delta: string;
  dir: 'down' | 'up' | 'ok' | 'warn';
  tone: KpiTone;
  detail: string;
  src: string;
}
export const METRIC_RANGE = '08/23–11/20/2026';
export const KPIS: Kpi[] = [
  { label: '30-day readmission rate', value: '11.9%', delta: '2.0 pts lower than prior 90 days', dir: 'down', tone: 'ok', detail: '49 of 412 discharges returned within 30 days', src: 'Riverside ADT feed (demo)' },
  { label: 'Median time to acknowledge', value: '1 h 42 m', delta: 'Within 4 h target', dir: 'ok', tone: 'ok', detail: 'From delivery to named acknowledgment', src: 'Handoff event log' },
  { label: 'Acknowledged on time', value: '86%', delta: '9 pts below 95% target', dir: 'warn', tone: 'warn', detail: '353 of 412 before their due-by time', src: 'Handoff event log' },
  { label: 'Overdue right now', value: '2', delta: 'Both escalated to backup contacts', dir: 'warn', tone: 'bad', detail: 'Live count · 11/20 14:30', src: 'Handoff event log' },
];

export interface TrendSeries {
  key: string;
  title: string;
  months: string[];
  values: number[];
  min: number;
  max: number;
  ticks: number[];
  unit: 'pct1' | 'pct';
  src: string;
  target?: number;
}
export const TRENDS: TrendSeries[] = [
  { key: 'c1', title: '30-day readmission rate', months: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'], values: [14.6, 14.1, 13.2, 12.4, 11.6, 11.2], min: 8, max: 16, ticks: [8, 10, 12, 14, 16], unit: 'pct1', src: 'Riverside ADT feed (demo)' },
  { key: 'c2', title: 'Handoffs acknowledged on time', months: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'], values: [71, 76, 80, 84, 87, 88], min: 60, max: 100, ticks: [60, 70, 80, 90, 100], unit: 'pct', src: 'Handoff event log', target: 95 },
];

export const FAILURE_COUNTS: { label: string; n: number; kind: 'unrelated' | 'gap' | 'pending' }[] = [
  { label: 'Unrelated / unavoidable', n: 16, kind: 'unrelated' },
  { label: 'Critical item not acknowledged', n: 9, kind: 'gap' },
  { label: 'Question unanswered over 12 h', n: 7, kind: 'gap' },
  { label: 'Item missing from brief', n: 5, kind: 'gap' },
  { label: 'Brief not opened in time', n: 4, kind: 'gap' },
  { label: 'Review pending', n: 8, kind: 'pending' },
];
export const READMIT_TOTAL = 49;

export const FACILITY_ROWS: { name: string; n: number; onTime: string; median: string; readmit: string; belowTarget: boolean }[] = [
  { name: 'Oak Valley Skilled Nursing (demo)', n: 168, onTime: '94%', median: '1 h 10 m', readmit: '10.7%', belowTarget: false },
  { name: 'Brightwater Home Health (demo)', n: 132, onTime: '76%', median: '2 h 55 m', readmit: '14.4%', belowTarget: true },
  { name: 'Maple Street Primary Care (demo)', n: 112, onTime: '85%', median: '1 h 35 m', readmit: '10.7%', belowTarget: true },
];

export const PROCEDURE_ROWS: { name: string; readmits: number; discharges: number }[] = [
  { name: 'Hip fracture repair', readmits: 7, discharges: 38 },
  { name: 'Heart failure', readmits: 11, discharges: 72 },
  { name: 'COPD', readmits: 7, discharges: 49 },
  { name: 'Hip replacement', readmits: 7, discharges: 64 },
  { name: 'Pneumonia', readmits: 6, discharges: 58 },
  { name: 'Other', readmits: 7, discharges: 80 },
  { name: 'Knee replacement', readmits: 4, discharges: 51 },
];
export const PROCEDURE_FILTERS = ['Hip replacement', 'Knee replacement', 'Hip fracture repair', 'Heart failure', 'COPD', 'Pneumonia'];

// ---------- admin console ----------
export type ConsoleUserStatus = 'Active' | 'Invited' | 'Deactivated';
export interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  mfa: string;
  last: string;
  status: ConsoleUserStatus;
}
export const ADMIN_ROLES = ['Discharge nurse', 'Physician', 'Case manager', 'Quality reviewer', 'Unit clerk', 'Administrator'];
export const ADMIN_UNITS = ['Ortho 4W', 'Medicine 3N', 'Cardiology 5E', 'Neuro 6S', 'Surgery 2S'];
export const CONSOLE_USERS: ConsoleUser[] = [
  { id: 'cu1', name: 'Sam Ortiz, RN (demo)', email: 'sam.ortiz@riverside.example', role: 'Discharge nurse', unit: 'Ortho 4W', mfa: 'Authenticator app', last: 'Today 14:28', status: 'Active' },
  { id: 'cu2', name: 'Dr. Priya Shah (demo)', email: 'priya.shah@riverside.example', role: 'Physician', unit: 'Medicine 3N', mfa: 'Passkey', last: 'Today 07:46', status: 'Active' },
  { id: 'cu3', name: 'Marcus Lee (demo)', email: 'marcus.lee@riverside.example', role: 'Case manager', unit: 'Cardiology 5E', mfa: 'Authenticator app', last: 'Yesterday', status: 'Active' },
  { id: 'cu4', name: 'Elena Ruiz (demo)', email: 'elena.ruiz@riverside.example', role: 'Quality reviewer', unit: 'All units', mfa: 'Passkey', last: 'Today 10:05', status: 'Active' },
  { id: 'cu5', name: 'Kevin Brandt (demo)', email: 'kevin.brandt@riverside.example', role: 'Administrator', unit: 'All units', mfa: 'Security key', last: 'Now', status: 'Active' },
  { id: 'cu6', name: 'Nora Fitz (demo)', email: 'nora.fitz@riverside.example', role: 'Unit clerk', unit: 'Ortho 4W', mfa: 'Authenticator app', last: 'Today 09:12', status: 'Active' },
  { id: 'cu7', name: 'Tom Hale (demo)', email: 'tom.hale@riverside.example', role: 'Discharge nurse', unit: 'Neuro 6S', mfa: 'Not set up', last: 'Never', status: 'Invited' },
  { id: 'cu8', name: 'Ana Sousa (demo)', email: 'ana.sousa@riverside.example', role: 'Case manager', unit: 'Medicine 3N', mfa: 'Removed', last: '10/02/2026', status: 'Deactivated' },
];

/** Y = yes, U = own unit, N = no; one letter per role in ADMIN_ROLES order. */
export const PERMISSIONS: { label: string; sub: string; cells: string }[] = [
  { label: 'Create handoffs', sub: 'Upload packets, pick patient and receiver', cells: 'UYUNUN' },
  { label: 'Approve and send AI brief', sub: 'Sign the "Reviewed and approved" step', cells: 'UYUNNN' },
  { label: 'View full packet', sub: '', cells: 'UYUYNN' },
  { label: 'Download packet', sub: 'Always asks for a reason, watermarked', cells: 'UYUYNN' },
  { label: 'Reveal sensitive sections', sub: 'Behavioral health, HIV status, substance use', cells: 'UYNYNN' },
  { label: 'Message aftercare', sub: 'Text and voice in patient threads', cells: 'UYUNNN' },
  { label: 'Review readmissions', sub: 'Confirm or change failure points', cells: 'NYYYNN' },
  { label: 'View leadership metrics', sub: '', cells: 'NYYYNN' },
  { label: 'Manage users and roles', sub: '', cells: 'NNNNNY' },
  { label: 'Search the audit log', sub: '', cells: 'NNNYNY' },
];

export type ConnStatus = 'Connected' | 'Request pending' | 'Suspended';
export interface Connection {
  name: string;
  type: string;
  status: ConnStatus;
  detail: string;
  actions: { label: string; kind: 'secondary' | 'danger' | 'primary' | 'accent' }[];
}
export const CONNECTIONS: Connection[] = [
  { name: 'Oak Valley Skilled Nursing (demo)', type: 'Skilled nursing facility', status: 'Connected', detail: 'Since 03/2026 · 168 handoffs in 90 days · agreement on file to 03/2027', actions: [{ label: 'Manage', kind: 'secondary' }] },
  { name: 'Brightwater Home Health (demo)', type: 'Home health agency', status: 'Connected', detail: 'Since 05/2026 · 132 handoffs in 90 days · agreement on file to 05/2027', actions: [{ label: 'Manage', kind: 'secondary' }] },
  { name: 'Maple Street Primary Care (demo)', type: 'Primary care practice', status: 'Connected', detail: 'Since 06/2026 · 112 handoffs in 90 days · agreement on file to 06/2027', actions: [{ label: 'Manage', kind: 'secondary' }] },
  { name: 'Cedar Hills Rehab (demo)', type: 'Inpatient rehabilitation', status: 'Request pending', detail: 'Requested 11/18 by their administrator · agreement uploaded, not yet verified', actions: [{ label: 'Decline', kind: 'danger' }, { label: 'Approve', kind: 'primary' }] },
  { name: 'Lakeside Home Care (demo)', type: 'Home health agency', status: 'Suspended', detail: 'Suspended 10/30 · data-sharing agreement expired · no handoffs can be sent', actions: [{ label: 'Reactivate', kind: 'accent' }] },
];

export type AuditKind = 'view' | 'edit' | 'ack' | 'message' | 'download';
export interface AuditEntry {
  t: string;
  who: string;
  org: string;
  kind: AuditKind;
  action: string;
  detail: string;
}
export const AUDIT_FILTERS: { key: AuditKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All actions' },
  { key: 'view', label: 'Viewed' },
  { key: 'edit', label: 'Edited / approved' },
  { key: 'ack', label: 'Acknowledged' },
  { key: 'message', label: 'Messages' },
  { key: 'download', label: 'Downloads' },
];
/** Audit events for Maria Lopez (synthetic), 11/20–11/21. Views and downloads are privacy-relevant. */
export const AUDIT_ENTRIES: AuditEntry[] = [
  { t: '11/21 10:05:12', who: 'Elena Ruiz', org: 'Riverside General', kind: 'edit', action: 'Saved readmission review', detail: 'Finding: Unrelated / unavoidable (AI confirmed)' },
  { t: '11/21 09:58:40', who: 'Elena Ruiz', org: 'Riverside General', kind: 'view', action: 'Viewed', detail: 'Readmission review' },
  { t: '11/21 07:46:03', who: 'Dr. Priya Shah', org: 'Riverside General', kind: 'message', action: 'Sent message', detail: 'Reply to urgent voice memo' },
  { t: '11/21 07:44:20', who: 'Dr. Priya Shah', org: 'Riverside General', kind: 'view', action: 'Viewed', detail: 'Thread · urgent voice memo' },
  { t: '11/20 13:05:12', who: 'Dana Kim, RN', org: 'Oak Valley (demo)', kind: 'download', action: 'Downloaded PDF', detail: 'Reason: Print for bedside chart · watermarked' },
  { t: '11/20 11:31:47', who: 'Sam Ortiz, RN', org: 'Riverside General', kind: 'message', action: 'Sent message', detail: 'Reply about insulin glargine dose' },
  { t: '11/20 11:24:07', who: 'Dana Kim, RN', org: 'Oak Valley (demo)', kind: 'ack', action: 'Acknowledged', detail: '3 critical items · p.12, p.31, p.4' },
  { t: '11/20 10:16:30', who: 'Sam Ortiz, RN', org: 'Riverside General', kind: 'download', action: 'Downloaded PDF', detail: 'Reason: Continuity of care · watermarked' },
  { t: '11/20 10:15:02', who: 'Sam Ortiz, RN', org: 'Riverside General', kind: 'edit', action: 'Approved and sent brief', detail: '1 edited · 1 question left for receiver' },
  { t: '11/20 10:12:58', who: 'Sam Ortiz, RN', org: 'Riverside General', kind: 'edit', action: 'Uploaded packet', detail: '64 pages · patient confirmed by name + DOB' },
];
