import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { WebPage } from '../../components/layout/Shell';
import { BarRow, TrendLine, TrendTable } from '../../components/quality/Charts';
import { KpiTile } from '../../components/quality/KpiTile';
import { Select } from '../../components/quality/Select';
import { SourceNote } from '../../components/quality/Tag';
import { AiLabel } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { T } from '../../components/ui/Text';
import { FACILITY_ROWS, FAILURE_COUNTS, KPIS, METRIC_RANGE, PROCEDURE_FILTERS, PROCEDURE_ROWS, READMIT_TOTAL, TRENDS, type TrendSeries } from '../../lib/api/quality-extra';
import { color, radius } from '../../theme/tokens';

const card = { backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: 20 } as const;
const half = { flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 0 } as const;
const fmtFor = (s: TrendSeries) => (s.unit === 'pct1' ? (v: number) => `${v.toFixed(1).replace('.0', '')}%` : (v: number) => `${v}%`);

/** Leadership: 90-day handoff outcomes. Every number names its source and date range. */
export default function MetricsDashboardScreen() {
  const [fac, setFac] = useState('all');
  const [proc, setProc] = useState('all');
  const [range, setRange] = useState('90');
  const [exported, setExported] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <WebPage side="hospital">
        <View style={{ gap: 20, paddingTop: 4, paddingBottom: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, gap: 4 }}>
              <T accessibilityRole="header" aria-level={1} size={28} lineHeight={36} weight={700} style={{ letterSpacing: -0.56 }}>
                Handoff outcomes
              </T>
              <T size={15} color={color.textSecondary}>
                Riverside General (demo) · discharges 08/23/2026 – 11/20/2026 (90 days) · 412 handoffs
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Button label="Export (logged)" variant="secondary" fontSize={14} style={{ paddingHorizontal: 14 }} onPress={() => setExported(true)} />
              {exported ? (
                <T size={12} color={color.textTertiary} accessibilityLiveRegion="polite">
                  Export recorded in the audit log (demo)
                </T>
              ) : null}
            </View>
          </View>

          {/* Filters */}
          <View accessibilityRole="toolbar" accessibilityLabel="Filters" style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center', backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14 }}>
            <FilterLabel label="Date range">
              <Select label="Date range" value={range} onChange={setRange} options={[{ value: '90', label: 'Last 90 days' }, { value: '30', label: 'Last 30 days' }, { value: 'q', label: 'This quarter' }, { value: 'custom', label: 'Custom…' }]} />
            </FilterLabel>
            <FilterLabel label="Procedure">
              <Select label="Procedure" value={proc} onChange={setProc} options={[{ value: 'all', label: 'All procedures' }, ...PROCEDURE_FILTERS.map((p) => ({ value: p, label: p }))]} />
            </FilterLabel>
            <FilterLabel label="Aftercare facility">
              <Select label="Aftercare facility" value={fac} onChange={setFac} options={[{ value: 'all', label: 'All facilities' }, ...FACILITY_ROWS.map((f) => ({ value: f.name, label: f.name }))]} />
            </FilterLabel>
            <T size={13} color={color.textTertiary} style={{ marginLeft: 'auto' }}>
              Filters highlight matching rows below
            </T>
          </View>

          {/* KPI tiles */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {KPIS.map((k) => (
              <KpiTile key={k.label} kpi={k} range={METRIC_RANGE} />
            ))}
          </View>

          {/* Insight */}
          <View style={[card, { borderStyle: 'dashed', borderColor: color.borderStrong, flexDirection: 'row', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }]}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: color.importantBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="alert-circle" size={20} color={color.important} />
            </View>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 520, minWidth: 0, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <T size={13} weight={600} color={color.important}>
                  Insight
                </T>
                <AiLabel />
              </View>
              <T size={18} lineHeight={26} weight={600}>
                Hip replacements sent to Brightwater Home Health (demo): 3 readmissions this quarter, 2 linked to missed anticoagulant doses.
              </T>
              <T size={13} color={color.textTertiary}>
                Source: 3 confirmed readmission reviews · Handoff event log · {METRIC_RANGE}
              </T>
            </View>
            <Link href={'/hospital/readmissions' as never} asChild>
              <Button label="Open the 3 reviews" variant="outlineAccent" fontSize={14} style={{ alignSelf: 'center', paddingHorizontal: 14 }} />
            </Link>
          </View>

          {/* Trends */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {TRENDS.map((s) => (
              <TrendCard key={s.key} s={s} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            {/* Failure types */}
            <View style={[card, half, { gap: 14 }]}>
              <View style={{ gap: 2 }}>
                <T accessibilityRole="header" size={16} lineHeight={22} weight={600}>
                  Where handoffs failed
                </T>
                <T size={13} color={color.textTertiary}>
                  {READMIT_TOTAL} readmissions within 30 days · finding confirmed by a reviewer
                </T>
              </View>
              <View style={{ gap: 10 }}>
                {FAILURE_COUNTS.map((f) => (
                  <BarRow
                    key={f.label}
                    label={f.label}
                    value={String(f.n)}
                    sub={`${Math.round((f.n / READMIT_TOTAL) * 100)}%`}
                    frac={f.n / 16}
                    fill={f.kind === 'unrelated' ? color.borderStrong : f.kind === 'pending' ? color.borderDefault : color.accent}
                    labelWidth={200}
                    valueWidth={64}
                    barHeight={18}
                    tip={`${f.label}: ${f.n} of ${READMIT_TOTAL} readmissions`}
                  />
                ))}
              </View>
              <SourceNote>Source: readmission reviews (Handoff) + Riverside ADT feed (demo) · {METRIC_RANGE} · 8 reviews still pending</SourceNote>
            </View>

            {/* By facility */}
            <View style={[card, half, { gap: 14 }]}>
              <View style={{ gap: 2 }}>
                <T accessibilityRole="header" size={16} lineHeight={22} weight={600}>
                  By aftercare facility
                </T>
                <T size={13} color={color.textTertiary}>
                  Target: 95% acknowledged on time
                </T>
              </View>
              <FacilityTable highlight={fac} />
              <SourceNote>Source: Handoff event log + Riverside ADT feed (demo) · {METRIC_RANGE}</SourceNote>
            </View>
          </View>

          {/* By procedure */}
          <View style={[card, { gap: 14 }]}>
            <T accessibilityRole="header" size={16} lineHeight={22} weight={600}>
              30-day readmissions by procedure
            </T>
            <View style={{ gap: 8 }}>
              {PROCEDURE_ROWS.map((p) => {
                const r = (p.readmits / p.discharges) * 100;
                const on = proc === p.name;
                return (
                  <BarRow
                    key={p.name}
                    label={p.name}
                    value={`${r.toFixed(1)}%`}
                    sub={`${p.readmits} of ${p.discharges}`}
                    frac={r / 20}
                    fill={color.accent}
                    labelWidth={220}
                    valueWidth={160}
                    barHeight={16}
                    bold={on}
                    highlight={on}
                    tip={`${p.name}: ${p.readmits} of ${p.discharges} readmitted`}
                  />
                );
              })}
            </View>
            <SourceNote>Source: Riverside ADT feed (demo), procedure from discharge coding · {METRIC_RANGE} · discharges after 10/21 are still inside their 30-day window</SourceNote>
          </View>
        </View>
      </WebPage>
    </View>
  );
}

function FilterLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 }}>
      <T size={14} color={color.textSecondary}>
        {label}
      </T>
      {children}
    </View>
  );
}

function TrendCard({ s }: { s: TrendSeries }) {
  const [table, setTable] = useState(false);
  const fmt = fmtFor(s);
  return (
    <View style={[card, half, { gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T accessibilityRole="header" size={16} lineHeight={22} weight={600}>
            {s.title}
          </T>
          <T size={13} color={color.textTertiary}>
            By discharge month · Jun – Nov 2026 · Nov is partial (through 11/20)
          </T>
        </View>
        <Button label={table ? 'View as chart' : 'View as table'} variant="secondary" size="sm" fontSize={13} onPress={() => setTable(!table)} style={{ height: 32, paddingHorizontal: 10, borderRadius: 6, borderColor: color.borderDefault }} />
      </View>
      {table ? <TrendTable months={s.months} values={s.values} fmt={fmt} /> : <TrendLine label={s.title} months={s.months} values={s.values} min={s.min} max={s.max} ticks={s.ticks} fmt={fmt} target={s.target} />}
      <SourceNote>Source: {s.src} · 06/01–11/20/2026</SourceNote>
    </View>
  );
}

function FacilityTable({ highlight }: { highlight: string }) {
  const cols = [1.8, 0.8, 1, 1, 1];
  const Cell = ({ i, children, c, w }: { i: number; children: React.ReactNode; c?: string; w?: 400 | 500 | 600 }) => (
    <View style={{ flex: cols[i], padding: 10 }}>
      <T size={14} weight={w} color={c} align={i ? 'right' : 'left'}>
        {children}
      </T>
    </View>
  );
  return (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View accessibilityRole="table" style={{ minWidth: 520, flex: 1 }}>
        <View accessibilityRole="row" style={{ flexDirection: 'row', backgroundColor: color.bgSunken, borderRadius: 6 }}>
          {['Facility', 'Handoffs', 'On time', 'Median ack', 'Readmit'].map((h, i) => (
            <View key={h} style={{ flex: cols[i], paddingVertical: 8, paddingHorizontal: 10 }}>
              <T size={13} weight={600} color={color.textSecondary} align={i ? 'right' : 'left'}>
                {h}
              </T>
            </View>
          ))}
        </View>
        {FACILITY_ROWS.map((r) => (
          <View key={r.name} accessibilityRole="row" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: color.borderSubtle, backgroundColor: highlight === r.name ? color.accentSubtle : color.bgSurface }}>
            <Cell i={0} w={500}>
              {r.name}
            </Cell>
            <Cell i={1}>{r.n}</Cell>
            <Cell i={2} w={600} c={r.belowTarget ? color.important : color.success}>
              {r.onTime}
              {r.belowTarget ? ' ↓' : ''}
            </Cell>
            <Cell i={3}>{r.median}</Cell>
            <Cell i={4}>{r.readmit}</Cell>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
