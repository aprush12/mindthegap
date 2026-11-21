// Extra synthetic demo data for the aftercare thread and activity screens.
// Synthetic data only.
import { getActivity, getThread, type ActivityView, type ThreadMessage } from './index';
import type { ActivityEvent } from './types';

/** Static read receipts (demo). Live messages fall back to "Sent". */
const READ_BY: Record<string, string> = {
  'seed-ml-2': 'Read by Sam Ortiz · 11:09',
  };
export const readReceipt = (m: ThreadMessage): string | undefined => READ_BY[m.id] ?? (m.authorId !== 'system' && m.status === 'sent' && m.id.startsWith('m-') ? 'Delivered' : undefined);

// Thread and activity history live in mock-data.ts so web and iPhone show the same record.
export const getThreadWithHistory = (handoffId: string): Promise<ThreadMessage[]> => getThread(handoffId);
export const getActivityWithHistory = (handoffId: string): Promise<ActivityView[]> => getActivity(handoffId);

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
