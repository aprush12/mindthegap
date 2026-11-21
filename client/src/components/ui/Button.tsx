import { Platform, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { T } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'outlineAccent' | 'outlineSuccess' | 'outlineWarn' | 'onDark';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 40, lg: 48, xl: 52 };
const FONT: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 16, xl: 17 };

const VARIANT: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: color.accent, fg: color.textOnAccent },
  secondary: { bg: color.bgSurface, fg: color.textPrimary, border: color.borderStrong },
  tertiary: { bg: 'transparent', fg: color.accent },
  danger: { bg: color.critical, fg: '#FFFFFF' },
  outlineAccent: { bg: color.bgSurface, fg: color.accent, border: color.accent },
  outlineSuccess: { bg: 'transparent', fg: color.success, border: color.success },
  outlineWarn: { bg: 'transparent', fg: color.important, border: color.important },
  onDark: { bg: 'transparent', fg: '#FFFFFF', border: 'rgba(255,255,255,0.5)' },
};

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** Disabled buttons show a lock and a dashed edge; pair them with the reason text. */
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
}

export function Button({ label, variant = 'primary', size = 'md', icon, iconRight, disabled, fullWidth, style, fontSize, ...rest }: ButtonProps) {
  const v = VARIANT[variant];
  const fs = fontSize ?? FONT[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={(state) => {
        const s = state as typeof state & { hovered?: boolean; focused?: boolean };
        return [
          {
            height: HEIGHT[size],
            paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 22 : 16,
            borderRadius: size === 'xl' ? radius.lg : radius.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            backgroundColor: disabled ? color.bgSunken : v.bg,
            borderWidth: disabled || v.border ? 1 : 0,
            borderColor: disabled ? color.borderStrong : v.border,
            borderStyle: disabled ? 'dashed' : 'solid',
            opacity: s.pressed ? 0.85 : 1,
          } as ViewStyle,
          s.hovered && !disabled && variant === 'primary' ? { backgroundColor: color.accentHover } : null,
          Platform.OS === 'web' && s.focused ? ({ outlineColor: color.accent, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 3 } as ViewStyle) : null,
          style,
        ];
      }}
    >
      {disabled ? <Icon name="lock" size={fs + 2} color={color.textTertiary} /> : icon ? <Icon name={icon} size={fs + 3} color={v.fg} fill={icon === 'play' ? v.fg : 'none'} /> : null}
      <T size={fs} weight={600} color={disabled ? color.textTertiary : v.fg} numberOfLines={1}>
        {label}
      </T>
      {iconRight && !disabled ? <Icon name={iconRight} size={fs + 2} color={v.fg} /> : null}
    </Pressable>
  );
}

/** Square icon-only button; label is required for screen readers. */
export function IconButton({ icon, label, onPress, size = 40, bordered = true, iconColor = color.textPrimary, bg = color.bgSurface, disabled }: { icon: IconName; label: string; onPress?: () => void; size?: number; bordered?: boolean; iconColor?: string; bg?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: radius.md, borderWidth: bordered ? 1 : 0, borderColor: color.borderDefault, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : disabled ? 0.5 : 1 })}
    >
      <Icon name={icon} size={20} color={iconColor} />
    </Pressable>
  );
}

/** Underlined text link button, e.g. "View source, page 12". */
export function LinkButton({ label, onPress, icon, size = 13, color: c = color.accent, underline = true }: { label: string; onPress?: () => void; icon?: IconName; size?: number; color?: string; underline?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T size={size} weight={600} color={c} style={underline ? { textDecorationLine: 'underline' } : undefined}>
        {label}
      </T>
      {icon ? <Icon name={icon} size={size + 1} color={c} /> : null}
    </Pressable>
  );
}

export function Row({ children, gap = 8, wrap, align = 'center', justify, style }: { children: React.ReactNode; gap?: number; wrap?: boolean; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap', justifyContent: justify }, style]}>{children}</View>;
}

export function Col({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'column', gap }, style]}>{children}</View>;
}
