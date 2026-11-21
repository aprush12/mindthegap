import { Tabs } from 'expo-router';
import { PhoneTabBar } from '../../../components/layout/Phone';

// SDK 58 Expo Router only renders screens declared here.
export default function PhoneTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <PhoneTabBar active={p.state.routes[p.state.index].name} />}>
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="capture" />
      <Tabs.Screen name="threads" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
