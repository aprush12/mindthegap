import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { color, radius } from '../../theme/tokens';
import { T } from '../ui/Text';

const H = 200;
const GUTTER = 40;

/**
 * Monthly trend line. The last point is a partial month: dashed segment and hollow dot,
 * marked with * in the table view. Gridlines and the target are labelled in text.
 */
export function TrendLine({ months, values, min, max, ticks, fmt, target, label }: { months: string[]; values: number[]; min: number; max: number; ticks: number[]; fmt: (v: number) => string; target?: number; label: string }) {
  const [w, setW] = useState(0);
  const n = values.length;
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * w : 0);
  const Y = (v: number) => H * (1 - (v - min) / (max - min));
  const solid = values
    .slice(0, n - 1)
    .map((v, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
    .join(' ');
  const partial = `M ${X(n - 2).toFixed(1)} ${Y(values[n - 2]).toFixed(1)} L ${X(n - 1).toFixed(1)} ${Y(values[n - 1]).toFixed(1)}`;
  const aria = `${label}: ${values.map((v, k) => `${months[k]} ${fmt(v)}${k === n - 1 ? ' (partial month)' : ''}`).join(', ')}`;
  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={aria} style={{ height: H, marginLeft: GUTTER }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {ticks.map((t) => (
          <GridLabel key={t} top={Y(t)} label={fmt(t)} />
        ))}
        {target !== undefined ? <GridLabel top={Y(target)} label="target" /> : null}
        {w > 0 ? (
          <Svg width={w} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {ticks.map((t) => (
              <Line key={t} x1={0} x2={w} y1={Y(t)} y2={Y(t)} stroke={color.borderSubtle} strokeWidth={1} />
            ))}
            {target !== undefined ? <Line x1={0} x2={w} y1={Y(target)} y2={Y(target)} stroke={color.borderStrong} strokeWidth={1} strokeDasharray="4 4" /> : null}
            <Path d={solid} fill="none" stroke={color.accent} strokeWidth={2} strokeLinejoin="round" />
            <Path d={partial} fill="none" stroke={color.accent} strokeWidth={2} strokeDasharray="4 4" />
            {values.map((v, i) => (
              <Circle key={i} cx={X(i)} cy={Y(v)} r={6} fill="#FFFFFF" />
            ))}
            {values.map((v, i) => (
              <Circle key={`d${i}`} cx={X(i)} cy={Y(v)} r={4} fill={i === n - 1 ? '#FFFFFF' : color.accent} stroke={color.accent} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
        {w > 0 ? (
          <T size={13} weight={600} style={{ position: 'absolute', right: 0, top: Y(values[n - 1]) - 30 }}>
            {months[n - 1]} {fmt(values[n - 1])}
          </T>
        ) : null}
      </View>
      <View style={{ height: 18, marginLeft: GUTTER, marginTop: 10 }} aria-hidden>
        {w > 0
          ? months.map((m, i) => (
              <T key={m} size={12} lineHeight={16} color={color.textTertiary} align="center" style={{ position: 'absolute', left: X(i) - 20, width: 40 }}>
                {m}
              </T>
            ))
          : null}
      </View>
    </View>
  );
}

function GridLabel({ top, label }: { top: number; label: string }) {
  return (
    <T size={12} lineHeight={16} color={color.textTertiary} align="right" style={{ position: 'absolute', left: -GUTTER, top: top - 8, width: 37 }} numberOfLines={1}>
      {label}
    </T>
  );
}

/** Same series as a table (accessible alternative to the chart). */
export function TrendTable({ months, values, fmt }: { months: string[]; values: number[]; fmt: (v: number) => string }) {
  const cell = { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' } as const;
  return (
    <View accessibilityRole="table" style={{ borderWidth: 1, borderColor: color.borderSubtle, borderRadius: radius.md, overflow: 'hidden' }}>
      <View accessibilityRole="row" style={{ flexDirection: 'row', backgroundColor: color.bgSunken }}>
        {months.map((m) => (
          <View key={m} style={cell}>
            <T size={14} weight={600} color={color.textSecondary}>
              {m}
            </T>
          </View>
        ))}
      </View>
      <View accessibilityRole="row" style={{ flexDirection: 'row' }}>
        {values.map((v, i) => (
          <View key={i} style={cell}>
            <T size={14}>
              {fmt(v)}
              {i === values.length - 1 ? '*' : ''}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bar with its label and value in text; the bar is decoration. */
export function BarRow({ label, value, sub, frac, fill, labelWidth, valueWidth, barHeight, bold, highlight, tip }: { label: string; value: string; sub: string; frac: number; fill: string; labelWidth: number; valueWidth: number; barHeight: number; bold?: boolean; highlight?: boolean; tip: string }) {
  return (
    <View accessible accessibilityLabel={tip} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: highlight === undefined ? 0 : 4, paddingHorizontal: highlight === undefined ? 0 : 8, borderRadius: 6, backgroundColor: highlight ? color.accentSubtle : 'transparent' }}>
      <T size={14} lineHeight={18} weight={bold ? 700 : 400} style={{ flexBasis: labelWidth, flexShrink: 1, minWidth: 0 }}>
        {label}
      </T>
      <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 40, height: barHeight, backgroundColor: color.bgCanvas, borderRadius: radius.sm, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(100, frac * 100)}%`, backgroundColor: fill, borderTopRightRadius: radius.sm, borderBottomRightRadius: radius.sm }} />
      </View>
      <T size={14} weight={600} align="right" style={{ width: valueWidth }}>
        {value} <T size={14} weight={400} color={color.textTertiary}>{sub}</T>
      </T>
    </View>
  );
}
