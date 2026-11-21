import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useBottomInset, useTopInset } from '../../components/layout/Phone';
import { Button } from '../../components/ui/Button';
import { DemoWatermark } from '../../components/ui/States';
import { B, T } from '../../components/ui/Text';
import { getCurrentUser, getOrg } from '../../lib/api';
import { color } from '../../theme/tokens';

/**
 * Privacy lock (designs PhoneSessionLocked + PhoneUnlock). PrivacyGate routes here after 5 minutes
 * idle with `from`. Shows no patient information; the blurred cards behind are plain shapes.
 */
export default function LockedScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const top = useTopInset();
  const bottom = useBottomInset();
  const me = getCurrentUser();
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Only return to in-app phone routes, never to the lock screen itself.
  const target = from && from.startsWith('/m/') && !from.startsWith('/m/locked') ? from : '/m/inbox';

  const unlock = () => {
    // PLACEHOLDER: expo-local-authentication is not installed, so Face ID is simulated and always
    // succeeds after a short delay. Replace with LocalAuthentication.authenticateAsync() and only
    // navigate on success.
    setScanning(true);
    setNote(undefined);
    timer.current = setTimeout(() => router.replace(target as never), 900);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      {/* Content-free silhouette of the screen behind (no patient data is rendered). */}
      <View aria-hidden pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: top + 44, paddingHorizontal: 16, gap: 12, opacity: 0.35 }}>
        <View style={{ height: 80, borderRadius: 12, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault }} />
        <View style={{ height: 160, borderRadius: 12, backgroundColor: color.bgSurface, borderWidth: 2, borderColor: color.criticalBorder }} />
        <View style={{ height: 160, borderRadius: 12, backgroundColor: color.bgSurface, borderWidth: 2, borderColor: color.criticalBorder }} />
        <View style={{ height: 120, borderRadius: 12, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault }} />
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(245,247,250,0.72)' }} />

      <View style={{ flex: 1, paddingTop: top, paddingHorizontal: 24, paddingBottom: bottom }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={scanning ? 'face-id' : 'lock'} size={32} color={color.accent} />
          </View>
          <T accessibilityRole="header" size={28} lineHeight={34} weight={700} align="center" style={{ letterSpacing: -0.56 }}>
            {scanning ? 'Handoff is locked' : 'Locked for privacy'}
          </T>
          <T size={17} lineHeight={24} color={color.textSecondary} align="center" style={{ maxWidth: 320 }}>
            {scanning ? 'Look at your iPhone to unlock. Patient information stays hidden until you unlock.' : 'Handoff locked after 5 minutes without activity. The patient you were viewing is hidden.'}
          </T>
          {!scanning ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, maxWidth: 340 }}>
              <Icon name="lock" size={18} color={color.success} />
              <T size={15} lineHeight={22} style={{ flexShrink: 1 }}>
                Your unsent draft is saved, encrypted on this device.
              </T>
            </View>
          ) : null}
          {note ? (
            <T size={15} lineHeight={21} color={color.textSecondary} align="center" style={{ maxWidth: 320 }}>
              {note}
            </T>
          ) : null}
        </View>
        <View style={{ gap: 12, paddingBottom: 24 }}>
          <Button size="xl" fullWidth icon="face-id" label={scanning ? 'Checking Face ID…' : 'Unlock with Face ID'} onPress={unlock} disabled={scanning} />
          <Button
            size="xl"
            fullWidth
            variant="secondary"
            label="Use passcode"
            disabled={scanning}
            // PLACEHOLDER: device passcode fallback comes with expo-local-authentication.
            onPress={() => setNote('Passcode unlock is not available in this demo. Use Face ID.')}
          />
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <T size={15} color={color.textSecondary} align="center">
              Signed in as <B color={color.textPrimary}>{me.name}</B>
            </T>
            <T size={15} color={color.textSecondary} align="center">
              {getOrg(me.orgId).name}
            </T>
          </View>
          {/* Placeholder sign-out: no iPhone sign-in flow yet; returns to the demo index. */}
          <Pressable accessibilityRole="button" onPress={() => router.replace('/' as never)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={17} weight={600} color={color.critical}>
              Sign out
            </T>
          </Pressable>
        </View>
      </View>
      <DemoWatermark phone />
    </View>
  );
}
