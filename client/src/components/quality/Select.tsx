import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { color, font, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { T } from '../ui/Text';

export type SelectOption<K extends string = string> = { value: K; label: string };

/**
 * 40px dropdown matching the web canvas. Renders a native <select> on web (keyboard and
 * screen-reader support for free); on iOS it cycles through options on tap.
 */
export function Select<K extends string>({ options, value, onChange, label, style }: { options: SelectOption<K>[] | readonly string[]; value?: K; onChange?: (v: K) => void; label: string; style?: ViewStyle }) {
  const opts: SelectOption<K>[] = (options as (SelectOption<K> | string)[]).map((o) => (typeof o === 'string' ? { value: o as K, label: o } : o));
  const current = value ?? opts[0]?.value;
  if (Platform.OS === 'web') {
    return (
      <select
        aria-label={label}
        value={current}
        onChange={(e) => onChange?.(e.target.value as K)}
        style={{ height: 40, border: `1px solid ${color.borderStrong}`, borderRadius: radius.md, background: color.bgSurface, padding: '0 10px', fontFamily: font.medium, fontSize: 14, color: color.textPrimary, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', cursor: 'pointer', ...(style as object) }}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  const idx = Math.max(0, opts.findIndex((o) => o.value === current));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${opts[idx]?.label}`}
      onPress={() => onChange?.(opts[(idx + 1) % opts.length].value)}
      style={[{ height: 40, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.bgSurface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}
    >
      <T size={14} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
        {opts[idx]?.label}
      </T>
      <View style={{ marginLeft: 'auto' }}>
        <Icon name="chevron-down" size={16} color={color.textSecondary} />
      </View>
    </Pressable>
  );
}
