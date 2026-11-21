import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '../../../components/Icon';
import { PhoneScreen } from '../../../components/layout/Phone';
import { InboxRow, UnreadDot } from '../../../components/phone/InboxRow';
import { Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getThread, getUser, listHandoffs } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtShort } from '../../../lib/clock';
import { color } from '../../../theme/tokens';

/**
 * One secure thread per patient handoff. Message previews appear only inside the app;
 * push alerts never carry them (see Settings → What alerts say).
 */
export default function PhoneThreads() {
  const { data: rows } = useQuery(async () => {
    const all = await listHandoffs({ toOrgId: 'oakvalley' });
    const withLast = await Promise.all(
      all.map(async (v) => {
        const msgs = await getThread(v.handoff.id);
        return { v, last: msgs[msgs.length - 1] };
      }),
    );
    // Most recent activity first; threads with no messages sort by when the handoff arrived.
    return withLast.sort((a, b) => (b.last?.at ?? b.v.handoff.sentAt).localeCompare(a.last?.at ?? a.v.handoff.sentAt));
  }, []);

  return (
    <PhoneScreen title="Threads" subtitle="Secure messages with the discharging hospital" contentStyle={{ gap: 8 }}>
      {!rows ? <Loading /> : null}
      {rows?.map(({ v, last }) => {
        const unread = v.handoff.unreadMessages > 0;
        const who = last ? (last.authorId === 'system' ? 'Handoff' : getUser(last.authorId).short) : '';
        const preview = !last ? 'No messages yet' : last.voice ? `Voice memo · ${last.voice.transcript}` : (last.text ?? '');
        return (
          <InboxRow
            key={v.handoff.id}
            accessibilityLabel={`${unread ? 'Unread. ' : ''}${v.patient.name}, DOB ${v.patient.dob}. ${preview}`}
            onPress={() => router.push(`/m/thread/${v.handoff.id}` as never)}
            top={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {unread ? <UnreadDot /> : null}
                <Icon name="message" size={15} color={color.textSecondary} />
                <T size={13} weight={600} color={color.textSecondary} style={{ flexShrink: 1 }} numberOfLines={1}>
                  {v.from.name}
                </T>
                <T size={13} color={color.textTertiary} style={{ marginLeft: 'auto' }}>
                  {last ? fmtShort(last.at) : ''}
                </T>
              </View>
            }
            name={v.patient.name}
            sub={`DOB ${v.patient.dob}`}
            detail={
              <T size={15} lineHeight={20} color={last ? color.textPrimary : color.textTertiary} numberOfLines={2}>
                {last?.urgent ? <T size={15} weight={600} color={color.critical}>Urgent · </T> : null}
                {who && last?.authorId !== 'system' ? <T size={15} weight={600}>{who}: </T> : null}
                {preview}
              </T>
            }
          />
        );
      })}
    </PhoneScreen>
  );
}
