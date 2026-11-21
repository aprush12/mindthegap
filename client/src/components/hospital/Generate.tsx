import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';
import { T } from '../ui/Text';
import { ProgressBar } from './Controls';

/** "Packet & patient — AI brief — Review & approve — Send" trail. */
export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Packet & patient', 'AI brief', 'Review & approve', 'Send'];
  return (
    <View accessibilityLabel="Steps" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {i ? (
            <T size={14} color={color.borderStrong} aria-hidden>
              —
            </T>
          ) : null}
          <View accessibilityState={{ selected: i === current }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {i < current ? <Icon name="check" size={16} color={color.success} strokeWidth={2.4} /> : null}
            <T size={14} weight={i < current ? 600 : i === current ? 700 : 400} color={i < current ? color.success : i === current ? color.accent : color.textSecondary}>
              {s}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

function Spinner({ size = 48 }: { size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
        loop.start();
      })
      .catch(() => {});
    return () => loop?.stop();
  }, [a]);
  return (
    <Animated.View aria-hidden style={{ width: size, height: size, transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx={24} cy={24} r={20} fill="none" stroke={color.borderSubtle} strokeWidth={5} />
        <Path d="M24 4a20 20 0 0 1 20 20" fill="none" stroke={color.accent} strokeWidth={5} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

const TASKS = ['Text extracted, patient identity checked on every page header', 'Finding medication changes', 'Warning signs, wound care, follow-ups, restrictions', 'Checking for missing or unclear information'];

/** Page map: one cell per packet page. */
function PageGrid({ total, read, bad = [] }: { total: number; read: number; bad?: number[] }) {
  const rows = Array.from({ length: Math.ceil(total / 16) }, (_, r) => Array.from({ length: 16 }, (_, c) => r * 16 + c + 1));
  return (
    <View aria-hidden style={{ gap: 4 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 4 }}>
          {row.map((p) => {
            const isBad = bad.includes(p);
            const done = p <= read && !isBad;
            return <View key={p} style={{ flex: 1, height: 22, borderRadius: 3, backgroundColor: p > total ? 'transparent' : isBad ? color.criticalBg : done ? color.deliveredBorder : color.bgSurface, borderWidth: p > total ? 0 : 1, borderColor: isBad ? color.critical : done ? color.deliveredBorder : color.borderDefault }} />;
          })}
        </View>
      ))}
    </View>
  );
}

/** Brief generation in progress. `read` drives the page map and the task list. */
export function GeneratingCard({ total, read, onCancel, onPreviewError }: { total: number; read: number; onCancel: () => void; onPreviewError: () => void }) {
  const pct = Math.round((read / total) * 100);
  const active = pct < 25 ? 0 : pct < 70 ? 1 : pct < 92 ? 2 : 3;
  return (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={{ width: '100%', maxWidth: 760, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 32, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Spinner />
        <View style={{ flex: 1, gap: 2 }}>
          <T accessibilityRole="header" variant="title1" weight={700}>
            Reading {total} pages…
          </T>
          <T size={15} color={color.textSecondary}>
            Usually under 2 minutes. You can leave; we'll notify you when the brief is ready to review.
          </T>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={14} color={color.textSecondary}>
            Page {read} of {total}
          </T>
          <T size={14} color={color.textSecondary}>
            {pct}%
          </T>
        </View>
        <ProgressBar pct={pct} height={10} label="Pages read" />
      </View>
      <PageGrid total={total} read={read} />
      <View style={{ gap: 12 }}>
        {TASKS.map((t, i) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {i < active ? (
              <Icon name="check-circle" size={18} color={color.success} strokeWidth={2.2} />
            ) : i === active ? (
              <Icon name="refresh" size={18} color={color.accent} strokeWidth={2.2} />
            ) : (
              <View aria-hidden style={{ width: 14, height: 14, marginHorizontal: 2, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: color.borderStrong }} />
            )}
            <T size={15} weight={i === active ? 600 : 400} color={i > active ? color.textTertiary : color.textPrimary} style={{ flex: 1 }}>
              {t}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center', borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 16 }}>
        <T size={14} color={color.textSecondary} style={{ flexGrow: 1, flexBasis: 300 }}>
          The AI drafts. You review and approve every item before anything is sent.
        </T>
        <Button variant="secondary" fontSize={14} label="Cancel" onPress={onCancel} />
        <Button variant="outlineAccent" fontSize={14} label="Preview: read error" onPress={onPreviewError} />
      </View>
    </View>
  );
}

/** Some pages couldn't be read. Nothing on them is in the brief, and the reviewer decides what to do. */
export function GenerateErrorCard({ total, bad, onRetry, onReplace, onContinue }: { total: number; bad: number[]; onRetry: () => void; onReplace: () => void; onContinue: () => void }) {
  const range = `${bad[0]}–${bad[bad.length - 1]}`;
  return (
    <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 760, backgroundColor: color.bgSurface, borderWidth: 2, borderColor: color.criticalBorder, borderRadius: radius.lg, padding: 32, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
        <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: color.criticalBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="alert-triangle" size={24} color={color.critical} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T accessibilityRole="header" variant="title1" weight={700}>
            Couldn't read pages {range}
          </T>
          <T size={16} lineHeight={24} color={color.textSecondary}>
            Scanned image too blurry. {total - bad.length} of {total} pages were read; anything on these {bad.length} pages is not in the brief yet.
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {bad.map((n) => (
          <View key={n} style={{ flexGrow: 1, flexBasis: 140, gap: 6 }}>
            <View aria-hidden style={{ height: 150, borderRadius: 6, borderWidth: 2, borderColor: color.criticalBorder, backgroundColor: color.bgSurface, padding: 14, gap: 6, overflow: 'hidden', opacity: 0.55 }}>
              {[70, 92, 85, 60, 90, 74].map((w, i) => (
                <View key={i} style={{ height: 7, width: `${w}%`, backgroundColor: color.waveIdle, borderRadius: 2 }} />
              ))}
            </View>
            <T size={14} weight={600} color={color.critical}>
              Page {n} · unreadable
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Button size="lg" fontSize={15} label={`Retry pages ${range}`} onPress={onRetry} style={{ height: 44 }} />
        <Button size="lg" fontSize={15} variant="secondary" label="Replace with a clearer scan" onPress={onReplace} style={{ height: 44 }} />
        <Button size="lg" fontSize={15} variant="tertiary" label="Continue without them" onPress={onContinue} style={{ height: 44 }} />
      </View>
      <T size={14} lineHeight={20} color={color.textSecondary} style={{ backgroundColor: color.bgCanvas, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 }}>
        If you continue, the brief will list "Pages {range} not read" under Unclear / missing, and the receiver sees it too.
      </T>
    </View>
  );
}
