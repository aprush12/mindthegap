import { View } from 'react-native';
import type { Kpi } from '../../lib/api/quality-extra';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { T } from '../ui/Text';

const TONE_FG = { ok: color.success, warn: color.important, bad: color.critical } as const;
const DIR_ICON: Record<Kpi['dir'], IconName> = { down: 'chevron-down', up: 'chevron-up', ok: 'check', warn: 'alert-circle' };

/**
 * Leadership KPI tile (MetricsDashboard canvas): label, one big number, comparison with
 * icon + words, what it counts, and its source + date range. Extends C-16 MetricTile with
 * a detail line, source footer and a "warn" tone.
 */
export function KpiTile({ kpi, range }: { kpi: Kpi; range: string }) {
  const fg = TONE_FG[kpi.tone];
  return (
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 18, gap: 6 }}>
      <T accessibilityRole="header" size={14} weight={600} color={color.textSecondary}>
        {kpi.label}
      </T>
      <T size={34} lineHeight={40} weight={700}>
        {kpi.value}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={DIR_ICON[kpi.dir]} size={16} color={fg} strokeWidth={2} />
        <T size={14} color={fg} style={{ flexShrink: 1 }}>
          {kpi.delta}
        </T>
      </View>
      <T size={13} color={color.textSecondary}>
        {kpi.detail}
      </T>
      <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: color.borderSubtle }}>
        <T size={12} lineHeight={17} color={color.textTertiary}>
          Source: {kpi.src} · {range}
        </T>
      </View>
    </View>
  );
}
