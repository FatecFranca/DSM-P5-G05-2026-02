import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '@/auth/session';
import { AcademicDemoProvider } from '@/demo/academic-store';
import { palette } from '@/constants/design';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SessionProvider>
      <AcademicDemoProvider>
        <StatusBar style="dark" />
        <Navigation />
      </AcademicDemoProvider>
    </SessionProvider>
  );
}

function Navigation() {
  const { state } = useSession();
  const loading = state.status === 'loading';

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  if (loading) return null;
  const signedIn = state.status === 'signedIn';
  const demo = signedIn && state.mode === 'demo';
  // Rota negada cai em /home, que decide o destino pela sessão. Ao sair, as telas
  // autenticadas saem do histórico: o botão Voltar não retorna a elas.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="home" />
    <Stack.Protected guard={!signedIn} redirectTo="/home"><Stack.Screen name="login" /></Stack.Protected>
    <Stack.Protected guard={signedIn} redirectTo="/home"><Stack.Screen name="profile" /></Stack.Protected>
    <Stack.Protected guard={signedIn && !demo} redirectTo="/home"><Stack.Screen name="workspace" /></Stack.Protected>
    <Stack.Protected guard={signedIn && !demo && state.user.perfil === 'ADMIN'} redirectTo="/home"><Stack.Screen name="users" /></Stack.Protected>
    <Stack.Protected guard={demo} redirectTo="/home">
      <Stack.Screen name="(tabs)" /><Stack.Screen name="professor" /><Stack.Screen name="student" />
      <Stack.Screen name="students/[id]" /><Stack.Screen name="classes/[id]" />
    </Stack.Protected>
  </Stack>;
}
