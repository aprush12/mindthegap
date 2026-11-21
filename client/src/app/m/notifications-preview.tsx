import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { HandoffMark, Icon } from '../../components/Icon';
import { useBottomInset, useTopInset } from '../../components/layout/Phone';
import { DemoWatermark } from '../../components/ui/States';
import { T } from '../../components/ui/Text';
import { assertPushIsPhiFree, buildPushNotification, type PushNotification } from '../../lib/api';
import { now } from '../../lib/clock';
import { color } from '../../theme/tokens';

/**
 * Lock-screen preview (design PhoneLockScreenPush). The cards are built only by
 * buildPushNotification and checked with assertPushIsPhiFree, the same path real pushes take.
 */
export default function NotificationsPreview() {
  const top = useTopInset();
  const bottom = useBottomInset();
  const d = now();
  const cards: { n: PushNotification; ago: string }[] = [
    { n: buildPushNotification('urgent_message'), ago: 'now' },
    { n: buildPushNotification('new_handoff'), ago: '21m ago' },
  ];
  cards.forEach((c) => assertPushIsPhiFree(c.n));
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#1B2A3A' }}>
      <View style={{ paddingTop: top, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/m/settings' as never))} style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
          <T size={17} weight={600} color="#FFFFFF">
            Done
          </T>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', gap: 2, marginTop: 0 }}>
        <T size={19} weight={600} color="#E7EDF3">
          {date}
        </T>
        <T size={92} lineHeight={100} weight={600} color="#FFFFFF" style={{ letterSpacing: -2.76 }}>
          {time}
        </T>
      </View>

      <View accessibilityLabel="Notifications" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 10, gap: 8 }}>
        {cards.map(({ n, ago }) => (
          <View key={n.kind} accessibilityLabel={`${n.title}, ${ago}. ${n.body}${n.subtitle ? ` ${n.subtitle}` : ''}`} style={{ backgroundColor: 'rgba(245,247,250,0.88)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <HandoffMark size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T size={15} weight={600}>
                  {n.title}
                </T>
                <T size={13} color={color.textSecondary}>
                  {ago}
                </T>
              </View>
              <T size={15} lineHeight={20}>
                {n.body}
              </T>
              {n.subtitle ? (
                <T size={15} lineHeight={20} color={color.textSecondary}>
                  {n.subtitle}
                </T>
              ) : null}
            </View>
          </View>
        ))}
        <View aria-hidden style={{ marginTop: -4, marginHorizontal: 14, height: 12, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: 'rgba(245,247,250,0.5)' }} />
        <T size={13} color="#D5DDE5" align="center">
          2 more from Handoff
        </T>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: bottom + 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="lock" size={14} color="#D5DDE5" />
        <T size={13} lineHeight={18} color="#D5DDE5" align="center" style={{ flexShrink: 1 }}>
          Same wording unlocked: details only appear inside Handoff.
        </T>
      </View>
      <DemoWatermark phone />
    </View>
  );
}
