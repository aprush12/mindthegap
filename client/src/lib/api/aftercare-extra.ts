// Extra synthetic demo data for the aftercare thread and activity screens.
// Seeded conversation history is merged with whatever the live store holds, so new messages
// sent in the demo appear after it. Synthetic data only.
import { getActivity, getOrg, getThread, getUser, type ActivityView, type ThreadMessage } from './index';
import type { ActivityEvent } from './types';

/** Static read receipts (demo). Live messages fall back to "Sent". */
const READ_BY: Record<string, string> = {
  'seed-ml-2': 'Read by Sam Ortiz · 11:09',
  'seed-ml-4': 'Read by Dr. Priya Shah · 11:14',
};
export const readReceipt = (m: ThreadMessage): string | undefined => READ_BY[m.id] ?? (m.authorId !== 'system' && m.status === 'sent' && m.id.startsWith('m-') ? 'Delivered' : undefined);

const SEED_MESSAGES: ThreadMessage[] = [
  { id: 'seed-ml-1', handoffId: 'h-ml', authorId: 'system', at: '2026-11-20T10:15:02', text: 'Handoff sent by Sam Ortiz, RN (demo)', status: 'sent' },
  { id: 'seed-ml-2', handoffId: 'h-ml', authorId: 'dana', at: '2026-11-20T11:06:30', text: 'Insulin glargine is listed on p.12 with no dose. Please confirm dose and timing.', quote: { kind: 'unclear', text: 'Insulin glargine listed with no dose', page: 12 }, status: 'sent' },
  { id: 'seed-ml-3', handoffId: 'h-ml', authorId: 'sam', at: '2026-11-20T11:09:47', text: 'Checking with the prescribing team. Will confirm the dose here.', status: 'sent' },
  {
    id: 'seed-ml-4', handoffId: 'h-ml', authorId: 'jordan', at: '2026-11-20T11:12:18', urgent: true, status: 'sent',
    voice: {
      durationSec: 14,
      transcript: "Patient's left calf looks swollen this morning, blood pressure 160 over 95, should we hold anything?",
      chips: [
        { label: 'Symptom', value: 'calf swelling' },
        { label: 'Vitals', value: 'BP 160/95' },
        { label: 'Urgency', value: 'high', tone: 'critical' },
      ],
      briefMatch: { text: 'calf swelling', page: 4 },
    },
  },
  { id: 'seed-ml-5', handoffId: 'h-ml', authorId: 'priya', at: '2026-11-20T11:16:03', text: 'Hold nothing yet. Send to ED for DVT check, calling now.', quote: { kind: 'brief', text: 'Replying to Jordan Reyes · voice memo 11:12', page: 0 }, status: 'sent' },
  { id: 'seed-ac-1', handoffId: 'h-ac', authorId: 'system', at: '2026-11-20T05:00:00', text: 'Handoff sent by Sam Ortiz, RN (demo)', status: 'sent' },
  { id: 'seed-sp-1', handoffId: 'h-sp', authorId: 'system', at: '2026-11-19T15:45:00', text: 'Handoff sent by Sam Ortiz, RN (demo)', status: 'sent' },
];

const SEED_ACTIVITY: ActivityEvent[] = [
  { id: 'seed-a2', handoffId: 'h-ml', at: '2026-11-20T11:06:30', actorId: 'dana', action: 'messaged', detail: 'Ask hospital · unclear item: insulin glargine listed with no dose (p.12)' },
  { id: 'seed-a3', handoffId: 'h-ml', at: '2026-11-20T11:09:47', actorId: 'sam', action: 'messaged', detail: 'Reply about insulin glargine dose' },
  { id: 'seed-a4', handoffId: 'h-ml', at: '2026-11-20T11:11:02', actorId: 'jordan', action: 'opened', detail: 'Brief', privacy: true },
  { id: 'seed-a5', handoffId: 'h-ml', at: '2026-11-20T11:12:18', actorId: 'jordan', action: 'voice_note', detail: 'Flagged urgent · 0:14 · auto-transcribed · chips: calf swelling, BP 160/95, urgency high' },
  { id: 'seed-a6', handoffId: 'h-ml', at: '2026-11-20T11:14:20', actorId: 'priya', action: 'opened', detail: 'Thread · urgent voice memo', privacy: true },
  { id: 'seed-a7', handoffId: 'h-ml', at: '2026-11-20T11:16:03', actorId: 'priya', action: 'messaged', detail: 'Reply to urgent voice memo: "Hold nothing yet. Send to ED for DVT check, calling now."' },
];

/** Thread for a handoff: seeded history plus everything in the live store, oldest first. */
export async function getThreadWithHistory(handoffId: string): Promise<ThreadMessage[]> {
  const live = await getThread(handoffId);
  return [...SEED_MESSAGES.filter((m) => m.handoffId === handoffId), ...live].sort((a, b) => a.at.localeCompare(b.at));
}

/** Activity log: seeded history plus the live store, newest first. */
export async function getActivityWithHistory(handoffId: string): Promise<ActivityView[]> {
  const live = await getActivity(handoffId);
  const seed = SEED_ACTIVITY.filter((a) => a.handoffId === handoffId).map((a) => {
    const actor = getUser(a.actorId);
    return { ...a, actor, org: getOrg(actor.orgId) };
  });
  return [...seed, ...live].sort((a, b) => b.at.localeCompare(a.at));
}

export type ActivityCategory = 'all' | 'view' | 'edit' | 'ack' | 'message' | 'download' | 'sensitive' | 'system';

export const ACTIVITY_CATEGORIES: { key: ActivityCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'view', label: 'Views' },
  { key: 'edit', label: 'Edits' },
  { key: 'ack', label: 'Acknowledgment' },
  { key: 'message', label: 'Messages' },
  { key: 'download', label: 'Downloads' },
  { key: 'sensitive', label: 'Sensitive reveals' },
  { key: 'system', label: 'System' },
];

export function activityCategory(a: ActivityEvent['action']): Exclude<ActivityCategory, 'all'> {
  switch (a) {
    case 'opened':
    case 'viewed_source':
      return 'view';
    case 'reviewed_item':
    case 'brief_approved':
      return 'edit';
    case 'acknowledged':
      return 'ack';
    case 'messaged':
    case 'voice_note':
      return 'message';
    case 'downloaded':
      return 'download';
    case 'revealed_sensitive':
      return 'sensitive';
    default:
      return 'system';
  }
}
