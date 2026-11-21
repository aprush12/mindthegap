import { Link, usePathname } from 'expo-router';
import { Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { getCurrentUser, getOrg } from '../../lib/api';
import { color, font, radius } from '../../theme/tokens';
import { HandoffMark, Icon } from '../Icon';
import { Avatar } from '../ui/Badges';
import { DemoWatermark } from '../ui/States';
import { T } from '../ui/Text';

export const MAX_W = 1440;

type NavLink = { href: string; label: string; count?: number; countTone?: 'critical' | 'accent'; match?: string };

function NavItem({ l, active }: { l: NavLink; active: boolean }) {
  return (
    <Link href={l.href as never} asChild>
      <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} style={{ height: 40, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: active ? color.accentSubtle : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T size={15} weight={active ? 600 : 500} color={active ? color.accent : color.textSecondary}>
          {l.label}
        </T>
        {l.count ? (
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 999, backgroundColor: l.countTone === 'critical' ? color.critical : color.accent, alignItems: 'center', justifyContent: 'center' }}>
            <T size={12} weight={600} color="#FFFFFF">
              {l.count}
            </T>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

/** Web app bar. `side` picks the aftercare (facility) or hospital navigation. */
export function AppBar({ side }: { side: 'aftercare' | 'hospital' }) {
  const path = usePathname();
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const links: NavLink[] =
    side === 'aftercare'
      ? [
          { href: '/aftercare', label: 'Handoffs', count: 3, match: '/aftercare' },
          { href: '/aftercare', label: 'Patients', match: '/aftercare/patients' },
        ]
      : [
          { href: '/hospital', label: 'Handoffs', count: 2, countTone: 'critical', match: '/hospital' },
          { href: '/hospital/new', label: 'New handoff', match: '/hospital/new' },
          { href: '/hospital/readmissions', label: 'Readmissions', count: 1, match: '/hospital/readmissions' },
          { href: '/hospital/metrics', label: 'Metrics', match: '/hospital/metrics' },
          { href: '/hospital/admin', label: 'Admin', match: '/hospital/admin' },
        ];
  const isActive = (l: NavLink) => {
    if (l.label === 'Patients') return false;
    if (l.match === '/hospital' || l.match === '/aftercare') return path === l.match || (path.startsWith(l.match + '/') && !links.some((o) => o !== l && o.match !== l.match && path.startsWith(o.match!)));
    return path.startsWith(l.match!);
  };
  const user = side === 'aftercare' ? getCurrentUser() : { name: 'Sam Ortiz, RN (demo)', initials: 'SO', role: 'Discharge nurse · Ortho 4W' };
  const org = side === 'aftercare' ? getOrg('oakvalley').name : getOrg('riverside').name;
  return (
    <View accessibilityRole="header" style={{ backgroundColor: color.bgSurface, borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
      <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: narrow ? 16 : 32, minHeight: side === 'hospital' ? 64 : 60, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Link href={side === 'aftercare' ? '/aftercare' : '/hospital'} asChild>
          <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HandoffMark size={28} />
            <T size={18} weight={700}>
              Handoff
            </T>
          </Pressable>
        </Link>
        <View accessibilityRole="menubar" style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {links.map((l) => (
            <NavItem key={l.label} l={l} active={isActive(l)} />
          ))}
        </View>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {side === 'aftercare' && !narrow ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, minWidth: 240 }}>
              <Icon name="search" size={16} color={color.textTertiary} />
              <TextInput accessibilityLabel="Search patients" placeholder="Search name, DOB or MRN" placeholderTextColor={color.textTertiary} style={[{ flex: 1, fontFamily: font.regular, fontSize: 14, color: color.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
            </View>
          ) : null}
          {side === 'hospital' ? (
            <View style={{ height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="building" size={16} color={color.textSecondary} />
              <T size={14} weight={500}>
                {org}
              </T>
            </View>
          ) : (
            <T size={14} color={color.textSecondary}>
              {org}
            </T>
          )}
          {side === 'hospital' && !narrow ? (
            <View style={{ alignItems: 'flex-end' }}>
              <T size={14} lineHeight={18} weight={600}>
                {user.name}
              </T>
              <T size={12} lineHeight={18} color={color.textTertiary}>
                {user.role}
              </T>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Account: ${user.name}`}>
            <Avatar initials={user.initials} size={40} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Web page: app bar, scrollable body constrained to 1440, watermark. */
export function WebPage({ side, children, sticky, footer, scroll = true }: { side: 'aftercare' | 'hospital'; children: React.ReactNode; sticky?: React.ReactNode; footer?: React.ReactNode; scroll?: boolean }) {
  const { width } = useWindowDimensions();
  const pad = width < 900 ? 16 : 32;
  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side={side} />
      {sticky ? (
        <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10, shadowColor: '#0F1B2A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 12 }}>{sticky}</View>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: footer ? 16 : 48 }}>
          <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>{children}</View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24 }}>{children}</View>
      )}
      {footer ? <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingBottom: 16 }}>{footer}</View> : null}
      <DemoWatermark />
    </View>
  );
}

export function Breadcrumb({ parent, parentHref, current }: { parent: string; parentHref: string; current: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Link href={parentHref as never}>
        <T size={13} weight={500} color={color.accent} style={{ textDecorationLine: 'underline' }}>
          {parent}
        </T>
      </Link>
      <T size={13} color={color.textTertiary} aria-hidden>
        /
      </T>
      <T size={13} color={color.textTertiary}>
        {current}
      </T>
    </View>
  );
}

/** Responsive two-column helper: stacks below `breakpoint`. */
export function Columns({ children, gap = 24, breakpoint = 1000, style }: { children: React.ReactNode; gap?: number; breakpoint?: number; style?: ViewStyle }) {
  const { width } = useWindowDimensions();
  return <View style={[{ flexDirection: width < breakpoint ? 'column' : 'row', gap, alignItems: 'flex-start' }, style]}>{children}</View>;
}
