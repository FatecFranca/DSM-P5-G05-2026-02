import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/auth/session';
import { AppTabs, LoadingScreen, hiddenTab } from '@/components/app-tabs';
import { TabIcon } from '@/components/tab-icon';
import { palette } from '@/constants/design';
import { ActivityProvider, useActivity } from '@/features/connected/activity';
import { useMessagesSummary } from '@/features/messages/api-data';

export default function ConnectedLayout() {
  const { state } = useSession();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status !== 'signedIn' || state.mode !== 'api') return <Redirect href="/home" />;
  const student = state.user.perfil === 'ALUNO';
  const manager = state.user.perfil === 'COORDENACAO';
  // A coordenação trabalha por painel e análise; Atividade (feed da turma) é para quem acompanha turmas.
  return <ActivityProvider enabled={!manager}><ConnectedTabs student={student} manager={manager} /></ActivityProvider>;
}

/**
 * Abas por perfil, no formato do Teams: Atividade primeiro depois do início, Turmas como lugar das
 * equipes, e Tarefas à mão. Notas, frequência e materiais continuam acessíveis dentro de cada turma.
 */
function ConnectedTabs({ student, manager }: { student: boolean; manager: boolean }) {
  const { unread } = useActivity();
  const { unread: messagesUnread } = useMessagesSummary();
  return <AppTabs>
    <Tabs.Screen name="index" options={{ title: manager ? 'Painel' : 'Início', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
    <Tabs.Screen name="activity" options={manager ? hiddenTab : { title: 'Atividade', tabBarBadge: unread.length ? unread.length : undefined, tabBarBadgeStyle: { backgroundColor: palette.dangerStrong, color: palette.surface }, tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} /> }} />
    <Tabs.Screen name="people" options={manager ? { title: 'Pessoas', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="classes" options={{ title: 'Turmas', tabBarIcon: ({ color }) => <TabIcon name="grid" color={color} /> }} />
    <Tabs.Screen name="scenarios" options={manager ? { title: 'Cenários', tabBarIcon: ({ color }) => <TabIcon name="sliders" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="model" options={manager ? { title: 'Modelo', tabBarIcon: ({ color }) => <TabIcon name="chart" color={color} /> } : hiddenTab} />
    <Tabs.Screen name="assignments" options={manager ? hiddenTab : { title: 'Tarefas', tabBarIcon: ({ color }) => <TabIcon name="list" color={color} /> }} />
    <Tabs.Screen name="attendance" options={manager || student ? hiddenTab : { title: 'Chamada', tabBarIcon: ({ color }) => <TabIcon name="check" color={color} /> }} />
    <Tabs.Screen name="grades" options={manager || !student ? hiddenTab : { title: 'Notas', tabBarIcon: ({ color }) => <TabIcon name="doc" color={color} /> }} />
    <Tabs.Screen name="messages" options={manager ? hiddenTab : { title: 'Mensagens', tabBarBadge: messagesUnread ? messagesUnread : undefined, tabBarBadgeStyle: { backgroundColor: palette.dangerStrong, color: palette.surface }, tabBarIcon: ({ color }) => <TabIcon name="message" color={color} /> }} />
    <Tabs.Screen name="materials" options={hiddenTab} />
    <Tabs.Screen name="report" options={hiddenTab} />
    <Tabs.Screen name="account" options={hiddenTab} />
    <Tabs.Screen name="class/[id]" options={hiddenTab} />
    <Tabs.Screen name="assignment/[id]" options={hiddenTab} />
  </AppTabs>;
}
