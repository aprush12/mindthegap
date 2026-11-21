import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View, Platform } from 'react-native';
import { Icon } from '../../../components/Icon';
import { useTopInset } from '../../../components/layout/Phone';
import { InboxRow, RowPill, RowSectionTitle, UnreadDot } from '../../../components/phone/InboxRow';
import { Group, ListRow, PhoneSegmented, PhoneSwitch } from '../../../components/phone/Parts';
import { DemoWatermark, Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getPatient, getThread, listHandoffs, type HandoffView, type ThreadMessage } from '../../../lib/api';
import { PHONE_OFFLINE_OUTBOX } from '../../../lib/api/phone-extra';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtTime, nowIso } from '../../../lib/clock';
import { color, font, radius, statusStyle } from '../../../theme/tokens';

type Filter = 'all' | 'handoffs' | 'messages';

/** iPhone inbox: overdue first, then new handoffs, then unread messages. `?offline=1` previews offline. */
export default function PhoneInbox() {
  const top = useTopInset();
  const params = useLocalSearchParams<{ offline?: string }>();
  const [offline, setOffline] = useState(params.offline === '1');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => fmtTime(nowIso()));
  const [refreshing, setRefreshing] = useState(false);
  const { data: rows, reload } = useQuery(() => listHandoffs({ toOrgId: 'oakvalley' }), []);
  const { data: lastMsg } = useQuery(async () => {
    const all = await listHandoffs({ toOrgId: 'oakvalley' });
    const out: Record<string, ThreadMessage | undefined> = {};
    for (const v of all) {
      const t = (await getThread(v.handoff.id)).filter((m) => m.authorId !== 'system');
      out[v.handoff.id] = t[t.length - 1];
    }
    return out;
  }, []);

  const match = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (v: HandoffView) => !s || [v.patient.name, v.patient.dob, v.patient.mrn].some((x) => x.toLowerCase().includes(s));
  }, [q]);

  if (!rows) return <Loading />;
  const open = rows.filter((v) => v.handoff.status !== 'acknowledged' && match(v));
  const unread = rows.filter((v) => v.handoff.unreadMessages > 0 && match(v));
  const done = rows.filter((v) => v.handoff.status === 'acknowledged');
  const showHandoffs = filter !== 'messages';
  const showMessages = filter !== 'handoffs';

  const refresh = () => {
    if (offline) return;
    setRefreshing(true);
    reload();
    setTimeout(() => {
      setUpdatedAt(fmtTime(nowIso()));
      setRefreshing(false);
    }, 400);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} enabled={!offline} />} contentContainerStyle={{ paddingTop: top, paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}>
        <View style={{ alignItems: 'center', paddingTop: 4, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {offline ? null : <Icon name="refresh" size={13} color={color.textTertiary} />}
          <T size={13} color={color.textTertiary}>
            {offline ? `Last updated ${updatedAt} · can't refresh offline` : `Updated ${updatedAt} · pull down to refresh`}
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <T accessibilityRole="header" size={34} lineHeight={41} weight={700} style={{ letterSpacing: -0.68 }}>
            Inbox
          </T>
          <T size={15} color={color.textSecondary} style={{ paddingBottom: 6 }}>
            Oak Valley (demo)
          </T>
        </View>
        <View style={{ height: 44, borderRadius: radius.lg, backgroundColor: '#E9EDF2', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={18} color={color.textTertiary} />
          <TextInput
            accessibilityLabel="Search"
            value={q}
            onChangeText={setQ}
            placeholder="Name, DOB or MRN"
            placeholderTextColor={color.textTertiary}
            autoCorrect={false}
            style={[{ flex: 1, height: 44, fontFamily: font.regular, fontSize: 17, color: color.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          />
        </View>
        <PhoneSegmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All' },
            { key: 'handoffs', label: 'Handoffs' },
            { key: 'messages', label: 'Messages' },
          ]}
        />

        {offline ? (
          <>
            <View accessibilityRole="summary" style={{ backgroundColor: color.ink, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="offline" size={20} color="#FFFFFF" />
              <T size={16} lineHeight={22} color="#FFFFFF" style={{ flex: 1 }}>
                You're offline. Drafts saved on this device (encrypted) and will send when connected.
              </T>
            </View>
            <View accessibilityLabel="Outbox" style={{ gap: 8 }}>
              <RowSectionTitle>{`Outbox · ${PHONE_OFFLINE_OUTBOX.length} waiting`}</RowSectionTitle>
              {PHONE_OFFLINE_OUTBOX.map((o) => {
                const p = getPatient(o.patientId);
                return (
                  <View key={o.id} style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.lg, padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Icon name="mic" size={18} color={color.textSecondary} />
                      <T size={16} weight={600} style={{ flex: 1 }}>
                        {o.title}
                      </T>
                      <T size={13} color={color.textTertiary}>
                        {o.at}
                      </T>
                    </View>
                    <T size={15} color={color.textSecondary}>
                      {p.name} · DOB {p.dob}
                    </T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="lock" size={14} color={color.success} />
                      <T size={14} color={color.success}>
                        Encrypted on this device · sends when connected
                      </T>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <View accessibilityLabel="Needs action" style={{ gap: 8 }}>
          <RowSectionTitle>Needs action</RowSectionTitle>
          {showHandoffs
            ? open.map((v) => {
                const overdue = v.handoff.status === 'overdue';
                const crit = v.criticalIds.length;
                const st = statusStyle.overdue;
                return (
                  <InboxRow
                    key={v.handoff.id}
                    urgent={overdue}
                    accessibilityLabel={`${overdue ? 'Overdue, escalated' : 'New handoff, unread'}. ${v.patient.name}, DOB ${v.patient.dob}. ${crit} critical`}
                    onPress={() => router.push(`/m/brief/${v.handoff.id}` as never)}
                    top={
                      overdue ? (
                        <RowPill icon={st.icon} label={st.label} fg={st.fg} bg={st.bg} border={st.border} />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <UnreadDot />
                          <RowPill icon="inbox" label="New handoff" fg={color.delivered} bg={color.deliveredBg} border={color.deliveredBorder} />
                          <T size={13} color={color.textTertiary} style={{ marginLeft: 'auto' }}>
                            {fmtTime(v.handoff.sentAt)}
                          </T>
                        </View>
                      )
                    }
                    name={v.patient.name}
                    sub={`DOB ${v.patient.dob} · ${overdue ? 'New handoff' : v.patient.reasonForStay}`}
                    detail={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="alert-triangle" size={15} color={color.critical} strokeWidth={2} />
                        <T size={15} color={color.critical} style={{ flexShrink: 1 }}>
                          {crit} critical{' '}
                          <T size={15} color={overdue ? color.critical : color.textSecondary}>
                            · {overdue ? 'was due' : 'acknowledge by'} {fmtTime(v.handoff.ackDueAt)}
                          </T>
                        </T>
                      </View>
                    }
                  />
                );
              })
            : null}
          {showMessages
            ? unread.map((v) => {
                const m = lastMsg?.[v.handoff.id];
                return (
                  <InboxRow
                    key={`m-${v.handoff.id}`}
                    accessibilityLabel={`New message, unread. ${v.patient.name}, DOB ${v.patient.dob}, from ${v.from.name}`}
                    onPress={() => router.push(`/m/thread/${v.handoff.id}` as never)}
                    top={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <UnreadDot />
                        <Icon name="message" size={15} color={color.textSecondary} />
                        <T size={13} weight={600} color={color.textSecondary}>
                          New message
                        </T>
                        <T size={13} color={color.textTertiary} style={{ marginLeft: 'auto' }}>
                          {m ? fmtTime(m.at) : ''}
                        </T>
                      </View>
                    }
                    name={v.patient.name}
                    sub={`DOB ${v.patient.dob} · from ${v.from.name}`}
                  />
                );
              })
            : null}
          {(showHandoffs ? open.length : 0) + (showMessages ? unread.length : 0) === 0 ? (
            <T size={15} color={color.textTertiary} style={{ paddingHorizontal: 4 }}>
              {q ? 'No matches.' : 'Nothing needs action.'}
            </T>
          ) : null}
        </View>

        <View accessibilityLabel="Done today" style={{ gap: 8 }}>
          <RowSectionTitle>Done today</RowSectionTitle>
          <Group>
            <ListRow
              label="Acknowledged"
              last={!showDone}
              accessibilityLabel={`Acknowledged, ${done.length}`}
              onPress={() => setShowDone((s) => !s)}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <T size={15} color={color.textTertiary}>
                    {done.length}
                  </T>
                  <Icon name={showDone ? 'chevron-down' : 'chevron-right'} size={18} color={color.textTertiary} />
                </View>
              }
            />
            {showDone
              ? done.map((v, i) => (
                  <ListRow key={v.handoff.id} indent last={i === done.length - 1} label={`${v.patient.name} · DOB ${v.patient.dob}`} onPress={() => router.push(`/m/brief/${v.handoff.id}` as never)} right={<Icon name="check-circle" size={18} color={color.success} />} />
                ))
              : null}
          </Group>
        </View>

        {/* Demo control: preview the offline state from design board PhoneInboxOffline. */}
        <Group>
          <ListRow label="Demo: preview offline" last right={<PhoneSwitch value={offline} onChange={setOffline} label="Demo: preview offline" />} />
        </Group>
      </ScrollView>
      <DemoWatermark phone />
    </View>
  );
}
