import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Patient } from '../../lib/api';
import { color, font, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Avatar } from '../ui/Badges';
import { Checkbox } from '../ui/Controls';
import { Mono, T } from '../ui/Text';

/** Glyphs the hospital screens need that the shared icon set doesn't have yet. */
const EXTRA = {
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  pencil: ['M3 21h4L20 8a2.8 2.8 0 0 0-4-4L3 17z', 'm14.5 5.5 4 4'],
} as const;
export type ExtraIconName = keyof typeof EXTRA;
export function ExtraIcon({ name, size = 16, color: c = color.textSecondary, strokeWidth = 1.75 }: { name: ExtraIconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {EXTRA[name].map((d, i) => (
        <Path key={i} d={d} stroke={c} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}

/**
 * Dropdown. On web it is a native <select> (keyboard and screen-reader friendly, no popover
 * clipping); on native it falls back to a button that steps through the options.
 */
export function Select<K extends string>({ value, options, onChange, label, height = 40, fontSize = 14, minWidth, style, disabled, plain }: { value: K; options: readonly { key: K; label: string }[]; onChange: (k: K) => void; label: string; height?: number; fontSize?: number; minWidth?: number; style?: object; disabled?: boolean; plain?: boolean }) {
  if (Platform.OS === 'web') {
    return createElement(
      'select',
      {
        'aria-label': label,
        value,
        disabled,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value as K),
        style: {
          height,
          minWidth,
          boxSizing: 'border-box',
          border: plain ? 'none' : `1px solid ${color.borderStrong}`,
          borderRadius: radius.md,
          background: plain ? 'transparent' : color.bgSurface,
          padding: plain ? '0 2px' : '0 10px',
          fontFamily: plain ? font.semibold : font.medium,
          fontSize,
          color: plain ? 'inherit' : color.textPrimary,
          cursor: disabled ? 'default' : 'pointer',
          maxWidth: '100%',
          ...style,
        },
      },
      options.map((o) => createElement('option', { key: o.key, value: o.key }, o.label)),
    );
  }
  const cur = options.find((o) => o.key === value) ?? options[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${cur.label}`}
      disabled={disabled}
      onPress={() => onChange(options[(options.indexOf(cur) + 1) % options.length].key)}
      style={{ height, minWidth, borderWidth: plain ? 0 : 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: plain ? 'transparent' : color.bgSurface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <T size={fontSize} weight={500}>
        {cur.label}
      </T>
      <Icon name="chevron-down" size={14} color={color.textSecondary} />
    </Pressable>
  );
}

/** Inline label + select, e.g. "Unit [All units]". */
export function LabeledSelect<K extends string>(props: Parameters<typeof Select<K>>[0]) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T size={14} color={color.textSecondary}>
        {props.label}
      </T>
      <Select {...props} />
    </View>
  );
}

/** Stacked label + select used in forms. */
export function FormSelect<K extends string>(props: Parameters<typeof Select<K>>[0]) {
  return (
    <View style={{ gap: 6, flexGrow: 1, flexBasis: 240, minWidth: 0 }}>
      <T size={14} weight={600} color={color.textSecondary}>
        {props.label}
      </T>
      <Select height={44} fontSize={15} {...props} style={{ width: '100%' }} />
    </View>
  );
}

/** Grey pill group, e.g. Table / Board. */
export function ViewToggle<K extends string>({ options, value, onChange, label }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 2, borderRadius: radius.md, backgroundColor: color.borderSubtle, gap: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={{ height: 36, paddingHorizontal: 12, borderRadius: 6, backgroundColor: on ? color.bgSurface : 'transparent', justifyContent: 'center' }}>
            <T size={14} weight={600}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Confirmation checkbox row; turns green when checked. */
export function ConfirmRow({ checked, onToggle, label, disabled, minHeight = 48 }: { checked: boolean; onToggle: () => void; label: string; disabled?: boolean; minHeight?: number }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={{ minHeight, borderRadius: radius.md, borderWidth: 1, borderColor: checked ? color.successBorder : color.borderStrong, backgroundColor: checked ? color.successBg : color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, opacity: disabled ? 0.6 : 1 }}
    >
      <Checkbox checked={checked} tint={color.success} />
      <T size={15} weight={600} color={checked ? color.success : color.textPrimary} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Numbered step heading: green when the step is complete, blue when it needs attention. */
export function StepHeading({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: done ? color.success : color.accent, alignItems: 'center', justifyContent: 'center' }}>
        <T size={14} weight={600} color="#FFFFFF">
          {n}
        </T>
      </View>
      <T accessibilityRole="header" variant="title2">
        {title}
      </T>
    </View>
  );
}

/**
 * Patient identity banner for hospital drafts (before a handoff exists): full name, DOB and MRN,
 * the route, and a status pill on the right.
 */
export function DraftIdentityBanner({ patient, route, pill, style }: { patient: Patient; route: string; pill: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel={`Patient ${patient.name}, date of birth ${patient.dob}, MRN ${patient.mrn}`} style={[{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 24, rowGap: 10, flexWrap: 'wrap' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1, minWidth: 0 }}>
        <Avatar initials={patient.initials} />
        <View style={{ gap: 2, flexShrink: 1 }}>
          <T accessibilityRole="header" size={20} lineHeight={28} weight={700}>
            {patient.name}
          </T>
          <T size={14} color={color.textSecondary}>
            <T size={14} color={color.textTertiary}>DOB</T> <Mono color={color.textPrimary}>{patient.dob}</Mono> · {patient.ageYears} y{'   '}
            <T size={14} color={color.textTertiary}>MRN</T> <Mono color={color.textPrimary}>{patient.mrn}</Mono>
          </T>
        </View>
      </View>
      <T size={15} color={color.textSecondary} style={{ flexShrink: 1 }}>
        {route}
      </T>
      <View style={{ marginLeft: 'auto' }}>{pill}</View>
    </View>
  );
}

/** Outline pill used for draft / sent states on hospital screens. */
export function StatePill({ label, tone, icon }: { label: string; tone: 'draft' | 'sent'; icon?: 'pencil' | 'send' }) {
  const sent = tone === 'sent';
  const fg = sent ? color.delivered : color.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: sent ? color.deliveredBg : color.bgSurface, borderWidth: 1, borderColor: sent ? color.deliveredBorder : color.borderStrong }}>
      {icon === 'send' ? <Icon name="send" size={14} color={fg} strokeWidth={2} /> : icon === 'pencil' ? <ExtraIcon name="pencil" size={14} color={fg} strokeWidth={2} /> : null}
      <T size={13} weight={600} color={fg}>
        {label}
      </T>
    </View>
  );
}

/** Thin progress bar. */
export function ProgressBar({ pct, height = 8, tint = color.accent, label }: { pct: number; height?: number; tint?: string; label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ height, borderRadius: 999, backgroundColor: color.borderSubtle, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}

/**
 * Web session timeout: after `idleMs` without mouse/keyboard activity, a 60 s countdown starts.
 * `preview()` starts it immediately for the demo.
 */
export function useSessionTimeout({ idleMs = 14 * 60 * 1000, countdown = 60, onExpire }: { idleMs?: number; countdown?: number; onExpire: () => void }) {
  const [secs, setSecs] = useState<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const arm = () => {
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => setSecs((s) => s ?? countdown), idleMs);
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      if (idle.current) clearTimeout(idle.current);
    };
  }, [idleMs, countdown]);

  useEffect(() => {
    if (secs === null) return;
    if (secs <= 0) {
      setSecs(null);
      expire.current();
      return;
    }
    const t = setTimeout(() => setSecs((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  return { visible: secs !== null, seconds: secs ?? countdown, preview: () => setSecs(countdown), stay: () => setSecs(null) };
}
