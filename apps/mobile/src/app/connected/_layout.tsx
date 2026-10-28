import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/auth/session';
import { AppTabs, LoadingScreen, hiddenTab } from '@/components/app-tabs';
import { TabIcon } from '@/components/tab-icon';

export default function ConnectedLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status !== 'signedIn' || state.mode !== 'api') return <Redirect href="/home" />;
  const student = state.user.perfil === 'ALUNO';
  const manager = state.user.perfil === 'ADMIN' || state.user.perfil === 'COORDENACAO';
  return <AppTabs>
    <Tabs.Screen name="index" options={{ title: manager ? 'Painel' : 'Início', tabBarIcon: ({ color }) => <TabIcon symbol="◈" color={color} /> }} />
    <Tabs.Screen name="people" options={manager ? { title: 'Estudantes', tabBarIcon: ({ color }) => <TabIcon symbol="▧" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="classes" options={student ? hiddenTab : { title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon symbol="▦" color={color} /> }} />
    <Tabs.Screen name="scenarios" options={manager ? { title: 'Cenários', tabBarIcon: ({ color }) => <TabIcon symbol="◇" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="model" options={manager ? { title: 'Modelo', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="attendance" options={manager ? hiddenTab : { title: student ? 'Faltas' : 'Chamada', tabBarIcon: ({ color }) => <TabIcon symbol="✓" color={color} /> }} />
    <Tabs.Screen name="grades" options={manager ? hiddenTab : { title: 'Notas', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
    <Tabs.Screen name="assignments" options={student ? { title: 'Atividades', tabBarIcon: ({ color }) => <TabIcon symbol="□" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="materials" options={manager ? hiddenTab : { title: 'Materiais', tabBarIcon: ({ color }) => <TabIcon symbol="▣" color={color} /> }} />
    <Tabs.Screen name="report" options={hiddenTab} />
    <Tabs.Screen name="account" options={hiddenTab} />
    <Tabs.Screen name="class/[id]" options={hiddenTab} />
  </AppTabs>;
}
