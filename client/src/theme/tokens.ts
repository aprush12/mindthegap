// Handoff design system v0.1 tokens (light theme). Source: design canvas "01 Foundations".

export const color = {
  bgCanvas: '#F5F7FA',
  bgSurface: '#FFFFFF',
  bgSunken: '#EEF2F6',
  borderDefault: '#D6DDE5',
  borderSubtle: '#E4E9EE',
  borderStrong: '#7C8896',
  textPrimary: '#0F1B2A',
  textSecondary: '#3D4B5C',
  textTertiary: '#5A6776',
  accent: '#0B5CAD',
  accentHover: '#084A8C',
  accentSubtle: '#E8F1FB',
  accentSelectedBg: '#F3F8FD',
  textOnAccent: '#FFFFFF',
  sourceHighlight: '#FFE27A',
  sourceHighlightOutline: '#E0B100',
  pdfGutter: '#E4E9EE',
  pdfInk: '#1F2933',
  ink: '#0F1B2A', // emergency banner / offline banner background
  overlay: 'rgba(15,27,42,0.45)',
  // semantic
  critical: '#B42318',
  criticalBg: '#FEF1EF',
  criticalBorder: '#F3B7AE',
  important: '#8A4B00',
  importantBg: '#FFF5E1',
  importantBorder: '#EFC47A',
  success: '#146C43',
  successBg: '#E8F6EE',
  successBorder: '#A9DCC0',
  opened: '#5B3FB8',
  openedBg: '#F2EEFD',
  openedBorder: '#CFC3F5',
  delivered: '#0B5CAD',
  deliveredBg: '#E8F1FB',
  deliveredBorder: '#B6D2F0',
  waveIdle: '#AEB8C4',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const shadow = {
  e1: { shadowColor: '#0F1B2A', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  e2: { shadowColor: '#0F1B2A', shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  banner: { shadowColor: '#0F1B2A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export type Weight = 400 | 500 | 600 | 700;
export const familyFor = (w: Weight = 400) => (w === 700 ? font.bold : w === 600 ? font.semibold : w === 500 ? font.medium : font.regular);

/** Type scale: size / line-height / weight / letter-spacing (em → px at size). */
export const type = {
  display: { fontSize: 32, lineHeight: 40, weight: 700 as Weight, letterSpacing: -0.64 },
  title1: { fontSize: 24, lineHeight: 32, weight: 600 as Weight, letterSpacing: -0.36 },
  title2: { fontSize: 20, lineHeight: 28, weight: 600 as Weight, letterSpacing: -0.2 },
  title3: { fontSize: 17, lineHeight: 24, weight: 600 as Weight, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, weight: 400 as Weight, letterSpacing: 0 },
  bodySm: { fontSize: 14, lineHeight: 20, weight: 400 as Weight, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, weight: 600 as Weight, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, weight: 500 as Weight, letterSpacing: 0 },
} as const;
export type TypeVariant = keyof typeof type;

export type Priority = 'critical' | 'important' | 'info';
export const priorityStyle: Record<Priority, { label: string; fg: string; bg: string; border: string; icon: IconName }> = {
  critical: { label: 'Critical', fg: color.critical, bg: color.criticalBg, border: color.criticalBorder, icon: 'alert-triangle' },
  important: { label: 'Important', fg: color.important, bg: color.importantBg, border: color.importantBorder, icon: 'alert-circle' },
  info: { label: 'Info', fg: color.textSecondary, bg: color.bgSunken, border: color.borderDefault, icon: 'info' },
};

export type HandoffStatus = 'sent' | 'delivered' | 'opened' | 'acknowledged' | 'overdue';
export const statusStyle: Record<HandoffStatus, { label: string; fg: string; bg: string; border: string; icon: IconName }> = {
  sent: { label: 'Sent', fg: color.textSecondary, bg: color.bgSunken, border: color.borderDefault, icon: 'send' },
  delivered: { label: 'Delivered', fg: color.delivered, bg: color.deliveredBg, border: color.deliveredBorder, icon: 'inbox' },
  opened: { label: 'Opened', fg: color.opened, bg: color.openedBg, border: color.openedBorder, icon: 'eye' },
  acknowledged: { label: 'Acknowledged', fg: color.success, bg: color.successBg, border: color.successBorder, icon: 'check-circle' },
  overdue: { label: 'Overdue · escalated', fg: color.critical, bg: color.criticalBg, border: color.criticalBorder, icon: 'alarm' },
};

// Imported at the bottom to avoid a cycle in type-only position.
import type { IconName } from '../components/Icon';
