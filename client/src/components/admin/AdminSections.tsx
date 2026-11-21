import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ADMIN_ROLES, AUDIT_ENTRIES, AUDIT_FILTERS, CONNECTIONS, PERMISSIONS, type AuditKind, type ConnStatus } from '../../lib/api/quality-extra';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { Select } from '../quality/Select';
import { Tag, type Tone } from '../quality/Tag';
import { Button, type ButtonVariant } from '../ui/Button';
import { Field } from '../ui/Controls';
import { EmptyState } from '../ui/States';
import { T } from '../ui/Text';

const tableBox = { backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' } as const;
const headRow = { flexDirection: 'row', backgroundColor: color.bgSunken, borderBottomWidth: 1, borderBottomColor: color.borderDefault } as const;

// ---------- Roles & permissions ----------
const CELL: Record<string, { label: string; tone: Tone; icon?: IconName; dash?: boolean; ring?: boolean }> = {
  Y: { label: 'Yes', tone: 'success', icon: 'check' },
  U: { label: 'Own unit', tone: 'accent', ring: true },
  N: { label: 'No', tone: 'muted', dash: true },
};

export function RolesTab() {
  return (
    <View accessibilityLabel="Role permissions" style={tableBox}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View accessibilityRole="table" style={{ minWidth: 1000, flex: 1 }}>
          <View accessibilityRole="row" style={headRow}>
            <View style={{ flex: 2.2, paddingVertical: 12, paddingHorizontal: 16 }}>
              <T size={13} weight={600} color={color.textSecondary}>
                Permission
              </T>
            </View>
            {ADMIN_ROLES.map((r) => (
              <View key={r} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10 }}>
                <T size={13} weight={600} color={color.textSecondary} align="center">
                  {r}
                </T>
              </View>
            ))}
          </View>
          {PERMISSIONS.map((p) => (
            <View key={p.label} accessibilityRole="row" style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.borderSubtle }}>
              <View style={{ flex: 2.2, paddingVertical: 12, paddingHorizontal: 16 }}>
                <T size={14} weight={600}>
                  {p.label}
                </T>
                {p.sub ? (
                  <T size={13} color={color.textTertiary}>
                    {p.sub}
                  </T>
                ) : null}
              </View>
              {p.cells.split('').map((c, i) => {
                const k = CELL[c];
                const glyph = k.ring ? (
                  <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: color.accent }} />
                ) : k.dash ? (
                  <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: color.textTertiary }} />
                ) : undefined;
                return (
                  <View key={i} accessibilityLabel={`${ADMIN_ROLES[i]}: ${k.label}`} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' }}>
                    <Tag label={k.label} tone={k.tone} icon={k.icon} glyph={glyph} pill height={26} />
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: color.bgCanvas }}>
            <T size={13} color={color.textTertiary}>
              "Own unit" limits access to patients discharged from the user's assigned units. Changes take effect at next sign-in and are logged.
            </T>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- Organization connections ----------
const CONN: Record<ConnStatus, { tone: Tone; icon?: IconName; border: string }> = {
  Connected: { tone: 'success', icon: 'check', border: color.borderDefault },
  'Request pending': { tone: 'important', icon: 'alert-circle', border: color.importantBorder },
  Suspended: { tone: 'critical', border: color.criticalBorder },
};
const ACTION_VARIANT: Record<string, { variant: ButtonVariant; fg?: string }> = {
  secondary: { variant: 'secondary' },
  danger: { variant: 'secondary', fg: color.critical },
  primary: { variant: 'primary' },
  accent: { variant: 'secondary', fg: color.accent },
};

export function ConnectionsTab() {
  return (
    <View accessibilityLabel="Organization connections" style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <T size={15} color={color.textSecondary} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 400 }}>
          Handoffs can only go to organizations listed as Connected. Each needs a data-sharing agreement on file.
        </T>
        <Button label="Request a connection" fontSize={14} style={{ paddingHorizontal: 14 }} />
      </View>
      {CONNECTIONS.map((c) => {
        const k = CONN[c.status];
        return (
          <View key={c.name} style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: k.border, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <View style={{ flexGrow: 1.6, flexShrink: 1, flexBasis: 240, minWidth: 0, gap: 2 }}>
              <T size={16} lineHeight={22} weight={600}>
                {c.name}
              </T>
              <T size={13} color={color.textTertiary}>
                {c.type}
              </T>
            </View>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 }}>
              <Tag label={c.status} tone={k.tone} icon={k.icon} glyph={k.icon ? undefined : <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: color.critical }} />} pill height={26} size={13} />
            </View>
            <T size={14} lineHeight={20} color={color.textSecondary} style={{ flexGrow: 1.3, flexShrink: 1, flexBasis: 260, minWidth: 0 }}>
              {c.detail}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {c.actions.map((a) => {
                const v = ACTION_VARIANT[a.kind];
                return v.fg ? (
                  <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={`${a.label} ${c.name}`} style={{ height: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.bgSurface, justifyContent: 'center' }}>
                    <T size={13} weight={600} color={v.fg}>
                      {a.label}
                    </T>
                  </Pressable>
                ) : (
                  <Button key={a.label} label={a.label} variant={v.variant} size="sm" fontSize={13} accessibilityLabel={`${a.label} ${c.name}`} />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------- Audit log search ----------
const AUDIT_USERS = [
  { value: 'all', label: 'Anyone' },
  { value: 'Sam Ortiz, RN', label: 'Sam Ortiz, RN' },
  { value: 'Dr. Priya Shah', label: 'Dr. Priya Shah' },
  { value: 'Elena Ruiz', label: 'Elena Ruiz' },
  { value: 'Dana Kim, RN', label: 'Dana Kim, RN (Oak Valley)' },
];
/** Actions that expose patient content are privacy-relevant and carry a lock. */
const PRIVACY: AuditKind[] = ['view', 'download'];
const AUDIT_COLS: (number | 'time')[] = ['time', 1.2, 1, 1, 2];

export function AuditTab() {
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState<AuditKind | 'all'>('all');
  const [range, setRange] = useState('d');
  const [patient, setPatient] = useState(true);
  const [exported, setExported] = useState(false);
  const rows = patient ? AUDIT_ENTRIES.filter((a) => (kind === 'all' || a.kind === kind) && (who === 'all' || a.who === who)) : [];
  const item = { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, gap: 6 } as const;

  return (
    <View accessibilityLabel="Audit log search" style={{ gap: 12 }}>
      <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <View style={item}>
          <Label>User</Label>
          <Select label="User" value={who} onChange={setWho} options={AUDIT_USERS} />
        </View>
        <View style={[item, { flexBasis: 320 }]}>
          <Label>Patient</Label>
          {patient ? (
            <View style={{ minHeight: 40, paddingVertical: 4, borderWidth: 1, borderColor: color.successBorder, backgroundColor: color.successBg, borderRadius: radius.md, paddingLeft: 10, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="check-circle" size={16} color={color.success} />
              <T size={14} weight={500} style={{ flex: 1 }}>
                Maria Lopez (synthetic) · DOB 03/14/1957
              </T>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear patient" onPress={() => setPatient(false)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={16} color={color.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Field accessibilityLabel="Patient name and date of birth" placeholder="Name and DOB, e.g. Maria Lopez 03/14/1957" onSubmitEditing={() => setPatient(true)} />
          )}
        </View>
        <View style={item}>
          <Label>Action</Label>
          <Select label="Action" value={kind} onChange={setKind} options={AUDIT_FILTERS.map((f) => ({ value: f.key, label: f.label }))} />
        </View>
        <View style={item}>
          <Label>Date range</Label>
          <Select label="Date range" value={range} onChange={setRange} options={[{ value: 'd', label: '11/20/2026 – 11/21/2026' }, { value: '7', label: 'Last 7 days' }, { value: '90', label: 'Last 90 days' }]} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <T size={14} color={color.textSecondary} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300 }}>
          {rows.length} events · patient searches confirm name + DOB before showing results · your search is logged
        </T>
        <Button label={exported ? 'Export logged' : 'Export results (logged)'} variant="secondary" size="sm" fontSize={13} style={{ paddingHorizontal: 12 }} onPress={() => setExported(true)} />
      </View>

      {!patient ? (
        <EmptyState icon="search" title="Confirm a patient to search" body="Enter the patient's full name and date of birth. Results only show after both match." />
      ) : (
        <View style={tableBox}>
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <View accessibilityRole="table" style={{ minWidth: 900, flex: 1 }}>
              <View accessibilityRole="row" style={headRow}>
                {['Time', 'User', 'Organization', 'Action', 'Details'].map((h, i) => (
                  <View key={h} style={colStyle(i, 12)}>
                    <T size={13} weight={600} color={color.textSecondary}>
                      {h}
                    </T>
                  </View>
                ))}
              </View>
              {rows.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <T size={14} color={color.textSecondary}>
                    No events match these filters.
                  </T>
                </View>
              ) : null}
              {rows.map((r) => {
                const priv = PRIVACY.includes(r.kind);
                const c = r.kind === 'ack' ? color.success : color.textPrimary;
                return (
                  <View key={r.t} accessibilityRole="row" style={{ flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: color.borderSubtle }}>
                    <View style={colStyle(0, 10)}>
                      <T size={13} mono color={color.textSecondary}>
                        {r.t}
                      </T>
                    </View>
                    <View style={colStyle(1, 10)}>
                      <T size={14} weight={600}>
                        {r.who}
                      </T>
                    </View>
                    <View style={colStyle(2, 10)}>
                      <T size={14} color={color.textSecondary}>
                        {r.org}
                      </T>
                    </View>
                    <View style={[colStyle(3, 10), { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                      {priv ? <Icon name="lock" size={14} color={color.textSecondary} /> : null}
                      <T size={14} weight={600} color={c} accessibilityLabel={priv ? `${r.action} (privacy-relevant)` : undefined}>
                        {r.action}
                      </T>
                    </View>
                    <View style={colStyle(4, 10)}>
                      <T size={14} lineHeight={20} color={color.textSecondary}>
                        {r.detail}
                      </T>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function colStyle(i: number, pv: number) {
  const c = AUDIT_COLS[i];
  return c === 'time' ? { width: 150, paddingVertical: pv, paddingHorizontal: 14 } : { flex: c, paddingVertical: pv, paddingHorizontal: 14 };
}

function Label({ children }: { children: string }) {
  return (
    <T size={13} weight={600} color={color.textSecondary}>
      {children}
    </T>
  );
}
