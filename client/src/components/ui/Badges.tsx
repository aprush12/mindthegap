import { Pressable, View } from 'react-native';
import { color, priorityStyle, radius, statusStyle, type HandoffStatus, type Priority } from '../../theme/tokens';
import { Icon } from '../Icon';
import { B, T } from './Text';

/** C-02 · color + icon + word, 4px corners. md 26 (web) / lg 32 (iPhone). */
export function PriorityBadge({ priority, size = 'md' }: { priority: Priority; size?: 'md' | 'lg' }) {
  const p = priorityStyle[priority];
  const lg = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: lg ? 32 : 26, paddingHorizontal: lg ? 12 : 10, borderRadius: radius.sm, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, alignSelf: 'flex-start' }}>
      <Icon name={p.icon} size={lg ? 16 : 14} color={p.fg} strokeWidth={2} />
      <T size={lg ? 16 : 13} weight={600} color={p.fg}>
        {p.label}
      </T>
    </View>
  );
}

/** C-03 · fully rounded so it never reads as a priority badge. */
export function StatusPill({ status, size = 'md' }: { status: HandoffStatus; size?: 'sm' | 'md' }) {
  const s = statusStyle[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: size === 'sm' ? 26 : 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, alignSelf: 'flex-start' }}>
      <Icon name={s.icon} size={14} color={s.fg} strokeWidth={2} />
      <T size={13} weight={600} color={s.fg}>
        {s.label}
      </T>
    </View>
  );
}

/** C-04 · dashed outline marks machine output across the product. */
export function AiLabel({ text = 'AI-generated, verify against source', onSurface }: { text?: string; onSurface?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: onSurface ? color.bgSurface : color.bgSunken, borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, alignSelf: 'flex-start' }}>
      <Icon name="sparkle" size={13} color={color.textSecondary} />
      <T size={12} weight={500} color={color.textSecondary}>
        {text}
      </T>
    </View>
  );
}

/** "View source p.X" — every AI item names its source page. */
export function SourceLink({ page, onPress, short }: { page: number; onPress?: () => void; short?: boolean }) {
  const label = short ? `View source p.${page}` : `View source, page ${page}`;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`View source, page ${page}`} onPress={onPress} hitSlop={6} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T size={13} weight={600} color={color.accent} style={{ textDecorationLine: 'underline' }}>
        {label}
      </T>
      <Icon name="source" size={14} color={color.accent} />
    </Pressable>
  );
}

export function UnclearBadge() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderStrong, alignSelf: 'flex-start' }}>
      <Icon name="unclear" size={14} color={color.textPrimary} strokeWidth={2} />
      <T size={13} weight={600}>
        Unclear / missing
      </T>
    </View>
  );
}

export function UrgentTag() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: color.critical }}>
      <Icon name="flag-urgent" size={12} color="#FFFFFF" strokeWidth={2} />
      <T size={12} weight={600} color="#FFFFFF">
        Urgent
      </T>
    </View>
  );
}

/** Structured chip extracted from a voice memo (AI output → dashed). */
export function DataChip({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'critical' }) {
  const crit = tone === 'critical';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: crit ? color.criticalBg : color.bgSurface, borderWidth: 1, borderStyle: 'dashed', borderColor: crit ? color.critical : color.borderStrong }}>
      {crit ? <Icon name="flag-urgent" size={13} color={color.critical} /> : null}
      <T size={13} color={crit ? color.critical : color.textTertiary}>
        {label} <B color={crit ? color.critical : color.textPrimary}>{value}</B>
      </T>
    </View>
  );
}

export function CountBadge({ n }: { n: number }) {
  return (
    <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
      <T size={12} weight={600} color="#FFFFFF">
        {n}
      </T>
    </View>
  );
}

export function Avatar({ initials, size = 44, tone = 'neutral' }: { initials: string; size?: number; tone?: 'neutral' | 'accent' }) {
  return (
    <View aria-hidden style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: tone === 'accent' ? color.accentSubtle : color.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
      <T size={size <= 28 ? 12 : 15} weight={600} color={tone === 'accent' ? color.accent : color.textSecondary}>
        {initials}
      </T>
    </View>
  );
}
