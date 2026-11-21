import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ADMIN_ROLES, ADMIN_UNITS, CONSOLE_USERS, type ConsoleUserStatus } from '../../lib/api/quality-extra';
import { color, font, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Select } from '../quality/Select';
import { Tag, type Tone } from '../quality/Tag';
import { Button } from '../ui/Button';
import { Field, Radio } from '../ui/Controls';
import { T } from '../ui/Text';

const COLS = [1.6, 1, 0.9, 1.2, 0.8, 0.8];
const STATUS_TONE: Record<ConsoleUserStatus, Tone> = { Active: 'success', Invited: 'accent', Deactivated: 'neutral' };
const NAME_MODES = [
  { key: 'initials', label: 'Initials only', ex: 'M.L. · born 1957' },
  { key: 'partial', label: 'First name + last initial', ex: 'Maria L. · born 1957' },
  { key: 'full', label: 'Full name', ex: 'Maria Lopez (synthetic) · DOB 03/14/1957' },
];

/** Admin · Users: search, invite, deactivate; privacy defaults on the side. */
export function UsersTab() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [inviting, setInviting] = useState(false);
  const [status, setStatus] = useState<Record<string, ConsoleUserStatus>>({});
  const [nm, setNm] = useState('partial');
  const [timeout, setTimeoutMin] = useState('15');

  const needle = q.trim().toLowerCase();
  const users = CONSOLE_USERS.filter((u) => (role === 'all' || u.role === role) && (!needle || u.name.toLowerCase().includes(needle) || u.email.includes(needle)));

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <View accessibilityLabel="Users" style={{ flexGrow: 999, flexShrink: 1, flexBasis: 760, minWidth: 0, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, height: 40, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
            <Icon name="search" size={16} color={color.textTertiary} />
            <TextInput
              accessibilityLabel="Search users"
              value={q}
              onChangeText={setQ}
              placeholder="Search name or email"
              placeholderTextColor={color.textTertiary}
              style={[{ flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 15, color: color.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            />
          </View>
          <Select label="Filter by role" value={role} onChange={setRole} options={[{ value: 'all', label: 'All roles' }, ...ADMIN_ROLES.map((r) => ({ value: r, label: r }))]} />
          <Button label="Invite user" icon="plus" fontSize={14} style={{ paddingHorizontal: 14 }} onPress={() => setInviting(!inviting)} />
        </View>

        {inviting ? <InviteForm onDone={() => setInviting(false)} /> : null}

        <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <View accessibilityRole="table" style={{ minWidth: 900, flex: 1 }}>
              <View accessibilityRole="row" style={{ flexDirection: 'row', backgroundColor: color.bgSunken, borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
                {['User', 'Role', 'Unit', 'Multi-factor', 'Last active', 'Status'].map((h, i) => (
                  <View key={h} style={{ flex: COLS[i], paddingVertical: 12, paddingHorizontal: 14 }}>
                    <T size={13} weight={600} color={color.textSecondary}>
                      {h}
                    </T>
                  </View>
                ))}
                <View style={{ width: 110 }} accessibilityLabel="Actions" />
              </View>
              {users.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <T size={14} color={color.textSecondary}>
                    No users match. Try another name, email or role.
                  </T>
                </View>
              ) : null}
              {users.map((u) => {
                const st = status[u.id] ?? u.status;
                const mfaOk = u.mfa !== 'Not set up' && u.mfa !== 'Removed';
                const mfaC = mfaOk ? color.success : u.mfa === 'Not set up' ? color.important : color.textTertiary;
                const act = st === 'Active' ? 'Deactivate' : st === 'Invited' ? 'Resend' : 'Reactivate';
                return (
                  <View key={u.id} accessibilityRole="row" style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.borderSubtle, opacity: st === 'Deactivated' ? 0.75 : 1 }}>
                    <View style={{ flex: COLS[0], paddingVertical: 10, paddingHorizontal: 14 }}>
                      <T size={14} weight={600}>
                        {u.name}
                      </T>
                      <T size={13} color={color.textTertiary} numberOfLines={1}>
                        {u.email}
                      </T>
                    </View>
                    <Cell i={1}>{u.role}</Cell>
                    <Cell i={2} c={color.textSecondary}>
                      {u.unit}
                    </Cell>
                    <View style={{ flex: COLS[3], paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name={mfaOk ? 'check' : 'alert-circle'} size={14} color={mfaC} strokeWidth={2} />
                      <T size={14} weight={500} color={mfaC}>
                        {u.mfa}
                      </T>
                    </View>
                    <Cell i={4} c={color.textSecondary}>
                      {u.last}
                    </Cell>
                    <View style={{ flex: COLS[5], paddingVertical: 10, paddingHorizontal: 14 }}>
                      <Tag label={st} tone={STATUS_TONE[st]} pill />
                    </View>
                    <View style={{ width: 110, paddingVertical: 10, paddingHorizontal: 14 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${act} ${u.name}`}
                        onPress={() => act !== 'Resend' && setStatus((s) => ({ ...s, [u.id]: st === 'Active' ? 'Deactivated' : 'Active' }))}
                        style={({ pressed }) => ({ height: 36, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.bgSurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.85 : 1 })}
                      >
                        <T size={13} weight={600} color={act === 'Deactivate' ? color.critical : color.accent}>
                          {act}
                        </T>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 18, gap: 14 }}>
        <T accessibilityRole="header" size={17} lineHeight={24} weight={600}>
          Privacy defaults
        </T>
        <View accessibilityRole="radiogroup" accessibilityLabel="Names in patient lists" style={{ gap: 4 }}>
          <T size={14} weight={600} color={color.textSecondary} style={{ paddingBottom: 6 }}>
            Names in patient lists
          </T>
          {NAME_MODES.map((n) => (
            <Pressable key={n.key} accessibilityRole="radio" accessibilityState={{ selected: nm === n.key }} onPress={() => setNm(n.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
              <Radio selected={nm === n.key} size={18} />
              <View style={{ flex: 1 }}>
                <T size={15} lineHeight={20}>
                  {n.label}
                </T>
                <T size={13} color={color.textTertiary}>
                  {n.ex}
                </T>
              </View>
            </Pressable>
          ))}
          <T size={13} color={color.textTertiary}>
            Full name, DOB and MRN always show once a handoff is opened.
          </T>
        </View>
        <View style={{ gap: 6 }}>
          <T size={14} weight={600} color={color.textSecondary}>
            Sign out after inactivity
          </T>
          <Select label="Sign out after inactivity" value={timeout} onChange={setTimeoutMin} options={[{ value: '15', label: '15 minutes' }, { value: '10', label: '10 minutes' }, { value: '5', label: '5 minutes' }]} />
        </View>
        <View style={{ gap: 8 }}>
          <LockedSetting label="Multi-factor sign-in" value="Required for all" />
          <LockedSetting label="Download watermark" value="Always on" />
        </View>
      </View>
    </View>
  );
}

function Cell({ i, children, c }: { i: number; children: React.ReactNode; c?: string }) {
  return (
    <View style={{ flex: COLS[i], paddingVertical: 10, paddingHorizontal: 14 }}>
      <T size={14} color={c}>
        {children}
      </T>
    </View>
  );
}

function LockedSetting({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <T size={14}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="lock" size={14} color={color.textSecondary} />
        <T size={14} color={color.textSecondary}>
          {value}
        </T>
      </View>
    </View>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ADMIN_ROLES[0]);
  const [unit, setUnit] = useState(ADMIN_UNITS[0]);
  const item = { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 } as const;
  return (
    <View accessibilityLabel="Invite user" style={{ backgroundColor: color.bgSurface, borderWidth: 2, borderColor: color.accent, borderRadius: radius.lg, padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
      <Field label="Work email" value={email} onChangeText={setEmail} placeholder="name@riverside.example" keyboardType="email-address" autoCapitalize="none" containerStyle={item} />
      <View style={[item, { gap: 6 }]}>
        <T size={13} weight={600} color={color.textSecondary}>
          Role
        </T>
        <Select label="Role" value={role} onChange={setRole} options={ADMIN_ROLES.filter((r) => r !== 'Administrator')} />
      </View>
      <View style={[item, { gap: 6 }]}>
        <T size={13} weight={600} color={color.textSecondary}>
          Unit
        </T>
        <Select label="Unit" value={unit} onChange={setUnit} options={ADMIN_UNITS} />
      </View>
      <View style={[item, { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }]}>
        <Button label="Cancel" variant="secondary" fontSize={14} style={{ paddingHorizontal: 12 }} onPress={onDone} />
        <Button label="Send invite" fontSize={14} style={{ paddingHorizontal: 14 }} onPress={onDone} />
      </View>
      <T size={13} color={color.textTertiary} style={{ width: '100%' }}>
        Invites expire in 72 hours. The user must set up multi-factor authentication before seeing any patient.
      </T>
    </View>
  );
}
