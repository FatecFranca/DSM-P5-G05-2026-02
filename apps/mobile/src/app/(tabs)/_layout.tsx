import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/auth/session';
import { canUseAdmin, homeForRole } from '@/auth/roles';
import { AppTabs, LoadingScreen } from '@/components/app-tabs';
import { TabIcon } from '@/components/tab-icon';

export default function TabLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status !== 'signedIn') return <Redirect href="/login" />;
  if (!canUseAdmin(state.user.perfil)) return <Redirect href={homeForRole(state.user.perfil)} />;
  return <AppTabs>
    <Tabs.Screen name="dashboard" options={{ title: 'Painel', tabBarAccessibilityLabel: 'Painel acadêmico', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
    <Tabs.Screen name="students" options={{ title: 'Estudantes', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon name="grid" color={color} /> }} />
    <Tabs.Screen name="simulations" options={{ title: 'Cenários', tabBarIcon: ({ color }) => <TabIcon name="sliders" color={color} /> }} />
    <Tabs.Screen name="metrics" options={{ title: 'Modelo', tabBarIcon: ({ color }) => <TabIcon name="chart" color={color} /> }} />
  </AppTabs>;
}
