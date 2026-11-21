import { router } from 'expo-router';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { color, radius, shadow } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { useBottomInset, useTopInset } from '../layout/Phone';
import { T } from '../ui/Text';

/** Back to `fallback` when there is no history (deep link / web refresh). */
export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/** iOS nav bar: back link left, centered title (+ optional subtitle), one 44pt action right. */
export function PhoneNavBar({ backLabel, onBack, title, subtitle, right }: { backLabel: string; onBack: () => void; title: string; subtitle?: string; right?: React.ReactNode }) {
  const top = useTopInset();
  return (
    <View style={{ paddingTop: top }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={{ height: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name="chevron-left" size={22} color={color.accent} strokeWidth={2.2} />
            <T size={17} color={color.accent} numberOfLines={1}>
              {backLabel}
            </T>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center' }}>
          <T accessibilityRole="header" size={17} lineHeight={22} weight={600} numberOfLines={1}>
            {title}
          </T>
          {subtitle ? (
            <T size={12} lineHeight={16} color={color.textTertiary}>
              {subtitle}
            </T>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

/** 44pt icon-only action in a nav bar. */
export function NavIconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={22} color={color.accent} />
    </Pressable>
  );
}

/** iOS segmented control (inbox filter, Brief / Packet / Thread). */
export function PhoneSegmented<K extends string>({ options, value, onChange, label, style }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string; style?: ViewStyle }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[{ flexDirection: 'row', gap: 2, padding: 2, borderRadius: 10, backgroundColor: color.pdfGutter }, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[{ flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.bgSurface : 'transparent' }, on ? { shadowColor: '#0F1B2A', shadowOpacity: 0.16, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null]}
          >
            <T size={15} weight={on ? 600 : 500}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** iOS switch (51×31). Green when on. */
export function PhoneSwitch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} hitSlop={6} style={{ width: 51, height: 31, borderRadius: 999, padding: 2, backgroundColor: value ? color.success : color.waveIdle, flexDirection: 'row', justifyContent: value ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 27, height: 27, borderRadius: 999, backgroundColor: '#FFFFFF', shadowColor: '#0F1B2A', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }} />
    </Pressable>
  );
}

/** Uppercase section header above a grouped list. */
export function GroupHeader({ children }: { children: string }) {
  return (
    <T accessibilityRole="header" size={13} weight={600} color={color.textSecondary} style={{ marginHorizontal: 16, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.26 }}>
      {children}
    </T>
  );
}

/** Footnote under a grouped list. */
export function GroupFooter({ children }: { children: React.ReactNode }) {
  return (
    <T size={13} lineHeight={18} color={color.textTertiary} style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
      {children}
    </T>
  );
}

export function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: color.bgSurface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>;
}

/** One 52pt row of a grouped list. `onPress` makes it a button; `right` is the trailing slot. */
export function ListRow({ label, right, onPress, last, indent, accessibilityLabel }: { label: string; right?: React.ReactNode; onPress?: () => void; last?: boolean; indent?: boolean; accessibilityLabel?: string }) {
  const body = (
    <>
      <T size={17} style={{ flex: 1 }}>
        {label}
      </T>
      {right}
    </>
  );
  const style: ViewStyle = { minHeight: indent ? 48 : 52, paddingLeft: indent ? 28 : 14, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: color.borderSubtle };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [style, { backgroundColor: pressed ? color.bgSunken : 'transparent' }]}>
      {body}
    </Pressable>
  );
}

/** Trailing "lock icon + value" used for settings the organization controls. */
export function LockedValue({ text, icon = 'lock' }: { text: string; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={15} color={color.textTertiary} />
      <T size={15} color={color.textTertiary}>
        {text}
      </T>
    </View>
  );
}

/** 16pt "View source p.X" link with a 44pt target (AI items always name their source page). */
export function PhoneSourceLink({ page, onPress }: { page: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`View source, page ${page}`} onPress={onPress} style={{ alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T size={16} weight={600} color={color.accent} style={{ textDecorationLine: 'underline' }}>
        View source p.{page}
      </T>
      <Icon name="source" size={16} color={color.accent} />
    </Pressable>
  );
}

/**
 * Bottom sheet drawn inside the screen (so it stays inside the web device frame too).
 * Grabber, 14pt top corners, home-indicator padding.
 */
export function PhoneSheet({ visible, onClose, label, children }: { visible: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const bottom = useBottomInset();
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.overlay }} />
      <View accessibilityViewIsModal accessibilityLabel={label} style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', backgroundColor: color.bgSurface, borderTopLeftRadius: 14, borderTopRightRadius: 14 }, shadow.e2]}>
        <View aria-hidden style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 999, backgroundColor: color.waveIdle, marginTop: 8 }} />
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: bottom + 8, gap: 14 }}>{children}</ScrollView>
      </View>
    </View>
  );
}

/** Small rounded status chip used on banners ("Opened", "Acked"). */
export function MiniPill({ icon, label, fg, bg, border }: { icon: IconName; label: string; fg: string; bg: string; border: string }) {
  return (
    <View accessibilityLabel={`Status: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Icon name={icon} size={13} color={fg} strokeWidth={2} />
      <T size={13} weight={600} color={fg}>
        {label}
      </T>
    </View>
  );
}
