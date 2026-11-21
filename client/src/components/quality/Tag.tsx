import { View } from 'react-native';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { T } from '../ui/Text';

export type Tone = 'success' | 'critical' | 'important' | 'accent' | 'neutral' | 'muted';
export const TONE: Record<Tone, { fg: string; bg: string; border: string }> = {
  success: { fg: color.success, bg: color.successBg, border: color.successBorder },
  critical: { fg: color.critical, bg: color.criticalBg, border: color.criticalBorder },
  important: { fg: color.important, bg: color.importantBg, border: color.importantBorder },
  accent: { fg: color.accent, bg: color.accentSubtle, border: color.deliveredBorder },
  neutral: { fg: color.textSecondary, bg: color.bgSunken, border: color.borderDefault },
  muted: { fg: color.textTertiary, bg: color.bgSurface, border: color.borderDefault },
};

/** Small tone chip: color + icon + word (never color alone). `pill` rounds it fully (status), else 4px (tag). */
export function Tag({ label, tone, icon, pill, height = 24, size = 12, glyph }: { label: string; tone: Tone; icon?: IconName; pill?: boolean; height?: number; size?: number; glyph?: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height, paddingHorizontal: pill ? 10 : 8, borderRadius: pill ? radius.pill : radius.sm, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, alignSelf: 'flex-start' }}>
      {glyph ?? (icon ? <Icon name={icon} size={size + 1} color={t.fg} strokeWidth={2} /> : null)}
      <T size={size} lineHeight={size + 4} weight={600} color={t.fg}>
        {label}
      </T>
    </View>
  );
}

/** Small source caption used under every number and finding. */
export function SourceNote({ children, size = 12 }: { children: React.ReactNode; size?: number }) {
  return (
    <T size={size} lineHeight={size + 5} color={color.textTertiary}>
      {children}
    </T>
  );
}
