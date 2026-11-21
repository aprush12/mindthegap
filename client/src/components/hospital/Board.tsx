import { Pressable, ScrollView, View } from 'react-native';
import { boardTime, type BoardRow, type BoardStatus } from '../../lib/api/hospital-extra';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { T } from '../ui/Text';
import { ExtraIcon } from './Controls';

export type NameMode = 'partial' | 'initials' | 'full';
export const NAME_MODE_LABEL: Record<NameMode, string> = { partial: 'first name + last initial', initials: 'initials', full: 'full name' };

/** Minimum-necessary display of a patient on the board, as set by the administrator. */
export function maskName(r: BoardRow, mode: NameMode) {
  if (mode === 'full') return { display: `${r.first} ${r.last} (synthetic)`, sub: `DOB ${r.dob} · ${r.mrn}` };
  const display = mode === 'initials' ? `${r.first[0]}.${r.last[0]}.` : `${r.first} ${r.last[0]}.`;
  return { display, sub: `Born ${r.dob.slice(6)} · MRN …${r.mrn.slice(-4)}` };
}

type Glyph = { icon?: IconName; extra?: 'pencil' | 'menu' };
export const BOARD_STATUS: Record<BoardStatus, { label: string; fg: string; bg: string; border: string } & Glyph> = {
  draft: { label: 'Draft', fg: color.textSecondary, bg: color.bgSurface, border: color.borderStrong, extra: 'pencil' },
  sent: { label: 'Sent', fg: color.delivered, bg: color.deliveredBg, border: color.deliveredBorder, icon: 'send' },
  opened: { label: 'Opened', fg: color.opened, bg: color.openedBg, border: color.openedBorder, icon: 'eye' },
  ack: { label: 'Acknowledged', fg: color.success, bg: color.successBg, border: color.successBorder, icon: 'check-circle' },
  overdue: { label: 'Overdue', fg: color.critical, bg: color.criticalBg, border: color.criticalBorder, icon: 'alarm' },
};
const OVERDUE_ROW_BG = '#FEF6F5';

function Glyph({ g, size, c }: { g: Glyph; size: number; c: string }) {
  return g.extra ? <ExtraIcon name={g.extra} size={size} color={c} strokeWidth={2} /> : <Icon name={g.icon!} size={size} color={c} strokeWidth={2} />;
}

export function BoardStatusPill({ status }: { status: BoardStatus }) {
  const s = BOARD_STATUS[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, alignSelf: 'flex-start' }}>
      <Glyph g={s} size={14} c={s.fg} />
      <T size={13} weight={600} color={s.fg} numberOfLines={1}>
        {status === 'overdue' ? 'Overdue · escalated' : s.label}
      </T>
    </View>
  );
}

export type StatusFilter = 'all' | BoardStatus;

/** Summary tiles that double as the status filter. */
export function StatusTiles({ rows, value, onChange }: { rows: BoardRow[]; value: StatusFilter; onChange: (f: StatusFilter) => void }) {
  const tiles: { key: StatusFilter; label: string; n: number; fg: string; g: Glyph }[] = [
    { key: 'all', label: 'All', n: rows.length, fg: color.textPrimary, g: { extra: 'menu' } },
    ...(['draft', 'sent', 'opened', 'ack', 'overdue'] as const).map((k) => ({ key: k, label: BOARD_STATUS[k].label, n: rows.filter((r) => r.status === k).length, fg: BOARD_STATUS[k].fg, g: BOARD_STATUS[k] })),
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Filter by status" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {tiles.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.label}: ${t.n}`}
            onPress={() => onChange(t.key)}
            style={{ flexGrow: 1, flexBasis: 150, minHeight: 76, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? color.accent : t.key === 'overdue' ? color.criticalBorder : color.borderDefault, backgroundColor: color.bgSurface, paddingVertical: on ? 11 : 12, paddingHorizontal: on ? 13 : 14, gap: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Glyph g={t.g} size={15} c={t.fg} />
              <T size={14} weight={600} color={t.fg}>
                {t.label}
              </T>
            </View>
            <T size={26} lineHeight={32} weight={700}>
              {t.n}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const COLS = [
  { label: 'Patient', flex: 1.3 },
  { label: 'Unit', flex: 0.75 },
  { label: 'Receiving facility', flex: 1.35 },
  { label: 'Sent', flex: 0.55 },
  { label: 'Due by', flex: 0.65 },
  { label: 'Status', flex: 1.35 },
  { label: 'Critical items', flex: 0.9 },
  { label: 'Escalation', flex: 1.6 },
];
const CELL = { paddingVertical: 10, paddingHorizontal: 16 } as const;

export function BoardTable({ rows, mode, onAction }: { rows: BoardRow[]; mode: NameMode; onAction: (r: BoardRow) => void }) {
  return (
    <View accessibilityLabel="Handoffs" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minWidth: 1200, flex: 1 }}>
          <View accessibilityRole="header" style={{ flexDirection: 'row', backgroundColor: color.bgSunken, borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
            {COLS.map((c) => (
              <T key={c.label} size={13} weight={600} color={c.label === 'Due by' ? color.textPrimary : color.textSecondary} style={{ flex: c.flex, paddingVertical: 12, paddingHorizontal: 16 }}>
                {c.label}
              </T>
            ))}
            <View style={{ width: 90 }} />
          </View>
          {rows.length === 0 ? (
            <T size={14} color={color.textTertiary} style={{ padding: 24 }}>
              No handoffs match these filters.
            </T>
          ) : null}
          {rows.map((r) => {
            const od = r.status === 'overdue';
            const n = maskName(r, mode);
            return (
              <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, borderBottomWidth: 1, borderBottomColor: color.borderSubtle, backgroundColor: od ? OVERDUE_ROW_BG : color.bgSurface }}>
                <View style={[CELL, { flex: COLS[0].flex }]}>
                  <T size={14} weight={600}>
                    {n.display}
                  </T>
                  <T size={13} color={color.textTertiary}>
                    {n.sub}
                  </T>
                </View>
                <T size={14} color={color.textSecondary} style={[CELL, { flex: COLS[1].flex }]}>
                  {r.unit}
                </T>
                <View style={[CELL, { flex: COLS[2].flex }]}>
                  <T size={14}>{r.toName}</T>
                  <T size={13} color={color.textTertiary}>
                    {r.contact}
                  </T>
                </View>
                <T size={13} mono color={color.textSecondary} style={[CELL, { flex: COLS[3].flex }]}>
                  {boardTime(r.sentAt)}
                </T>
                <T size={13} mono weight={od ? 600 : 400} color={od ? color.critical : color.textSecondary} style={[CELL, { flex: COLS[4].flex }]}>
                  {boardTime(r.dueAt)}
                </T>
                <View style={[CELL, { flex: COLS[5].flex }]}>
                  <BoardStatusPill status={r.status} />
                </View>
                <T size={14} weight={500} color={od ? color.critical : color.textSecondary} style={[CELL, { flex: COLS[6].flex }]}>
                  {r.crit}
                </T>
                <View style={[CELL, { flex: COLS[7].flex, gap: 4 }]}>
                  {r.esc.length ? (
                    r.esc.map((e) => (
                      <View key={e.text} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                        <View style={{ paddingTop: 2 }}>
                          <Icon name={e.done ? 'check' : 'session-clock'} size={14} color={e.done ? color.textSecondary : color.critical} strokeWidth={2} />
                        </View>
                        <T size={13} lineHeight={18} color={e.done ? color.textSecondary : color.critical} style={{ flex: 1 }}>
                          {e.text}
                        </T>
                      </View>
                    ))
                  ) : (
                    <T size={13} lineHeight={18} color={color.textTertiary}>
                      {r.note}
                    </T>
                  )}
                </View>
                <View style={{ width: 90, paddingHorizontal: 16 }}>
                  <Pressable accessibilityRole="link" accessibilityLabel={`${r.action}: ${n.display}`} onPress={() => onAction(r)} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center' }}>
                    <T size={14} weight={600} color={color.accent} style={{ textDecorationLine: 'underline' }}>
                      {r.action}
                    </T>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const shortOrg = (name: string) => name.split(' (')[0].replace(' Skilled Nursing', '').replace(' Home Health', '').replace(' Primary Care', '');

export function BoardColumns({ rows, mode, onAction }: { rows: BoardRow[]; mode: NameMode; onAction: (r: BoardRow) => void }) {
  return (
    <View accessibilityLabel="Handoffs board" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
      {(['draft', 'sent', 'opened', 'ack', 'overdue'] as const).map((k) => {
        const st = BOARD_STATUS[k];
        const cards = rows.filter((r) => r.status === k);
        return (
          <View key={k} style={{ flexGrow: 1, flexBasis: 220, minWidth: 0, backgroundColor: color.bgSunken, borderRadius: radius.lg, padding: 10, gap: 8, minHeight: 200 }}>
            <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 6 }}>
              <Glyph g={st} size={15} c={st.fg} />
              <T size={14} weight={600} color={st.fg}>
                {st.label}
              </T>
              <T size={14} weight={600} color={color.textSecondary} style={{ marginLeft: 'auto' }}>
                {cards.length}
              </T>
            </View>
            {cards.map((r) => {
              const od = r.status === 'overdue';
              return (
                <Pressable key={r.key} accessibilityRole="link" onPress={() => onAction(r)} style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: od ? color.criticalBorder : color.borderDefault, borderRadius: 10, padding: 12, gap: 4 }}>
                  <T size={15} weight={600}>
                    {maskName(r, mode).display}
                  </T>
                  <T size={13} color={color.textSecondary}>
                    {r.unit} → {shortOrg(r.toName)}
                  </T>
                  <T size={13} color={od ? color.critical : color.textSecondary}>
                    Due {boardTime(r.dueAt)} · {r.crit}
                  </T>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
