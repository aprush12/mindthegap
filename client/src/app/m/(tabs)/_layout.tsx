import { Tabs } from 'expo-router';
import { PhoneTabBar } from '../../../components/layout/Phone';

export default function PhoneTabsLayout() {
  return <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <PhoneTabBar active={p.state.routes[p.state.index].name} />} />;
}
