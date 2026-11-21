import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../../../components/Icon';
import { PhoneScreen } from '../../../components/layout/Phone';
import { Button } from '../../../components/ui/Button';
import { Radio } from '../../../components/ui/Controls';
import { Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getOrg, handoffForPatient, listPatients } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { color, radius } from '../../../theme/tokens';

/** Capture tab, idle state: pick a recent patient, tap to record. Nothing sends until reviewed. */
export default function CaptureIdle() {
  const { data: patients } = useQuery(listPatients);
  const [pid, setPid] = useState('ml');
  if (!patients) return <Loading />;
  const pt = patients.find((p) => p.id === pid)!;
  const go = (typed: boolean) => router.push({ pathname: '/m/record', params: { pt: pid, typed: typed ? '1' : '0' } } as never);
  return (
    <PhoneScreen title="Capture" subtitle="Add an update or ask the hospital. Nothing sends until you review it.">
      <View accessibilityRole="radiogroup" accessibilityLabel="Recent patients" style={{ gap: 8 }}>
        <T size={15} weight={600} color={color.textSecondary} style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
          Recent patients
        </T>
        <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
          {patients.map((p) => {
            const on = p.id === pid;
            const h = handoffForPatient(p.id);
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.name}, date of birth ${p.dob}`} onPress={() => setPid(p.id)} style={{ minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: color.borderSubtle, backgroundColor: on ? color.accentSelectedBg : color.bgSurface }}>
                <Radio selected={on} />
                <View style={{ flex: 1 }}>
                  <T size={17} weight={600}>
                    {p.name}
                  </T>
                  <T size={15} color={color.textSecondary}>
                    DOB {p.dob} · {h ? `${getOrg(h.fromOrgId).short.replace(' General', '')} handoff` : 'No handoff'}
                  </T>
                </View>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="search" size={18} color={color.accent} />
            <T size={16} weight={600} color={color.accent}>
              Search all patients
            </T>
          </Pressable>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Record voice note for ${pt.name}`} onPress={() => go(false)} style={({ pressed }) => ({ width: 128, height: 128, borderRadius: 999, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: color.accentSubtle, opacity: pressed ? 0.9 : 1 })}>
          <Icon name="mic" size={52} color="#FFFFFF" strokeWidth={1.8} />
        </Pressable>
        <T size={19} weight={600} style={{ paddingTop: 8 }}>
          Tap to record
        </T>
        <T size={15} color={color.textTertiary}>
          For {pt.name} · up to 2 min
        </T>
      </View>
      <Button variant="secondary" size="xl" icon="edit" label="Type instead" fullWidth onPress={() => go(true)} />
    </PhoneScreen>
  );
}
