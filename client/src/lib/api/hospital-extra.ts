// Synthetic demo data for the hospital (sending) side: extra status-board rows, units,
// receiving-facility contacts and the demo packet used by "New handoff". No real people.
import { fmtShort, fmtTime, nowIso } from '../clock';
import type { HandoffView } from './index';

/** The signed-in user on the hospital side of the demo. */
export const HOSPITAL_USER_ID = 'sam';

export const UNITS = ['Ortho 4W', 'Medicine 3N', 'Cardiology 5E', 'Neuro 6S', 'Surgery 2S'] as const;

/** Unit and bed for the seeded patients (not part of the shared Patient record). */
export const PATIENT_LOCATION: Record<string, { unit: string; bed: string }> = {
  ml: { unit: 'Ortho 4W', bed: '12' },
  ac: { unit: 'Medicine 3N', bed: '7' },
  sp: { unit: 'Cardiology 5E', bed: '3' },
};

/** Receiving-facility contacts from the Handoff directory (placeholders). */
export const ORG_CONTACTS: Record<string, { primary: string; primaryOptions: string[]; backupOptions: string[] }> = {
  oakvalley: { primary: 'Dana Kim, RN', primaryOptions: ['Dana Kim, RN · Admissions (demo)', 'Oak Valley admissions team'], backupOptions: ['Jordan Reyes, LPN · Charge (demo)'] },
  brightwater: { primary: 'Chris Adeyemi, RN', primaryOptions: ['Chris Adeyemi, RN · Intake (demo)', 'Brightwater intake team'], backupOptions: ['Morgan Lee, RN · Supervisor (demo)'] },
  maple: { primary: 'Dr. Lena Park', primaryOptions: ['Dr. Lena Park · PCP (demo)', 'Maple Street front desk'], backupOptions: ['Ari Gold, NP (demo)'] },
};

export type BoardStatus = 'draft' | 'sent' | 'opened' | 'ack' | 'overdue';

export interface BoardRow {
  key: string;
  first: string;
  last: string;
  dob: string;
  mrn: string;
  unit: string;
  toOrgId: string;
  toName: string;
  contact: string;
  sentAt?: string; // ISO local
  dueAt?: string; // ISO local
  status: BoardStatus;
  crit: string; // "0 of 2 reviewed"
  esc: { text: string; done: boolean }[];
  note: string;
  action: 'Open' | 'Review' | 'View' | 'Call facility';
  /** Set only for rows backed by a real handoff in the store; the others are board-only demo rows. */
  handoffId?: string;
}

const D = (hm: string) => `2026-11-20T${hm}`;
const ORG_NAME: Record<string, string> = {
  oakvalley: 'Oak Valley Skilled Nursing (demo)',
  brightwater: 'Brightwater Home Health (demo)',
  maple: 'Maple Street Primary Care (demo)',
};

type Seed = [first: string, last: string, dob: string, mrn: string, unit: string, org: string, sent: string | null, due: string | null, status: BoardStatus, crit: string, esc: [string, boolean][], note: string, action: BoardRow['action']];
const SEEDS: Seed[] = [
  ['Thomas', 'Nguyen', '04/17/1938', 'DEMO-0007', 'Ortho 4W', 'brightwater', '08:40', '12:40', 'overdue', '0 of 3 reviewed', [['Reminder sent 12:40', true], ['Backup contact notified 13:40', true], ['Charge nurse call due 14:40', false]], '', 'Call facility'],
  ['Robert', 'King', '07/19/1948', 'DEMO-0011', 'Ortho 4W', 'oakvalley', null, null, 'draft', '—', [], 'Brief generating · 38 of 64 pages', 'View'],
  ['Rosa', 'Delgado', '11/30/1951', 'DEMO-0006', 'Neuro 6S', 'oakvalley', null, null, 'draft', '—', [], 'Brief ready for your review', 'Review'],
  ['Grace', 'Okafor', '06/21/1962', 'DEMO-0004', 'Ortho 4W', 'brightwater', '12:05', '16:05', 'opened', '1 of 2 reviewed', [], 'Opened 12:50 by Chris Adeyemi', 'Open'],
  ['Henry', 'Walsh', '01/08/1945', 'DEMO-0005', 'Medicine 3N', 'maple', '13:30', '17:30', 'sent', '0 of 1 reviewed', [], 'Delivered 13:30 · not opened', 'Open'],
  ['James', 'Carter', '02/26/1955', 'DEMO-0009', 'Cardiology 5E', 'oakvalley', '13:55', '17:55', 'sent', '0 of 4 reviewed', [], 'Delivered 13:55 · not opened', 'Open'],
  ['Aisha', 'Rahman', '10/12/1970', 'DEMO-0010', 'Surgery 2S', 'maple', '11:10', '15:10', 'ack', '1 of 1 reviewed', [], 'Acknowledged 11:58 · 48 min', 'Open'],
  ['Linda', 'Brooks', '08/05/1966', 'DEMO-0008', 'Medicine 3N', 'maple', '06:50', '10:50', 'ack', '2 of 2 reviewed', [], 'Acknowledged 09:05 · 2 h 15 min', 'Open'],
];

/** Board-only demo rows (no detail screen behind them). */
export const EXTRA_BOARD_ROWS: BoardRow[] = SEEDS.map((s) => ({
  key: s[3],
  first: s[0],
  last: s[1],
  dob: s[2],
  mrn: s[3],
  unit: s[4],
  toOrgId: s[5],
  toName: ORG_NAME[s[5]],
  contact: ORG_CONTACTS[s[5]].primary,
  sentAt: s[6] ? D(s[6]) : undefined,
  dueAt: s[7] ? D(s[7]) : undefined,
  status: s[8],
  crit: s[9],
  esc: s[10].map(([text, done]) => ({ text, done })),
  note: s[11],
  action: s[12],
}));

/** Escalation steps already taken for seeded overdue handoffs (from the escalation service). */
const ESCALATIONS: Record<string, { text: string; done: boolean }[]> = {
  'h-ac': [
    { text: 'Reminder sent to Dana Kim 09:00', done: true },
    { text: 'Backup contact Jordan Reyes notified 10:00', done: true },
    { text: 'Charge nurse call due 15:00', done: false },
  ],
};

const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
const dur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const sameDay = (iso?: string) => !!iso && iso.slice(0, 10) === nowIso().slice(0, 10);
/** Board time cell: "HH:MM" today, "MM/DD HH:MM" otherwise. */
export const boardTime = (iso?: string) => (!iso ? '—' : sameDay(iso) ? fmtTime(iso) : fmtShort(iso));

/** Maps a live handoff from the store onto a board row. */
export function boardRowFromView(v: HandoffView): BoardRow {
  const h = v.handoff;
  const [first, ...rest] = v.patient.name.replace(' (synthetic)', '').split(' ');
  const status: BoardStatus = h.status === 'acknowledged' ? 'ack' : h.status === 'overdue' ? 'overdue' : h.status === 'opened' ? 'opened' : 'sent';
  const contact = ORG_CONTACTS[h.toOrgId]?.primary ?? v.to.short;
  const note =
    status === 'ack'
      ? `Acknowledged ${boardTime(h.acknowledgedAt)} · ${dur(minutesBetween(h.sentAt, h.acknowledgedAt!))}`
      : status === 'opened'
        ? `Opened ${boardTime(h.openedAt)} by ${contact}`
        : status === 'sent'
          ? `Delivered ${boardTime(h.deliveredAt ?? h.sentAt)} · not opened`
          : '';
  return {
    key: h.id,
    first,
    last: rest.join(' '),
    dob: v.patient.dob,
    mrn: v.patient.mrn,
    unit: PATIENT_LOCATION[v.patient.id]?.unit ?? '—',
    toOrgId: h.toOrgId,
    toName: v.to.name,
    contact,
    sentAt: h.sentAt,
    dueAt: h.ackDueAt,
    status,
    crit: `${v.criticalReviewed} of ${v.criticalIds.length} reviewed`,
    esc: status === 'overdue' ? (ESCALATIONS[h.id] ?? [{ text: `Escalated ${boardTime(h.escalatedAt)}`, done: true }]) : [],
    note,
    action: status === 'overdue' ? 'Call facility' : 'Open',
    handoffId: h.id,
  };
}

const RANK: Record<BoardStatus, number> = { overdue: 0, draft: 1, opened: 2, sent: 2, ack: 3 };
/** Overdue first, then drafts, then open handoffs by due time; acknowledged last, most recent first. */
export function sortBoard(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => {
    const r = RANK[a.status] - RANK[b.status];
    if (r) return r;
    const da = a.dueAt ?? '';
    const db = b.dueAt ?? '';
    return a.status === 'ack' ? db.localeCompare(da) : da.localeCompare(db);
  });
}

// ---------- new handoff ----------

/** Demo placeholder for a picked file (no document picker is installed). */
export const DEMO_PACKET = {
  fileName: 'Maria Lopez discharge packet.pdf',
  sizeLabel: '14.2 MB',
  pageCount: 64,
  patientId: 'ml',
  /** Identifiers printed on packet page 1, used for the patient match check. */
  page1: { name: 'Maria Lopez', dob: '03/14/1957', mrn: 'DEMO-0001' },
};

/** A second, rejected file to demonstrate the password-protected check. */
export const DEMO_REJECTED_FILE = 'scan_0042.pdf';

/** Patient search results for "maria lop": the right patient plus a look-alike name. */
export const LOOKALIKE_PATIENTS = [
  { id: 'ml-lookalike', name: 'Maria Lopes (synthetic)', dob: '07/22/1961', mrn: 'DEMO-0014', loc: 'Medicine 3N, bed 4' },
];

export const ACK_WINDOWS = [
  { key: '2', label: '2 hours', hours: 2 },
  { key: '4', label: '4 hours', hours: 4 },
  { key: '8', label: '8 hours', hours: 8 },
  { key: 'c', label: 'Custom…', hours: 4 },
] as const;

/** Pages the mock reader "couldn't read" in the error preview. */
export const UNREADABLE_PAGES = [22, 23, 24];

export const HOSPITAL_DOWNLOAD_REASONS = [
  { key: 'care', label: 'Continuity of care' },
  { key: 'chart', label: 'Printing for chart' },
  { key: 'family', label: 'Patient or family request' },
  { key: 'other', label: 'Other (add a note)' },
] as const;
