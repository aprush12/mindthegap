import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { color, familyFor, font, type, type TypeVariant, type Weight } from '../../theme/tokens';

export interface TProps extends TextProps {
  variant?: TypeVariant;
  /** Overrides the variant's size (line height scales with it). */
  size?: number;
  lineHeight?: number;
  weight?: Weight;
  color?: string;
  mono?: boolean;
  align?: TextStyle['textAlign'];
}

/** Inter for UI, IBM Plex Mono for identifiers and times. Numbers use tabular figures. */
export function T({ variant = 'body', size, lineHeight, weight, color: c = color.textPrimary, mono, align, style, ...rest }: TProps) {
  const v = type[variant];
  const fontSize = size ?? v.fontSize;
  const lh = lineHeight ?? (size ? Math.round(size * (v.lineHeight / v.fontSize)) : v.lineHeight);
  const w = weight ?? v.weight;
  const fontFamily = mono ? (w >= 500 ? font.monoMedium : font.mono) : familyFor(w);
  return (
    <RNText
      {...rest}
      style={[{ fontFamily, fontSize, lineHeight: lh, color: c, letterSpacing: v.letterSpacing, fontVariant: ['tabular-nums'], textAlign: align }, style]}
    />
  );
}

/** Inline monospace run inside a T, e.g. times and MRNs. */
export function Mono({ children, color: c, weight = 400 }: { children: React.ReactNode; color?: string; weight?: Weight }) {
  return <RNText style={{ fontFamily: weight >= 500 ? font.monoMedium : font.mono, color: c }}>{children}</RNText>;
}

/** Inline weight change inside a T. */
export function B({ children, color: c, weight = 600 }: { children: React.ReactNode; color?: string; weight?: Weight }) {
  return <RNText style={{ fontFamily: familyFor(weight), color: c }}>{children}</RNText>;
}
