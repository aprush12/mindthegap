import { Linking, View } from 'react-native';
import { fmtDuration, fmtShort, fmtTime, minutesUntil } from '../../lib/clock';
import type { HandoffView } from '../../lib/api';
import { color, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';
import { B, Mono, T } from '../ui/Text';

/** C-13 · Escalation banner. Warns before the deadline, escalates after it, always offers the next action. */
export function EscalationBanner({ view, onAction }: { view: HandoffView; onAction?: () => void }) {
  const { handoff, from } = view;
  if (handoff.status === 'acknowledged') return null;
  const left = view.criticalIds.length - view.criticalReviewed;
  if (handoff.status === 'overdue') {
    return (
      <View accessibilityRole="alert" style={{ backgroundColor: color.criticalBg, borderWidth: 1, borderColor: color.criticalBorder, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Icon name="alarm" size={22} color={color.critical} strokeWidth={2} />
        <View style={{ flexGrow: 1, flexBasis: 280, gap: 2 }}>
          <T size={15} weight={600} color={color.critical}>
            Overdue · escalated to {from.name}
          </T>
          <T size={14} color={color.textSecondary}>
            Not acknowledged by <Mono>{fmtTime(handoff.ackDueAt)}</Mono>. Discharge team notified at <Mono>{fmtTime(handoff.escalatedAt)}</Mono>. {left} critical item{left === 1 ? '' : 's'} unreviewed.
          </T>
        </View>
        {onAction ? <Button variant="danger" label="Review and acknowledge" fontSize={14} onPress={onAction} /> : null}
      </View>
    );
  }
  const mins = minutesUntil(handoff.ackDueAt);
  if (mins > 240) return null;
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: color.importantBg, borderWidth: 1, borderColor: color.importantBorder, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <Icon name="session-clock" size={22} color={color.important} strokeWidth={2} />
      <View style={{ flexGrow: 1, flexBasis: 280, gap: 2 }}>
        <T size={15} weight={600} color={color.important}>
          Acknowledgment due in {fmtDuration(mins)}
        </T>
        <T size={14} color={color.textSecondary}>
          Due by <Mono>{fmtShort(handoff.ackDueAt)}</Mono>. After that, {from.name} is notified automatically.
        </T>
      </View>
      {onAction ? <Button variant="outlineWarn" label="Review brief" fontSize={14} onPress={onAction} /> : null}
    </View>
  );
}

/** C-14 · Emergency disclaimer. Shown on urgent messages and in the composer. The thread is never the emergency channel. */
export function EmergencyBanner({ onCall = true, compact, extra }: { onCall?: boolean; compact?: boolean; extra?: string }) {
  return (
    <View accessibilityRole="text" accessibilityLabel="For emergencies call 911 or the hospital on-call line" style={{ backgroundColor: color.ink, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: compact ? 14 : 20, flexDirection: 'row', alignItems: compact ? 'flex-start' : 'center', gap: 12, flexWrap: 'wrap' }}>
      <Icon name="phone" size={20} color="#FFFFFF" />
      <T size={compact ? 16 : 15} lineHeight={22} color="#FFFFFF" style={{ flexGrow: 1, flexBasis: 200, flexShrink: 1 }}>
        For emergencies call <B color="#FFFFFF">911</B> or the hospital on-call line: <Mono color="#FFFFFF" weight={500}>[ON-CALL NUMBER]</Mono>
        {extra ? ` ${extra}` : ''}
      </T>
      {onCall && !compact ? <Button variant="onDark" size="sm" label="Call on-call line" onPress={() => Linking.openURL('tel:911').catch(() => {})} /> : null}
    </View>
  );
}

/** C-18 · Offline banner. */
export function OfflineBanner({ since }: { since: string }) {
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: color.ink, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name="offline" size={20} color="#FFFFFF" />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} weight={600} color="#FFFFFF">
          You're offline
        </T>
        <T size={14} color="#D5DDE5">
          Showing what loaded at {since}. Acknowledging is paused until you reconnect.
        </T>
      </View>
    </View>
  );
}

/** "Brief is a summary" notice — the packet is always the source of truth. */
export function SourceOfTruthNotice({ onOpenPacket }: { onOpenPacket?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.bgCanvas, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, flexWrap: 'wrap' }}>
      <Icon name="file-text" size={18} color={color.textSecondary} />
      <T size={14} weight={600} style={{ flexGrow: 1, flexBasis: 220 }}>
        Brief is a summary. The full discharge packet is the source of truth.
      </T>
      {onOpenPacket ? <Button variant="tertiary" size="sm" label="Open full packet" onPress={onOpenPacket} /> : null}
    </View>
  );
}

/** C-15 header: "Your access is recorded." */
export function AccessRecordedNotice({ text = 'Every view, edit, acknowledgment, download and message is logged.' }: { text?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.accentSubtle, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 }}>
      <Icon name="shield-check" size={18} color={color.accent} />
      <T size={14} style={{ flex: 1 }}>
        <B>Your access is recorded.</B> {text}
      </T>
    </View>
  );
}
