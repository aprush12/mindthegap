import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { AppBar, MAX_W } from '../../components/layout/Shell';
import { Tabs } from '../../components/ui/Controls';
import { DemoWatermark, EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { Mono, T } from '../../components/ui/Text';
import { getCurrentUser, getOrg, getUser, listHandoffs, listOrgs, type HandoffView } from '../../lib/api';
import { useQuery } from '../../lib/api/useQuery';
import { fmtDuration, fmtFull, fmtMonthDay, fmtShort, fmtTime, minutesUntil, nowIso } from '../../lib/clock';
import { color, radius, statusStyle } from '../../theme/tokens';

type InboxTab = 'action' | 'msg' | 'ack' | 'all';

const isAction = (v: HandoffView) => v.handoff.status !== 'acknowledged';
const hasMsg = (v: HandoffView) => v.handoff.unreadMessages > 0;
const isAck = (v: HandoffView) => v.handoff.status === 'acknowledged';

/** Facility inbox (C-17 data). Overdue first, then due soonest. Every row carries name + DOB. */
export default function AftercareInbox() {
  const me = getCurrentUser();
  const myOrg = getOrg(me.orgId);
  const { data: rows, loading, error, reload } = useQuery(() => listHandoffs({ toOrgId: me.orgId }), [me.orgId]);
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const pad = narrow ? 16 : 32;
  const [tab, setTab] = useState<InboxTab>('action');
  const [from, setFrom] = useState<string>('all');

  const all = (rows ?? []).filter((v) => from === 'all' || v.handoff.fromOrgId === from);
  const pick = (t: InboxTab) => all.filter((v) => (t === 'action' ? isAction(v) : t === 'msg' ? hasMsg(v) : t === 'ack' ? isAck(v) : true));
  const shown = pick(tab);
  const today = nowIso();

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side="aftercare" />
      <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 28, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', zIndex: 5 }}>
            <View style={{ flexGrow: 1, flexBasis: 400, gap: 4 }}>
              <T accessibilityRole="header" size={28} lineHeight={36} weight={700} style={{ letterSpacing: -0.56 }}>
                Incoming handoffs
              </T>
              <T size={15} color={color.textSecondary}>
                {myOrg.name} · Today, {fmtFull(today).slice(0, 10)} · updated <Mono>{fmtTime(today)}</Mono>
              </T>
            </View>
            <FromSelect value={from} onChange={setFrom} />
          </View>

          <View style={{ borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
            <View style={{ marginBottom: -1 }}>
              <Tabs
                tabs={[
                  { key: 'action', label: `Needs action  ${pick('action').length}` },
                  { key: 'msg', label: `Messages  ${pick('msg').length}` },
                  { key: 'ack', label: `Acknowledged  ${pick('ack').length}` },
                  { key: 'all', label: `All  ${all.length}` },
                ]}
                active={tab}
                onChange={setTab}
              />
            </View>
          </View>
          <T size={13} color={color.textTertiary}>
            Sorted by urgency (overdue, then due soonest) · every row shows the patient's full name and date of birth
          </T>

          {loading ? (
            <Loading label="Loading handoffs" />
          ) : error ? (
            <ErrorState title="Couldn't load handoffs" body="Nothing was changed. If this keeps happening, call the hospital before acting on a new discharge." onRetry={reload} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={tab === 'ack' ? 'check-circle' : 'inbox'}
              title={tab === 'action' ? 'Nothing needs action' : tab === 'msg' ? 'No new messages' : tab === 'ack' ? 'Nothing acknowledged yet' : 'No handoffs'}
              body={tab === 'action' ? 'Every incoming handoff has been acknowledged. New discharges appear here as soon as the hospital sends them.' : 'New handoffs and messages from the hospital appear here.'}
              actionLabel={tab === 'all' ? undefined : 'Show all handoffs'}
              onAction={() => setTab('all')}
            />
          ) : (
            <View accessibilityLabel="Handoffs" style={{ gap: 10 }}>
              {shown.map((v) => (
                <InboxRow key={v.handoff.id} view={v} msgMode={tab === 'msg'} narrow={narrow} today={today} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <DemoWatermark />
    </View>
  );
}

function FromSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const opts = [{ id: 'all', name: 'All hospitals' }, ...listOrgs().filter((o) => o.kind === 'hospital')];
  const cur = opts.find((o) => o.id === value) ?? opts[0];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 20 }}>
      <T size={14} color={color.textSecondary}>
        From
      </T>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter by hospital: ${cur.name}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={{ height: 40, minWidth: 200, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.bgSurface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <T size={14} weight={500} style={{ flex: 1 }}>
            {cur.name}
          </T>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={color.textSecondary} />
        </Pressable>
        {open ? (
          <View accessibilityRole="menu" style={{ position: 'absolute', top: 44, right: 0, minWidth: '100%', backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, paddingVertical: 4, shadowColor: '#0F1B2A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            {opts.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: o.id === value }}
                onPress={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                style={({ pressed }) => ({ height: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed || o.id === value ? color.accentSubtle : 'transparent' })}
              >
                <T size={14} weight={o.id === value ? 600 : 400} numberOfLines={1}>
                  {o.name}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Status pill with inbox wording ("New handoff" for delivered-not-opened, "New message"). */
function InboxPill({ label, fg, bg, border, icon }: { label: string; fg: string; bg: string; border: string; icon: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: border, alignSelf: 'flex-start' }}>
      <Icon name={icon} size={14} color={fg} strokeWidth={2} />
      <T size={13} weight={600} color={fg}>
        {label}
      </T>
    </View>
  );
}

function InboxRow({ view, msgMode, narrow, today }: { view: HandoffView; msgMode: boolean; narrow: boolean; today: string }) {
  const { handoff: h, patient, from } = view;
  const overdue = h.status === 'overdue';
  const acked = h.status === 'acknowledged';
  const notOpened = !h.openedAt && !acked;
  const unread = notOpened || h.unreadMessages > 0;
  const total = view.criticalIds.length;
  const reviewed = acked ? total : view.criticalReviewed;

  const pill =
    msgMode && h.unreadMessages > 0
      ? { label: 'New message', fg: color.textPrimary, bg: color.bgSurface, border: color.borderStrong, icon: 'message' as IconName }
      : notOpened && !overdue
        ? { ...statusStyle.delivered, label: 'New handoff' }
        : statusStyle[h.status];

  const note = overdue
    ? `Escalated to ${from.short} at ${fmtTime(h.escalatedAt)} · discharge team notified`
    : msgMode && h.unreadMessages > 0
      ? `${h.unreadMessages} new message${h.unreadMessages === 1 ? '' : 's'}${acked ? ' on an acknowledged handoff' : ''}`
      : acked
        ? `Acknowledged ${fmtTime(h.acknowledgedAt)} by ${getUser(h.acknowledgedBy ?? '').short}`
        : h.openedAt
          ? `Opened ${fmtTime(h.openedAt)} by ${getUser(h.openedBy ?? '').short}`
          : 'Delivered · not opened';

  const sameDay = (iso: string) => fmtMonthDay(iso) === fmtMonthDay(today);
  const due = sameDay(h.ackDueAt) ? fmtTime(h.ackDueAt) : fmtShort(h.ackDueAt);
  const mins = minutesUntil(h.ackDueAt);
  const dueRel = acked ? 'done' : mins < 0 ? `${fmtDuration(-mins)} late` : `in ${fmtDuration(mins)}`;

  const crit = acked ? `${total} of ${total} critical reviewed` : notOpened && !overdue ? `${total} critical item${total === 1 ? '' : 's'}` : `${reviewed} of ${total} critical reviewed`;
  const critBad = !acked && (notOpened || reviewed === 0);
  const critColor = critBad ? color.critical : color.textSecondary;

  const patientCell = (
    <View style={{ gap: 2, minWidth: 0 }}>
      <T size={17} lineHeight={24} weight={unread ? 700 : 600}>
        {patient.name}
      </T>
      <T size={14} color={color.textSecondary}>
        DOB <Mono>{patient.dob}</Mono> · MRN <Mono>{patient.mrn}</Mono>
      </T>
      <T size={13} color={color.textTertiary}>
        From {from.name} · received <Mono>{sameDay(h.deliveredAt ?? h.sentAt) ? fmtTime(h.deliveredAt ?? h.sentAt) : fmtShort(h.deliveredAt ?? h.sentAt)}</Mono>
      </T>
    </View>
  );
  const statusCell = (
    <View style={{ gap: 6 }}>
      <InboxPill {...pill} />
      <T size={13} color={overdue ? color.critical : color.textSecondary}>
        {note}
      </T>
    </View>
  );
  const dueCell = (
    <View style={{ gap: 2 }}>
      <T size={13} color={color.textTertiary}>
        Due by
      </T>
      <T size={15} weight={600} color={overdue ? color.critical : color.textPrimary}>
        <Mono>{due}</Mono> · {dueRel}
      </T>
    </View>
  );
  const critCell = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={acked ? 'check-circle' : 'alert-triangle'} size={16} color={critColor} />
      <T size={15} color={critColor} style={{ flexShrink: 1 }}>
        {crit}
      </T>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${patient.name}, date of birth ${patient.dob}. ${pill.label}. ${note}. Due by ${due}, ${dueRel}. ${crit}.${unread ? ' Unread.' : ''}`}
      onPress={() => router.navigate(`/aftercare/${h.id}` as never)}
      style={(state) => {
        const s = state as typeof state & { hovered?: boolean };
        return {
          backgroundColor: s.hovered ? color.accentSelectedBg : color.bgSurface,
          borderWidth: overdue ? 2 : 1,
          borderColor: overdue ? color.criticalBorder : s.hovered ? color.deliveredBorder : color.borderDefault,
          borderRadius: radius.lg,
          paddingVertical: 16,
          paddingHorizontal: narrow ? 16 : 20,
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: narrow ? 12 : 16,
        };
      }}
    >
      {narrow ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View accessibilityLabel={unread ? 'Unread' : 'Read'} style={{ width: 10, height: 10, borderRadius: 999, marginTop: 8, backgroundColor: unread ? color.accent : 'transparent' }} />
            <View style={{ flex: 1 }}>{patientCell}</View>
            <Icon name="chevron-right" size={20} color={color.textTertiary} />
          </View>
          {statusCell}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {dueCell}
            {critCell}
          </View>
        </>
      ) : (
        <>
          <View style={{ width: 16, alignItems: 'center' }}>
            <View accessibilityLabel={unread ? 'Unread' : 'Read'} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: unread ? color.accent : 'transparent' }} />
          </View>
          <View style={{ flex: 1.4, minWidth: 0 }}>{patientCell}</View>
          <View style={{ flex: 1.2, minWidth: 0 }}>{statusCell}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{dueCell}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{critCell}</View>
          <Icon name="chevron-right" size={20} color={color.textTertiary} />
        </>
      )}
    </Pressable>
  );
}
