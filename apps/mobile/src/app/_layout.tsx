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
  const apiRole = signedIn && !demo ? state.user.perfil : null;
  const passwordReady = signedIn && !state.user.trocaSenhaObrigatoria;
  // Rota negada cai em /home, que decide o destino pela sessão. Ao sair, as telas
  // autenticadas saem do histórico: o botão Voltar não retorna a elas.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="home" />
    <Stack.Protected guard={!signedIn} redirectTo="/home"><Stack.Screen name="login" /></Stack.Protected>
    <Stack.Protected guard={signedIn && !!state.user.trocaSenhaObrigatoria} redirectTo="/home"><Stack.Screen name="trocar-senha" /></Stack.Protected>
    <Stack.Protected guard={passwordReady} redirectTo="/home"><Stack.Screen name="profile" /></Stack.Protected>
    <Stack.Protected guard={passwordReady && !!apiRole && !['SECRETARIA'].includes(apiRole)} redirectTo="/home"><Stack.Screen name="workspace" /></Stack.Protected>
    <Stack.Protected guard={passwordReady && signedIn && !demo && state.user.perfil === 'COORDENACAO'} redirectTo="/home"><Stack.Screen name="users" /></Stack.Protected>
    <Stack.Protected guard={passwordReady && !!apiRole && !['SECRETARIA'].includes(apiRole)} redirectTo="/home"><Stack.Screen name="connected" /><Stack.Screen name="person/[id]" /></Stack.Protected>
    <Stack.Protected guard={passwordReady && (apiRole === 'SECRETARIA' || apiRole === 'COORDENACAO')} redirectTo="/home"><Stack.Screen name="secretaria" /></Stack.Protected>
    <Stack.Protected guard={passwordReady && (apiRole === 'SECRETARIA' || apiRole === 'COORDENACAO')} redirectTo="/home"><Stack.Screen name="financeiro" /></Stack.Protected>
    <Stack.Protected guard={demo} redirectTo="/home">
      <Stack.Screen name="(tabs)" /><Stack.Screen name="professor" /><Stack.Screen name="student" />
      <Stack.Screen name="students/[id]" /><Stack.Screen name="classes/[id]" />
    </Stack.Protected>
  </Stack>;
}
