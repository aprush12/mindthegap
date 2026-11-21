import { ActivityIndicator, View } from 'react-native';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { Button, LinkButton } from './Button';
import { T } from './Text';

/** C-18 · Empty state: what happened, what is safe, one next step. */
export function EmptyState({ icon = 'inbox', title, body, actionLabel, onAction }: { icon?: IconName; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ backgroundColor: color.bgCanvas, borderRadius: radius.lg, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={color.textSecondary} />
      </View>
      <T size={17} weight={600} align="center">
        {title}
      </T>
      <T size={14} color={color.textSecondary} align="center" style={{ maxWidth: 420 }}>
        {body}
      </T>
      {actionLabel ? <LinkButton label={actionLabel} onPress={onAction} size={14} underline={false} /> : null}
    </View>
  );
}

/** C-18 · Error. If the source PDF can't load, the brief is withheld too. */
export function ErrorState({ title, body, code, onRetry }: { title: string; body: string; code?: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: color.bgCanvas, borderRadius: radius.lg, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: color.criticalBg, borderWidth: 1, borderColor: color.criticalBorder, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="alert-triangle" size={24} color={color.critical} />
      </View>
      <T size={17} weight={600} align="center">
        {title}
      </T>
      <T size={14} color={color.textSecondary} align="center" style={{ maxWidth: 420 }}>
        {body}
      </T>
      {onRetry ? <Button label="Try again" fontSize={14} onPress={onRetry} style={{ alignSelf: 'center' }} /> : null}
      {code ? (
        <T size={12} weight={600} color={color.textTertiary}>
          {code}
        </T>
      ) : null}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ padding: 48, alignItems: 'center' }}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

/** C-22 · "Synthetic data, demo only" watermark. Non-interactive. */
export function DemoWatermark({ phone }: { phone?: boolean }) {
  return (
    <View
      pointerEvents="none"
      accessibilityLabel="Synthetic data, demo only"
      style={{ position: 'absolute', right: phone ? 12 : 16, bottom: phone ? 8 : 16, zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: phone ? 2 : 5, paddingHorizontal: phone ? 8 : 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: color.borderDefault }}
    >
      {phone ? null : <Icon name="info" size={13} color={color.textTertiary} />}
      <T size={phone ? 11 : 12} weight={500} color={color.textTertiary}>
        Synthetic data, demo only
      </T>
    </View>
  );
}

export function Card({ children, style, padding = 20, dashed, borderColor = color.borderDefault }: { children: React.ReactNode; style?: object; padding?: number; dashed?: boolean; borderColor?: string }) {
  return <View style={[{ backgroundColor: color.bgSurface, borderWidth: 1, borderStyle: dashed ? 'dashed' : 'solid', borderColor, borderRadius: radius.lg, padding }, style]}>{children}</View>;
}

export function SectionTitle({ children, meta, icon }: { children: string; meta?: string; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
      {icon ? <Icon name={icon} size={20} color={color.textSecondary} /> : null}
      <T accessibilityRole="header" size={18} lineHeight={26} weight={600}>
        {children}
      </T>
      {meta ? (
        <T size={13} weight={500} color={color.textTertiary}>
          {meta}
        </T>
      ) : null}
    </View>
  );
}
