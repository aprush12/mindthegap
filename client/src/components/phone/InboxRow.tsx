import { Pressable, View } from 'react-native';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { T } from '../ui/Text';

/** Unread dot; always paired with a text label in the row's accessibility label. */
export function UnreadDot() {
  return <View aria-hidden style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color.accent }} />;
}

/** Rounded status chip on inbox rows ("Overdue · escalated", "New handoff"). */
export function RowPill({ icon, label, fg, bg, border }: { icon: IconName; label: string; fg: string; bg: string; border: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Icon name={icon} size={14} color={fg} strokeWidth={2} />
      <T size={13} weight={600} color={fg}>
        {label}
      </T>
    </View>
  );
}

/**
 * iPhone inbox / threads row: optional top line (status, unread, time), patient name,
 * DOB line, optional detail line, chevron. Two identifiers (name + DOB) always shown.
 */
export function InboxRow({ top, name, sub, detail, urgent, onPress, accessibilityLabel }: { top?: React.ReactNode; name: string; sub: string; detail?: React.ReactNode; urgent?: boolean; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? color.bgSunken : color.bgSurface, borderWidth: urgent ? 2 : 1, borderColor: urgent ? color.criticalBorder : color.borderDefault, borderRadius: radius.lg, padding: urgent ? 13 : 14, flexDirection: 'row', alignItems: 'center', gap: 12 })}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {top}
        <T size={17} lineHeight={22} weight={600}>
          {name}
        </T>
        <T size={15} lineHeight={20} color={color.textSecondary}>
          {sub}
        </T>
        {detail}
      </View>
      <Icon name="chevron-right" size={20} color={color.textTertiary} />
    </Pressable>
  );
}

export function RowSectionTitle({ children }: { children: string }) {
  return (
    <T accessibilityRole="header" size={15} weight={600} color={color.textSecondary} style={{ paddingHorizontal: 4 }}>
      {children}
    </T>
  );
}
