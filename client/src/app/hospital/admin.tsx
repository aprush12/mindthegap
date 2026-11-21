import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AuditTab, ConnectionsTab, RolesTab } from '../../components/admin/AdminSections';
import { UsersTab } from '../../components/admin/UsersTab';
import { WebPage } from '../../components/layout/Shell';
import { Tabs } from '../../components/ui/Controls';
import { T } from '../../components/ui/Text';
import { color } from '../../theme/tokens';

type AdminTab = 'users' | 'roles' | 'connections' | 'audit';
const TABS: { key: AdminTab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles & permissions' },
  { key: 'connections', label: 'Organization connections' },
  { key: 'audit', label: 'Audit log' },
];
const isTab = (t?: string): t is AdminTab => TABS.some((x) => x.key === t);

/** Admin console: users, role permissions, organization connections and audit log search. Admins never open patient records here. */
export default function AdminConsoleScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<AdminTab>(isTab(tabParam) ? tabParam : 'users');
  useEffect(() => {
    if (isTab(tabParam)) setTab(tabParam);
  }, [tabParam]);

  return (
    <WebPage side="hospital">
      <View style={{ gap: 18, paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ gap: 4 }}>
          <T accessibilityRole="header" aria-level={1} size={28} lineHeight={36} weight={700} style={{ letterSpacing: -0.56 }}>
            Admin console
          </T>
          <T size={15} color={color.textSecondary}>
            Riverside General (demo) · administrators manage access but can't open patient records
          </T>
        </View>
        <View accessibilityLabel="Admin sections" style={{ borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
          <View style={{ marginBottom: -1 }}>
            <Tabs
              tabs={TABS}
              active={tab}
              onChange={(k) => {
                setTab(k);
                router.setParams({ tab: k });
              }}
            />
          </View>
        </View>
        {tab === 'users' ? <UsersTab /> : tab === 'roles' ? <RolesTab /> : tab === 'connections' ? <ConnectionsTab /> : <AuditTab />}
      </View>
    </WebPage>
  );
}
