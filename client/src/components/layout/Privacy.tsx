import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { color } from '../../theme/tokens';
import { HandoffMark } from '../Icon';
import { T } from '../ui/Text';

export const IDLE_LOCK_MS = 5 * 60 * 1000;

/**
 * iPhone privacy rules from the design:
 * - Patient details are covered whenever Handoff leaves the screen (app switcher snapshot).
 * - After 5 minutes without activity the app locks and hides the patient on screen.
 */
export function PrivacyGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [covered, setCovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!path.startsWith('/m/locked')) router.replace({ pathname: '/m/locked', params: { from: path } } as never);
    }, IDLE_LOCK_MS);
  };

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setCovered(s !== 'active'));
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }} onTouchStart={arm}>
      {children}
      {covered ? <PrivacyCover /> : null}
    </View>
  );
}

/** Shown in place of content while the app is inactive, so iOS never snapshots patient data. */
export function PrivacyCover() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: color.bgCanvas, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <HandoffMark size={56} />
      <T size={17} weight={600}>
        Content hidden
      </T>
      <T size={15} lineHeight={22} color={color.textSecondary} align="center">
        Patient details are hidden whenever Handoff leaves the screen.
      </T>
    </View>
  );
}
