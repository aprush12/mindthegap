import { Link, router } from 'expo-router';
import { Platform, Pressable, ScrollView, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { DemoWatermark } from '../ui/States';
import { T } from '../ui/Text';

/** True when the phone UI is rendered inside the web demo frame rather than on a device. */
export const inWebFrame = Platform.OS === 'web';

/**
 * On iPhone: full screen. On web: an iPhone-sized (402×874) frame so the mobile screens can be
 * demoed in a browser next to the portal.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  if (!inWebFrame) return <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>{children}</View>;
  const scale = Math.min(1, (height - 32) / 874);
  return (
    <View style={{ flex: 1, backgroundColor: '#D9DFE6', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 402, height: 874, borderRadius: 40, overflow: 'hidden', backgroundColor: color.bgCanvas, borderWidth: 1, borderColor: color.borderDefault, transform: [{ scale }], shadowColor: '#0F1B2A', shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: 16 } }}>{children}</View>
      <Link href="/" style={{ position: 'absolute', top: 16, left: 16 }}>
        <T size={13} weight={600} color={color.accent}>
          ← Demo index
        </T>
      </Link>
    </View>
  );
}

/** Top inset: real safe area on device, iOS status-bar height inside the web frame. */
export function useTopInset() {
  const insets = useSafeAreaInsets();
  return inWebFrame ? 54 : insets.top;
}
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  return inWebFrame ? 34 : insets.bottom;
}

const TABS: { key: 'inbox' | 'capture' | 'threads' | 'settings'; label: string; icon: IconName; href: string; badge?: { n: number; tone: string; label: string } }[] = [
  { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/m/inbox', badge: { n: 2, tone: color.critical, label: '2 new' } },
  { key: 'capture', label: 'Capture', icon: 'mic', href: '/m/capture' },
  { key: 'threads', label: 'Threads', icon: 'message', href: '/m/threads', badge: { n: 1, tone: color.accent, label: '1 unread' } },
  { key: 'settings', label: 'Settings', icon: 'settings', href: '/m/settings' },
];

/** iPhone tab bar (83pt incl. home indicator). Badges carry counts only, never patient info. */
export function PhoneTabBar({ active }: { active: string }) {
  const bottom = useBottomInset();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', paddingTop: 6, paddingHorizontal: 8, paddingBottom: Math.max(bottom, 8), backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: color.borderDefault }}>
      {TABS.map((t) => {
        const on = t.key === active;
        const c = on ? color.accent : color.textTertiary;
        return (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.badge ? `${t.label}, ${t.badge.label}` : t.label} onPress={() => router.navigate(t.href as never)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Icon name={t.icon} size={26} color={c} strokeWidth={on ? 2.2 : 1.75} />
            <T size={11} weight={600} color={c}>
              {t.label}
            </T>
            {t.badge ? (
              <View style={{ position: 'absolute', top: -2, left: '54%', minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999, backgroundColor: t.badge.tone, alignItems: 'center', justifyContent: 'center' }}>
                <T size={11} weight={700} color="#FFFFFF">
                  {t.badge.n}
                </T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Standard phone screen: large title or back nav, scroll body, optional sticky footer. */
export function PhoneScreen({ title, subtitle, back, backLabel = 'Back', right, children, footer, scroll = true, header, bg = color.bgCanvas, contentStyle }: { title?: string; subtitle?: string; back?: string | (() => void); backLabel?: string; right?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; header?: React.ReactNode; bg?: string; contentStyle?: ViewStyle }) {
  const top = useTopInset();
  const goBack = () => (typeof back === 'function' ? back() : back ? (router.canGoBack() ? router.back() : router.replace(back as never)) : undefined);
  const body = (
    <View style={[{ paddingHorizontal: 16, paddingBottom: 20, gap: 16 }, contentStyle]}>
      {title ? (
        <View style={{ gap: 4, paddingHorizontal: 4, paddingTop: back ? 0 : 8 }}>
          <T accessibilityRole="header" size={34} lineHeight={41} weight={700} style={{ letterSpacing: -0.68 }}>
            {title}
          </T>
          {subtitle ? (
            <T size={16} lineHeight={22} color={color.textSecondary}>
              {subtitle}
            </T>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingTop: top, backgroundColor: bg }}>
        {back || right ? (
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} style={{ height: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Icon name="chevron-left" size={22} color={color.accent} strokeWidth={2.2} />
                <T size={17} color={color.accent}>
                  {backLabel}
                </T>
              </Pressable>
            ) : (
              <View />
            )}
            {right}
          </View>
        ) : null}
        {header}
      </View>
      {scroll ? <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : <View style={{ flex: 1 }}>{body}</View>}
      {footer}
      <DemoWatermark phone />
    </View>
  );
}
