// Synthetic demo data only. No real patients, people or organizations.
import type { ActivityEvent, AdminUser, Brief, Handoff, Metric, Org, Patient, ReadmissionCase, ThreadMessage, User } from './types';

export const ORGS: Org[] = [
  { id: 'riverside', name: 'Riverside General (demo)', short: 'Riverside General', kind: 'hospital', onCallNumber: '[ON-CALL NUMBER]' },
  { id: 'oakvalley', name: 'Oak Valley Skilled Nursing (demo)', short: 'Oak Valley', kind: 'snf', onCallNumber: '[ON-CALL NUMBER]' },
  { id: 'brightwater', name: 'Brightwater Home Health (demo)', short: 'Brightwater', kind: 'snf', onCallNumber: '[ON-CALL NUMBER]' },
  { id: 'maple', name: 'Maple Street Primary Care (demo)', short: 'Maple Street', kind: 'snf', onCallNumber: '[ON-CALL NUMBER]' },
];

export const USERS: User[] = [
  { id: 'dana', name: 'Dana Kim, RN (demo)', short: 'Dana Kim', initials: 'DK', role: 'RN', orgId: 'oakvalley', email: 'dana.kim@oakvalley.example' },
  { id: 'jordan', name: 'Jordan Reyes, LPN (demo)', short: 'Jordan Reyes', initials: 'JR', role: 'LPN', orgId: 'oakvalley', email: 'jordan.reyes@oakvalley.example' },
  { id: 'sam', name: 'Sam Ortiz, RN (demo)', short: 'Sam Ortiz', initials: 'SO', role: 'Discharge RN', orgId: 'riverside', email: 'sam.ortiz@riverside.example' },
  { id: 'priya', name: 'Dr. Priya Shah, Hospitalist (demo)', short: 'Dr. Priya Shah', initials: 'PS', role: 'Hospitalist', orgId: 'riverside', email: 'priya.shah@riverside.example' },
  { id: 'system', name: 'Handoff', short: 'Handoff', initials: 'H', role: 'System', orgId: 'riverside', email: '' },
];

export const PATIENTS: Patient[] = [
  { id: 'ml', name: 'Maria Lopez (synthetic)', initials: 'ML', dob: '03/14/1957', ageYears: 69, mrn: 'DEMO-0001', reasonForStay: 'Right hip replacement' },
  { id: 'sp', name: 'Sam Patel (synthetic)', initials: 'SP', dob: '12/30/1940', ageYears: 85, mrn: 'DEMO-0002', reasonForStay: 'Pneumonia' },
  { id: 'ac', name: 'Alex Chen (synthetic)', initials: 'AC', dob: '09/02/1949', ageYears: 77, mrn: 'DEMO-0003', reasonForStay: 'CHF exacerbation' },
];

export const HANDOFFS: Handoff[] = [
  {
    id: 'h-ml', patientId: 'ml', fromOrgId: 'riverside', toOrgId: 'oakvalley', sentBy: 'sam',
    dischargedAt: '2026-11-20T10:12', sentAt: '2026-11-20T10:15', deliveredAt: '2026-11-20T10:15', openedAt: '2026-11-20T11:02', openedBy: 'dana',
    ackDueAt: '2026-11-20T14:15', status: 'opened', pageCount: 64, reviewedCriticalIds: ['apx'], unreadMessages: 0,
  },
  {
    id: 'h-ac', patientId: 'ac', fromOrgId: 'riverside', toOrgId: 'oakvalley', sentBy: 'sam',
    dischargedAt: '2026-11-20T04:40', sentAt: '2026-11-20T05:00', deliveredAt: '2026-11-20T05:00',
    ackDueAt: '2026-11-20T09:00', escalatedAt: '2026-11-20T09:01', status: 'overdue', pageCount: 41, reviewedCriticalIds: [], unreadMessages: 0,
  },
  {
    id: 'h-sp', patientId: 'sp', fromOrgId: 'riverside', toOrgId: 'oakvalley', sentBy: 'sam',
    dischargedAt: '2026-11-19T15:30', sentAt: '2026-11-19T15:45', deliveredAt: '2026-11-19T15:45', openedAt: '2026-11-19T16:10', openedBy: 'dana',
    ackDueAt: '2026-11-19T19:45', acknowledgedAt: '2026-11-19T16:40', acknowledgedBy: 'dana', status: 'acknowledged', pageCount: 38, reviewedCriticalIds: ['sp-1', 'sp-2'], unreadMessages: 1,
  },
];

export const BRIEFS: Brief[] = [
  {
    handoffId: 'h-ml',
    generatedAt: '2026-11-20T10:14',
    model: 'Mock summarizer (no model call)',
    sources: [
      { id: 'apx', page: 12, section: 'Discharge medication reconciliation · New medications', tag: 'START apixaban', quote: 'apixaban 2.5 mg tablet — take 1 tablet by mouth twice daily for 35 days' },
      { id: 'ibu', page: 31, section: 'Home medications · Discontinue', tag: 'STOP home ibuprofen', quote: 'Discontinue: ibuprofen (home medication)' },
      { id: 'warn', page: 4, section: 'When to call your surgeon', tag: 'Warning signs', quote: 'Call your surgeon for calf swelling, chest pain, or drainage from the wound.' },
      { id: 'wound', page: 40, section: 'Wound care', tag: 'Wound care', quote: 'Keep the dressing dry. Change the dressing every 48 hours.' },
      { id: 'ortho', page: 5, section: 'Follow-up appointments', tag: 'Ortho follow-up', quote: 'Orthopedic follow-up in 2 weeks. Staples out on day 14.' },
      { id: 'ins', page: 12, section: 'Discharge medication reconciliation · Continued medications', tag: 'Unclear · insulin glargine', quote: 'insulin glargine — subcutaneous — dose: ________' },
    ],
    groups: [
      {
        id: 'meds', title: 'Medication changes', icon: 'pill', note: 'Changed doses: none found in packet.',
        items: [
          { id: 'apx', priority: 'critical', kind: 'Started', text: 'START apixaban 2.5 mg twice daily × 35 days', sourceId: 'apx' },
          { id: 'ibu', priority: 'critical', kind: 'Stopped', text: 'STOP home ibuprofen', sourceId: 'ibu' },
        ],
      },
      {
        id: 'warn', title: 'Warning signs', icon: 'alert-triangle',
        items: [{ id: 'warn', priority: 'critical', text: 'Warning signs: calf swelling, chest pain, wound drainage → call surgeon', sourceId: 'warn' }],
      },
      { id: 'wound', title: 'Wound / device care', icon: 'bandage', items: [{ id: 'wound', priority: 'important', text: 'Keep dressing dry, change every 48 h', sourceId: 'wound' }] },
      {
        id: 'follow', title: 'Follow-ups and pending results', icon: 'calendar', note: 'Pending results: none found in packet.',
        items: [{ id: 'ortho', priority: 'important', text: 'Ortho follow-up in 2 weeks · staples out day 14', sourceId: 'ortho' }],
      },
      { id: 'restrict', title: 'Restrictions', icon: 'restriction', note: 'No activity or weight-bearing restrictions found in the packet. Check the full packet before assuming none apply.', items: [] },
    ],
    unclear: [
      { id: 'ins', text: 'Insulin glargine listed with no dose', sourceId: 'ins', suggestedQuestion: 'Insulin glargine is listed on p.12 with no dose. Please confirm dose and timing.', open: true },
    ],
    sensitive: [{ id: 'bh', title: 'Behavioral health', body: '[Section text from the packet]' }],
  },
  {
    handoffId: 'h-ac',
    generatedAt: '2026-11-20T04:58',
    model: 'Mock summarizer (no model call)',
    sources: [
      { id: 'ac-1', page: 8, section: 'Discharge medications', tag: 'CHANGE furosemide', quote: 'furosemide 40 mg by mouth twice daily (was 20 mg daily)' },
      { id: 'ac-2', page: 3, section: 'Daily weights', tag: 'Daily weights', quote: 'Weigh every morning. Call for gain of more than 2 lb in a day or 5 lb in a week.' },
    ],
    groups: [
      { id: 'meds', title: 'Medication changes', icon: 'pill', items: [{ id: 'ac-1', priority: 'critical', kind: 'Changed', text: 'CHANGE furosemide to 40 mg twice daily', sourceId: 'ac-1' }] },
      { id: 'warn', title: 'Warning signs', icon: 'alert-triangle', items: [{ id: 'ac-2', priority: 'critical', text: 'Daily weights: call for gain > 2 lb/day or 5 lb/week', sourceId: 'ac-2' }] },
    ],
    unclear: [],
    sensitive: [],
  },
  {
    handoffId: 'h-sp',
    generatedAt: '2026-11-19T15:44',
    model: 'Mock summarizer (no model call)',
    sources: [
      { id: 'sp-1', page: 6, section: 'Discharge medications', tag: 'START levofloxacin', quote: 'levofloxacin 750 mg by mouth daily for 5 days' },
      { id: 'sp-2', page: 2, section: 'Return precautions', tag: 'Warning signs', quote: 'Return for fever over 101°F or worsening shortness of breath.' },
    ],
    groups: [
      { id: 'meds', title: 'Medication changes', icon: 'pill', items: [{ id: 'sp-1', priority: 'critical', kind: 'Started', text: 'START levofloxacin 750 mg daily × 5 days', sourceId: 'sp-1' }] },
      { id: 'warn', title: 'Warning signs', icon: 'alert-triangle', items: [{ id: 'sp-2', priority: 'critical', text: 'Warning signs: fever > 101°F, worsening shortness of breath', sourceId: 'sp-2' }] },
    ],
    unclear: [],
    sensitive: [],
  },
];

export const MESSAGES: ThreadMessage[] = [
  { id: 'm-sp-1', handoffId: 'h-sp', authorId: 'sam', at: '2026-11-21T10:02', text: 'Chest X-ray read came back: no change. No action needed.', status: 'sent' },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: 'a1', handoffId: 'h-ml', at: '2026-11-20T10:14:02', actorId: 'system', action: 'brief_generated', detail: 'Priority brief generated · 6 items · 3 critical · 1 unclear' },
  { id: 'a2', handoffId: 'h-ml', at: '2026-11-20T10:15:10', actorId: 'sam', action: 'sent', detail: 'Discharge packet · 64 pages' },
  { id: 'a3', handoffId: 'h-ml', at: '2026-11-20T10:15:12', actorId: 'system', action: 'delivered', detail: 'Oak Valley inbox' },
  { id: 'a4', handoffId: 'h-ml', at: '2026-11-20T11:02:33', actorId: 'dana', action: 'opened', detail: 'Brief and packet', privacy: true },
  { id: 'a5', handoffId: 'h-ml', at: '2026-11-20T11:10:05', actorId: 'dana', action: 'reviewed_item', detail: 'START apixaban · p.12' },
  { id: 'a6', handoffId: 'h-ac', at: '2026-11-20T05:00:00', actorId: 'sam', action: 'sent', detail: 'Discharge packet · 41 pages' },
  { id: 'a7', handoffId: 'h-ac', at: '2026-11-20T09:01:00', actorId: 'system', action: 'escalated', detail: 'Not acknowledged by 09:00 · Riverside discharge team notified' },
  { id: 'a8', handoffId: 'h-sp', at: '2026-11-19T16:40:00', actorId: 'dana', action: 'acknowledged', detail: '2 critical items · p.6, p.2' },
];

export const METRICS: Metric[] = [
  { id: 'open', label: 'Time to open', value: '47', unit: 'min', target: 'Within 2 h target', tone: 'ok' },
  { id: 'ack', label: 'Time to acknowledge', value: '1 h 9 min', parts: [{ n: '1', unit: 'h' }, { n: '9', unit: 'min' }], target: 'Within 4 h target', tone: 'ok' },
  { id: 'overdue', label: 'Overdue handoffs', value: '[N]', target: 'Above target of 0', tone: 'bad' },
  { id: 'readmit', label: '30-day readmissions', value: '[VALUE]', target: 'Hospital view · next pass', tone: 'pending' },
];

export const READMISSIONS: ReadmissionCase[] = [
  {
    id: 'r1', patientId: 'ac', readmittedAt: '2026-11-24T06:10', daysAfterDischarge: 4, reason: 'Fluid overload', handoffId: 'h-ac',
    findings: [
      { text: 'Handoff acknowledged 3 h 40 min late (escalated at 09:01)', tone: 'bad' },
      { text: 'Critical item "CHANGE furosemide" reviewed at acknowledgment', tone: 'ok' },
      { text: 'No daily-weight updates logged in thread', tone: 'warn' },
    ],
  },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: 'u1', name: 'Dana Kim, RN (demo)', email: 'dana.kim@oakvalley.example', orgId: 'oakvalley', role: 'Clinician', mfa: 'passkey', lastActive: '2026-11-21T07:50', status: 'active' },
  { id: 'u2', name: 'Jordan Reyes, LPN (demo)', email: 'jordan.reyes@oakvalley.example', orgId: 'oakvalley', role: 'Clinician', mfa: 'authenticator', lastActive: '2026-11-21T07:42', status: 'active' },
  { id: 'u3', name: 'Sam Ortiz, RN (demo)', email: 'sam.ortiz@riverside.example', orgId: 'riverside', role: 'Discharge coordinator', mfa: 'passkey', lastActive: '2026-11-21T06:30', status: 'active' },
  { id: 'u4', name: 'Dr. Priya Shah (demo)', email: 'priya.shah@riverside.example', orgId: 'riverside', role: 'Clinician', mfa: 'passkey', lastActive: '2026-11-21T07:46', status: 'active' },
  { id: 'u5', name: 'Lee Morgan (demo)', email: 'lee.morgan@riverside.example', orgId: 'riverside', role: 'Quality reviewer', mfa: 'authenticator', lastActive: '2026-11-18T15:12', status: 'active' },
  { id: 'u6', name: 'Rae Park (demo)', email: 'rae.park@riverside.example', orgId: 'riverside', role: 'Admin', mfa: 'none', lastActive: '—', status: 'invited' },
];

/** The signed-in user for the demo (aftercare side). */
export const CURRENT_USER_ID = 'dana';
