import { View } from 'react-native';
import type { HandoffView } from '../../lib/api';
import { getUser } from '../../lib/api';
import { fmtShort, fmtTime } from '../../lib/clock';
import { color, radius, statusStyle } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Mono, T } from '../ui/Text';

/** Inline status trail shown under the identity banner: Sent → Delivered → Opened → Acknowledge by. */
export function StatusTrail({ view }: { view: HandoffView }) {
  const h = view.handoff;
  const Step = ({ icon, label, time, who, tone }: { icon: 'send' | 'inbox' | 'eye' | 'check-circle'; label: string; time?: string; who?: string; tone?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={14} color={tone ?? color.textSecondary} strokeWidth={2} />
      <T size={13} color={tone ?? color.textSecondary} weight={tone ? 600 : 400}>
        {label} {time ? <Mono>{fmtTime(time)}</Mono> : null}
        {who ? ` · ${who}` : ''}
      </T>
    </View>
  );
  const Dash = () => <View aria-hidden style={{ width: 16, height: 1, backgroundColor: color.borderStrong }} />;
  return (
    <View accessibilityLabel="Handoff status" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Step icon="send" label="Sent" time={h.sentAt} />
      <Dash />
      {h.deliveredAt ? <Step icon="inbox" label="Delivered" time={h.deliveredAt} /> : null}
      {h.openedAt ? (
        <>
          <Dash />
          <Step icon="eye" label="Opened" time={h.openedAt} who={h.openedBy ? getUser(h.openedBy).short : undefined} />
        </>
      ) : null}
      <Dash />
      {h.acknowledgedAt ? (
        <Step icon="check-circle" label="Acknowledged" time={h.acknowledgedAt} tone={color.success} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: color.borderStrong }} />
          <T size={13} color={h.status === 'overdue' ? color.critical : color.textSecondary} weight={h.status === 'overdue' ? 600 : 400}>
            {h.status === 'overdue' ? 'Was due' : 'Acknowledge by'} <Mono>{fmtTime(h.ackDueAt)}</Mono>
          </T>
        </View>
      )}
    </View>
  );
}

/** C-03 · Full status timeline. Each step names a person or system and a time. Pending steps are dashed. */
export function StatusTimeline({ view }: { view: HandoffView }) {
  const h = view.handoff;
  const steps = [
    { key: 'sent' as const, done: true, time: h.sentAt, lines: [view.sender.name, view.from.short] },
    { key: 'delivered' as const, done: !!h.deliveredAt, time: h.deliveredAt, lines: [`${view.to.short} inbox`] },
    { key: 'opened' as const, done: !!h.openedAt, time: h.openedAt, lines: h.openedBy ? [getUser(h.openedBy).name] : ['Not yet opened'] },
    { key: 'acknowledged' as const, done: !!h.acknowledgedAt, time: h.acknowledgedAt, lines: h.acknowledgedBy ? [getUser(h.acknowledgedBy).name] : ['Pending', `Due by ${fmtShort(h.ackDueAt)}`] },
  ];
  return (
    <View accessibilityLabel="Handoff status timeline" style={{ flexDirection: 'row' }}>
      {steps.map((s, i) => {
        const st = statusStyle[s.key];
        const solid = s.key === 'sent' ? color.textSecondary : st.fg;
        const nextDone = steps[i + 1]?.done;
        return (
          <View key={s.key} style={{ flex: 1, gap: 10, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {s.done ? (
                <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: solid, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={st.icon} size={14} color="#FFFFFF" strokeWidth={2} />
                </View>
              ) : (
                <View style={{ width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: color.borderStrong, backgroundColor: color.bgSurface }} />
              )}
              {i < steps.length - 1 ? <View style={{ flex: 1, height: nextDone ? 2 : 0, borderTopWidth: nextDone ? 0 : 2, borderStyle: 'dashed', borderColor: color.borderStrong, backgroundColor: nextDone ? solid : 'transparent' }} /> : null}
            </View>
            <T size={14} weight={600}>
              {st.label}
            </T>
            <T size={13} lineHeight={18} color={color.textTertiary}>
              {s.time ? <Mono>{fmtShort(s.time)}</Mono> : null}
              {s.time ? '\n' : ''}
              {s.lines.join('\n')}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** C-16 · Metric tile: one number, its unit, what it measures, how it compares to a stated target. */
export function MetricTile({ label, value, parts, unit, target, tone }: { label: string; value: string; parts?: { n: string; unit: string }[]; unit?: string; target: string; tone: 'ok' | 'bad' | 'pending' }) {
  const toneColor = tone === 'ok' ? color.success : tone === 'bad' ? color.critical : color.textTertiary;
  return (
    <View style={{ flexGrow: 1, flexBasis: 200, backgroundColor: color.bgSurface, borderWidth: 1, borderStyle: tone === 'pending' ? 'dashed' : 'solid', borderColor: tone === 'bad' ? color.criticalBorder : tone === 'pending' ? color.borderStrong : color.borderDefault, borderRadius: radius.lg, padding: 16, gap: 6 }}>
      <T size={13} weight={500} color={color.textSecondary}>
        {label}
      </T>
      <T size={28} lineHeight={34} weight={700} color={tone === 'pending' ? color.textTertiary : color.textPrimary}>
        {parts
          ? parts.map((p, i) => (
              <T key={i} size={28} weight={700}>
                {i ? ' ' : ''}
                {p.n} <T size={16} weight={600} color={color.textSecondary}>{p.unit}</T>
              </T>
            ))
          : value}
        {unit ? <T size={16} weight={600} color={color.textSecondary}> {unit}</T> : null}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {tone !== 'pending' ? <Icon name={tone === 'ok' ? 'check-circle' : 'alert-triangle'} size={14} color={toneColor} /> : null}
        <T size={13} color={toneColor}>
          {target}
        </T>
      </View>
    </View>
  );
}
