import { Stack } from 'expo-router';
import { PhoneFrame } from '../../components/layout/Phone';
import { PrivacyGate } from '../../components/layout/Privacy';
import { color } from '../../theme/tokens';

/** iPhone app. On web it renders inside a 402×874 device frame for demos. */
export default function PhoneLayout() {
  return (
    <PhoneFrame>
      <PrivacyGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bgCanvas } }} />
      </PrivacyGate>
    </PhoneFrame>
  );
}
