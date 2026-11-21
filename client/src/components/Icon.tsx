import Svg, { Path } from 'react-native-svg';
import { color as tokens } from '../theme/tokens';

// 24px grid, 1.75 stroke, round caps (Foundations · Icons).
const C9 = 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0';
const PATHS = {
  'alert-triangle': ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  'alert-circle': [C9, 'M12 8v4', 'M12 16h.01'],
  info: [C9, 'M12 16v-4', 'M12 8h.01'],
  send: ['m22 2-7 20-4-9-9-4z', 'M22 2 11 13'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
  'check-circle': [C9, 'm8 12 3 3 5-6'],
  check: ['m5 12 5 5 9-10'],
  alarm: ['M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 9v4l2 2', 'M5 3 2 6', 'm22 6-3-3'],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h6'],
  source: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 17v4', 'M17 19h4'],
  pill: ['m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z', 'm8.5 8.5 7 7'],
  bandage: ['m3.5 14.5 11-11a3.5 3.5 0 0 1 5 5l-11 11a3.5 3.5 0 0 1-5-5z', 'M10.5 10.5h.01', 'M13.5 13.5h.01', 'M10.5 13.5h.01', 'M13.5 10.5h.01'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
  restriction: [C9, 'm5.6 5.6 12.8 12.8'],
  contacts: ['M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M2 21a7 7 0 0 1 14 0', 'M16 3.1a4 4 0 0 1 0 7.8', 'M22 21a7 7 0 0 0-5-6.7'],
  unclear: [C9, 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'],
  mic: ['M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z', 'M19 10v1a7 7 0 0 1-14 0v-1', 'M12 18v4'],
  play: ['M7 4v16l13-8z'],
  pause: ['M8 5v14', 'M16 5v14'],
  stop: ['M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  'reply-quote': ['M9 14 4 9l5-5', 'M20 20v-7a4 4 0 0 0-4-4H4'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'],
  'flag-urgent': ['M4 22V4', 'M4 4h13l-2 4 2 4H4'],
  lock: ['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  'eye-off': ['M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2', 'M6.6 6.6C3.6 8.6 2 12 2 12s3.5 8 10 8a9.8 9.8 0 0 0 5.4-1.6', 'M2 2l20 20', 'M14.1 14.1a3 3 0 0 1-4.2-4.2'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  upload: ['M12 15V3', 'm7 8 5-5 5 5', 'M5 21h14'],
  'shield-check': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  'activity-log': ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  offline: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.9a10 10 0 0 1 5.2-2.8', 'M19 12.9a10 10 0 0 0-2.2-1.6', 'M2 8.8a15 15 0 0 1 4.2-2.6', 'M12 20h.01'],
  search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'm21 21-4.3-4.3'],
  'session-clock': [C9, 'M12 7v5l3 2'],
  'arrow-right': ['M5 12h14', 'm13 6 6 6-6 6'],
  'chevron-left': ['m15 6-6 6 6 6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-up': ['m18 15-6-6-6 6'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  plus: ['M12 5v14', 'M5 12h14'],
  settings: ['M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0','M12 2v3', 'M12 19v3', 'M4.9 4.9 7 7', 'm17 17 2.1 2.1', 'M2 12h3', 'M19 12h3', 'm4.9 19.1 2.1-2.1', 'm17 7 2.1-2.1'],
  user: ['M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M4 21a8 8 0 0 1 16 0'],
  users: ['M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M2 21a7 7 0 0 1 14 0', 'M16 3.1a4 4 0 0 1 0 7.8', 'M22 21a7 7 0 0 0-5-6.7'],
  chart: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
  building: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h2a2 2 0 0 1 2 2v10', 'M8 7h4', 'M8 11h4', 'M8 15h4', 'M2 21h20'],
  'face-id': ['M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2', 'M9 9v1.5', 'M15 9v1.5', 'M12 9v4h-1', 'M9 16a4 4 0 0 0 6 0'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  filter: ['M22 3H2l8 9.5V19l4 2v-8.5z'],
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

/** Decorative by default; always pair with a text label for status and priority. */
export function Icon({ name, size = 16, color = tokens.textSecondary, strokeWidth = 1.75, fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden>
      {PATHS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={name === 'play' && fill !== 'none' ? fill : 'none'} />
      ))}
    </Svg>
  );
}

/** Handoff mark: blue rounded square with two arrows. */
export function HandoffMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Handoff">
      <Path d="M10 1h16a9 9 0 0 1 9 9v16a9 9 0 0 1-9 9H10a9 9 0 0 1-9-9V10a9 9 0 0 1 9-9z" fill={tokens.accent} />
      <Path d="M10 13h11l-3.5-3.5M26 23H15l3.5 3.5" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
