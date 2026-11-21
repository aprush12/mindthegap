import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HandoffMark, Icon } from '../../../components/Icon';
import { PhoneScreen } from '../../../components/layout/Phone';
import { Group, GroupFooter, GroupHeader, ListRow, LockedValue, PhoneSwitch } from '../../../components/phone/Parts';
import { Avatar } from '../../../components/ui/Badges';
import { T } from '../../../components/ui/Text';
import { assertPushIsPhiFree, buildPushNotification, getCurrentUser, getOrg, listOrgs, listPatients, type PushKind, type PushNotification } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { color, radius } from '../../../theme/tokens';

const PUSH_KINDS: { kind: PushKind; when: string }[] = [
  { kind: 'new_handoff', when: 'New handoff arrives' },
  { kind: 'new_message', when: 'Hospital replies' },
  { kind: 'urgent_message', when: 'Urgent message' },
];

/**
 * Proves the alert wording rule on screen: every push text comes from buildPushNotification,
 * passes assertPushIsPhiFree, and contains none of the demo patients' names, DOBs or MRNs,
 * nor any facility name.
 */
function usePhiCheck(pushes: PushNotification[]) {
  const { data: patients } = useQuery(() => listPatients(), []);
  if (!patients) return undefined;
  const needles = [...patients.flatMap((p) => [p.name.replace(' (synthetic)', ''), p.dob, p.mrn]), ...listOrgs().flatMap((o) => [o.name.replace(' (demo)', ''), o.short])].map((s) => s.toLowerCase());
  return pushes.every((n) => {
    try {
      assertPushIsPhiFree(n);
    } catch {
      return false;
    }
    const all = [n.title, n.body, n.subtitle ?? ''].join(' ').toLowerCase();
    return !needles.some((x) => all.includes(x));
  });
}

export default function PhoneSettings() {
  const me = getCurrentUser();
  const org = getOrg(me.orgId);
  const [sw, setSw] = useState({ nh: true, nm: true, od: true, fid: true, fack: true });
  const flip = (k: keyof typeof sw) => (v: boolean) => setSw((s) => ({ ...s, [k]: v }));
  // Demo: the privacy gate currently locks at a fixed 5 minutes (IDLE_LOCK_MS); this picker is UI only.
  const [lock, setLock] = useState(5);
  const [lockOpen, setLockOpen] = useState(false);
  const pushes = PUSH_KINDS.map((p) => buildPushNotification(p.kind));
  const phiFree = usePhiCheck(pushes);

  return (
    <PhoneScreen title="Settings" contentStyle={{ gap: 0 }}>
      <View style={{ backgroundColor: color.bgSurface, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 24 }}>
        <Avatar initials={me.initials} size={48} />
        <View style={{ flex: 1 }}>
          <T size={17} weight={600}>
            {me.name}
          </T>
          <T size={15} color={color.textSecondary}>
            {org.name}
          </T>
        </View>
      </View>

      <GroupHeader>Notifications</GroupHeader>
      <Group>
        <ListRow label="New handoffs" right={<PhoneSwitch value={sw.nh} onChange={flip('nh')} label="New handoffs" />} />
        <ListRow label="New messages" right={<PhoneSwitch value={sw.nm} onChange={flip('nm')} label="New messages" />} />
        <ListRow label="Overdue reminders" right={<PhoneSwitch value={sw.od} onChange={flip('od')} label="Overdue reminders" />} />
        <ListRow label="Urgent messages" right={<LockedValue text="Always on" />} />
        <ListRow label="Lock-screen preview" last right={<LockedValue icon="eye-off" text="No patient details" />} />
      </Group>
      <GroupFooter>Alerts only ever say "New handoff waiting in Handoff". Names and diagnoses stay inside the app.</GroupFooter>

      <GroupHeader>What alerts say</GroupHeader>
      <Group>
        {PUSH_KINDS.map((p, i) => {
          const n = pushes[i];
          return (
            <View key={p.kind} style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: color.borderSubtle }}>
              <T size={13} weight={600} color={color.textTertiary}>
                {p.when}
              </T>
              <View accessibilityLabel={`Alert text: ${n.title}. ${n.body}${n.subtitle ? ` ${n.subtitle}` : ''}`} style={{ backgroundColor: color.bgCanvas, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 10 }}>
                <HandoffMark size={28} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={15} weight={600}>
                    {n.title}
                  </T>
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
            </View>
          );
        })}
        <View accessibilityRole="summary" style={{ minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: color.borderSubtle }}>
          <Icon name={phiFree === false ? 'alert-triangle' : 'shield-check'} size={20} color={phiFree === false ? color.critical : color.success} />
          <T size={15} lineHeight={20} color={phiFree === false ? color.critical : color.success} style={{ flex: 1 }}>
            {phiFree === undefined ? 'Checking alert text…' : phiFree ? 'Checked: no patient name, DOB, MRN, diagnosis, facility or message text.' : 'Alert text failed the patient-info check.'}
          </T>
        </View>
        <ListRow label="Preview lock screen" last onPress={() => router.push('/m/notifications-preview' as never)} right={<Icon name="chevron-right" size={18} color={color.textTertiary} />} />
      </Group>
      <GroupFooter>Push, lock screen, banners and badges use only these fixed texts. Badges show counts only.</GroupFooter>

      <GroupHeader>Security</GroupHeader>
      <Group>
        <ListRow label="Face ID to open" right={<PhoneSwitch value={sw.fid} onChange={flip('fid')} label="Face ID to open" />} />
        <ListRow label="Face ID to acknowledge" right={<PhoneSwitch value={sw.fack} onChange={flip('fack')} label="Face ID to acknowledge" />} />
        <ListRow
          label="Auto-lock"
          accessibilityLabel={`Auto-lock, after ${lock} minutes`}
          onPress={() => setLockOpen((o) => !o)}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={17} color={color.textSecondary}>
                After {lock} min
              </T>
              <Icon name={lockOpen ? 'chevron-up' : 'chevron-down'} size={18} color={color.textTertiary} />
            </View>
          }
        />
        {lockOpen ? (
          <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderSubtle }}>
            {[1, 2, 5].map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ selected: m === lock }}
                onPress={() => {
                  setLock(m);
                  setLockOpen(false);
                }}
                style={{ minHeight: 48, paddingLeft: 28, paddingRight: 14, flexDirection: 'row', alignItems: 'center' }}
              >
                <T size={17} style={{ flex: 1 }}>
                  {m} {m === 1 ? 'minute' : 'minutes'}
                </T>
                {m === lock ? <Icon name="check" size={20} color={color.accent} strokeWidth={2.4} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <ListRow label="Hide in app switcher" last right={<LockedValue text="Always on" />} />
      </Group>
      <GroupFooter>{org.short} (demo) allows auto-lock of 5 minutes or less. Locked settings are set by your organization.</GroupFooter>

      <GroupHeader>Privacy</GroupHeader>
      <Group>
        <ListRow
          label="Offline drafts"
          right={
            <T size={15} color={color.textSecondary}>
              Encrypted · 0 waiting
            </T>
          }
        />
        <ListRow label="Lock now" last onPress={() => router.replace({ pathname: '/m/locked', params: { from: '/m/settings' } } as never)} right={<Icon name="lock" size={18} color={color.textTertiary} />} />
      </Group>
      <GroupFooter>Your access is recorded. Drafts are deleted from this device when you sign out.</GroupFooter>

      {/* Placeholder: no sign-in flow on iPhone yet; returns to the demo index. */}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/' as never)} style={({ pressed }) => ({ backgroundColor: pressed ? color.bgSunken : color.bgSurface, borderRadius: radius.lg, minHeight: 52, alignItems: 'center', justifyContent: 'center' })}>
        <T size={17} weight={600} color={color.critical}>
          Sign out
        </T>
      </Pressable>
      <T size={13} color={color.textTertiary} align="center" style={{ marginTop: 8 }}>
        Handoff 0.1 · demo build
      </T>
    </PhoneScreen>
  );
}
