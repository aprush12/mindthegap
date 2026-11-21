import { Link, Redirect } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { HandoffMark, Icon, type IconName } from '../components/Icon';
import { DemoWatermark } from '../components/ui/States';
import { T } from '../components/ui/Text';
import { color, radius } from '../theme/tokens';

type Entry = { href: string; label: string; sub: string; icon: IconName; demo?: boolean };

const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Demo',
    entries: [
      { href: '/aftercare/h-ml', label: 'Aftercare handoff view', sub: 'Brief + PDF side by side, acknowledge', icon: 'file-text', demo: true },
      { href: '/m/capture', label: 'iPhone quick capture', sub: 'Record → review → confirm patient → send', icon: 'mic', demo: true },
    ],
  },
  {
    title: 'Web · aftercare facility',
    entries: [
      { href: '/aftercare', label: 'Handoff inbox', sub: 'Facility inbox, overdue first', icon: 'inbox' },
      { href: '/aftercare/h-ml/thread', label: 'Thread', sub: 'Secure thread for one patient', icon: 'message' },
      { href: '/aftercare/h-ml/activity', label: 'Activity log', sub: 'Every view, edit and download', icon: 'activity-log' },
    ],
  },
  {
    title: 'Web · hospital',
    entries: [
      { href: '/hospital', label: 'Status board', sub: 'Outgoing handoffs', icon: 'chart' },
      { href: '/hospital/new', label: 'New handoff', sub: 'Upload packet, generate brief', icon: 'upload' },
      { href: '/hospital/review/h-ml', label: 'Brief review', sub: 'Approve AI brief before sending', icon: 'sparkle' },
      { href: '/hospital/readmissions', label: 'Readmission review', sub: 'Quality', icon: 'refresh' },
      { href: '/hospital/metrics', label: 'Metrics dashboard', sub: 'Leadership', icon: 'chart' },
      { href: '/hospital/admin', label: 'Admin', sub: 'Users, roles, connections, audit', icon: 'users' },
    ],
  },
  {
    title: 'iPhone',
    entries: [
      { href: '/m/inbox', label: 'Inbox', sub: 'Needs action, done today', icon: 'inbox' },
      { href: '/m/brief/h-ml', label: 'Brief', sub: 'Review critical items, acknowledge', icon: 'file-text' },
      { href: '/m/pdf/h-ml', label: 'PDF viewer', sub: 'Packet at the cited page', icon: 'source' },
      { href: '/m/thread/h-ml', label: 'Thread', sub: 'Messages and voice memos', icon: 'message' },
      { href: '/m/settings', label: 'Settings', sub: 'Security, alerts, account', icon: 'settings' },
      { href: '/m/locked', label: 'Locked screen', sub: 'Privacy lock after inactivity', icon: 'lock' },
    ],
  },
  {
    title: 'System',
    entries: [{ href: '/design-system', label: 'Design system', sub: 'Tokens and components', icon: 'sparkle' }],
  },
];

/** Web: demo index. iPhone: straight into the app. */
export default function Index() {
  if (Platform.OS !== 'web') return <Redirect href={'/m/inbox' as never} />;
  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <ScrollView contentContainerStyle={{ padding: 32, gap: 32, maxWidth: 1100, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <HandoffMark size={36} />
          <T size={22} weight={700}>
            Handoff
          </T>
          <T size={13} color={color.textTertiary}>
            Demo build · synthetic data
          </T>
        </View>
        {GROUPS.map((g) => (
          <View key={g.title} style={{ gap: 12 }}>
            <T size={13} weight={600} color={color.textSecondary}>
              {g.title}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {g.entries.map((e) => (
                <Link key={e.href} href={e.href as never} asChild>
                  <Pressable accessibilityRole="link" style={{ flexGrow: 1, flexBasis: 300, maxWidth: 520, backgroundColor: color.bgSurface, borderWidth: e.demo ? 2 : 1, borderColor: e.demo ? color.accent : color.borderDefault, borderRadius: radius.lg, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.accentSubtle, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={e.icon} size={20} color={color.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T size={16} weight={600}>
                        {e.label}
                      </T>
                      <T size={14} color={color.textSecondary}>
                        {e.sub}
                      </T>
                    </View>
                    <Icon name="chevron-right" size={18} color={color.textTertiary} />
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <DemoWatermark />
    </View>
  );
}
