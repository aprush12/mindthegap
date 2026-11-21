import { View, useWindowDimensions } from 'react-native';
import type { HandoffView } from '../../lib/api';
import { fmtFull } from '../../lib/clock';
import { color, radius, shadow } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Avatar, StatusPill } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Mono, T } from '../ui/Text';

/**
 * C-01 · Patient identity banner. Pinned to the top of every patient screen and never scrolls
 * away. Always shows two identifiers: full name and date of birth (plus MRN on web).
 * The name never truncates; it wraps first.
 */
export function IdentityBanner({ view, onOpenPacket, compact }: { view: HandoffView; onOpenPacket?: () => void; compact?: boolean }) {
  const { patient, handoff, from, to } = view;
  const narrow = useWindowDimensions().width < 700;
  if (compact) return <IdentityBannerPhone name={patient.name} initials={patient.initials} dob={patient.dob} age={patient.ageYears} />;
  return (
    <View accessibilityLabel={`Patient ${patient.name}, date of birth ${patient.dob}, MRN ${patient.mrn}`} style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: narrow ? 12 : 14, paddingHorizontal: narrow ? 14 : 20, flexDirection: 'row', alignItems: 'center', gap: narrow ? 10 : 24, flexWrap: 'wrap' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar initials={patient.initials} />
        <View style={{ gap: 2 }}>
          <T accessibilityRole="header" size={20} lineHeight={28} weight={700} style={{ letterSpacing: -0.2 }}>
            {patient.name}
          </T>
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <T size={14} color={color.textSecondary}>
              <T size={14} color={color.textTertiary}>DOB</T> <Mono color={color.textPrimary}>{patient.dob}</Mono> · {patient.ageYears} y
            </T>
            <T size={14} color={color.textSecondary}>
              <T size={14} color={color.textTertiary}>MRN</T> <Mono color={color.textPrimary}>{patient.mrn}</Mono>
            </T>
          </View>
        </View>
      </View>
      {narrow ? null : <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: color.borderDefault }} />}
      {narrow ? (
        <T size={13} color={color.textSecondary} style={{ flexBasis: '100%' }}>
          {patient.reasonForStay} · Discharged {fmtFull(handoff.dischargedAt)} · {from.short} → {to.short}
        </T>
      ) : null}
      {narrow ? null : <View style={{ gap: 2, flexShrink: 1 }}>
        <T size={12} weight={500} color={color.textTertiary}>
          Reason for stay
        </T>
        <T size={15} weight={500}>
          {patient.reasonForStay}
        </T>
      </View>}
      {narrow ? null : <View style={{ gap: 2, flexShrink: 1 }}>
        <T size={12} weight={500} color={color.textTertiary}>
          Discharged {fmtFull(handoff.dischargedAt)}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T size={15} weight={500}>
            {from.name}
          </T>
          <Icon name="arrow-right" size={16} color={color.textTertiary} />
          <T size={15} weight={500}>
            {to.name}
          </T>
        </View>
      </View>}
      <View style={{ marginLeft: narrow ? 0 : 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <StatusPill status={handoff.status} />
        {onOpenPacket && !narrow ? <Button variant="secondary" size="md" icon="file-text" label={`Full packet · ${handoff.pageCount} pp`} onPress={onOpenPacket} fontSize={14} /> : null}
      </View>
    </View>
  );
}

/** iPhone variant: name + DOB stay pinned; MRN moves to the detail sheet. */
export function IdentityBannerPhone({ name, initials, dob, age, style }: { name: string; initials: string; dob: string; age: number; style?: object }) {
  return (
    <View accessibilityLabel={`Patient ${name}, date of birth ${dob}`} style={[{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, shadow.banner, style]}>
      <Avatar initials={initials} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={17} lineHeight={22} weight={700}>
          {name}
        </T>
        <T size={16} lineHeight={22} color={color.textSecondary}>
          <T size={16} color={color.textTertiary}>DOB</T> {dob} · {age} y
        </T>
      </View>
    </View>
  );
}

/** Compact one-line patient strip used in capture and sheets. */
export function PatientStrip({ name, dob }: { name: string; dob: string }) {
  return (
    <View accessibilityLabel={`Patient ${name}, date of birth ${dob}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.bgCanvas, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14 }}>
      <Icon name="user" size={18} color={color.textSecondary} />
      <T size={16} weight={700} style={{ flexShrink: 1 }}>
        {name} <T size={16} color={color.textSecondary}>· DOB {dob}</T>
      </T>
    </View>
  );
}
