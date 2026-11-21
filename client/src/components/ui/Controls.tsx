import { Platform, Pressable, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { color, font, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { CountBadge } from './Badges';
import { T } from './Text';

/** 20px box inside a 40px row target. */
export function Checkbox({ checked, tint = color.accent, size = 20 }: { checked: boolean; tint?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 4, borderWidth: checked ? 0 : 1.5, borderColor: color.borderStrong, backgroundColor: checked ? tint : color.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
      {checked ? <Icon name="check" size={size - 6} color="#FFFFFF" strokeWidth={3} /> : null}
    </View>
  );
}

export function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: selected ? 0 : 1.5, borderColor: color.borderStrong, backgroundColor: selected ? color.accent : color.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
      {selected ? <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: size, backgroundColor: '#FFFFFF' }} /> : null}
    </View>
  );
}

/** C-05 · "Reviewed" checkbox on Critical items. Turns green when checked. */
export function ReviewedCheckbox({ checked, onToggle, disabled, label, large }: { checked: boolean; onToggle: () => void; disabled?: boolean; label: string; large?: boolean }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`Reviewed: ${label}`}
      onPress={onToggle}
      disabled={disabled}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: large ? 44 : 40, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: checked ? color.successBorder : color.borderStrong, backgroundColor: checked ? color.successBg : color.bgSurface }}
    >
      <Checkbox checked={checked} tint={checked ? color.success : color.accent} size={large ? 22 : 20} />
      <T size={large ? 16 : 14} weight={600} color={checked ? color.success : color.textPrimary}>
        Reviewed
      </T>
    </Pressable>
  );
}

/** Large tappable checkbox row, e.g. "Right patient: name and DOB match". */
export function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: checked ? color.successBorder : color.borderStrong, backgroundColor: checked ? color.successBg : color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}
    >
      <Checkbox checked={checked} tint={color.success} size={26} />
      <T size={16} weight={600} color={checked ? color.success : color.textPrimary} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

export function RadioRow({ selected, onPress, label, sub, boxed = true }: { selected: boolean; onPress: () => void; label: string; sub?: string; boxed?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: boxed ? 60 : 40 },
        boxed ? { backgroundColor: color.bgSurface, borderRadius: radius.lg, borderWidth: selected ? 2 : 1, borderColor: selected ? color.accent : color.borderDefault, padding: selected ? 13 : 14 } : null,
      ]}
    >
      <Radio selected={selected} size={boxed ? 22 : 18} />
      <View style={{ flex: 1 }}>
        <T size={boxed ? 17 : 15} weight={boxed ? 600 : 400}>
          {label}
        </T>
        {sub ? (
          <T size={15} color={color.textSecondary}>
            {sub}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

export interface FieldProps extends TextInputProps {
  label?: string;
  dashed?: boolean;
  big?: boolean;
  containerStyle?: ViewStyle;
}

export function Field({ label, dashed, big, containerStyle, style, multiline, ...rest }: FieldProps) {
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <T size={big ? 15 : 13} weight={600} color={color.textSecondary}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={color.textTertiary}
        multiline={multiline}
        {...rest}
        style={[
          {
            minHeight: multiline ? 88 : big ? 52 : 40,
            borderWidth: 1,
            borderStyle: dashed ? 'dashed' : 'solid',
            borderColor: color.borderStrong,
            borderRadius: big ? radius.lg : radius.md,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 10 : 0,
            fontFamily: font.regular,
            fontSize: big ? 17 : 15,
            lineHeight: multiline ? (big ? 25 : 22) : undefined,
            color: color.textPrimary,
            backgroundColor: color.bgSurface,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          Platform.OS === 'web' ? ({ outlineColor: color.accent } as object) : null,
          style,
        ]}
      />
    </View>
  );
}

/** C-12 · underline tabs. */
export function Tabs<K extends string>({ tabs, active, onChange }: { tabs: { key: K; label: string; count?: number }[]; active: K; onChange: (k: K) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{ height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 3, borderBottomColor: on ? color.accent : 'transparent' }}
          >
            <T size={15} weight={on ? 600 : 500} color={on ? color.textPrimary : color.textSecondary}>
              {t.label}
            </T>
            {t.count ? <CountBadge n={t.count} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Segmented choice (Urgency low/medium/high, table/board). */
export function Segmented<K extends string>({ options, value, onChange, dangerKey }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; dangerKey?: K }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {options.map((o) => {
        const on = o.key === value;
        const danger = o.key === dangerKey;
        const fg = on ? (danger ? color.critical : color.accent) : color.textPrimary;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: on ? 2 : 1, borderColor: on ? (danger ? color.critical : color.accent) : color.borderDefault, backgroundColor: on ? (danger ? color.criticalBg : color.accentSubtle) : color.bgSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {danger ? <Icon name="flag-urgent" size={16} color={fg} /> : null}
            <T size={16} weight={600} color={fg}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
