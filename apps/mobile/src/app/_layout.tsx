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
        <RootNavigator />
      </AcademicDemoProvider>
    </SessionProvider>
  );
}

function RootNavigator() {
  const { state } = useSession();
  const loading = state.status === 'loading';

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  // Durante a restauração as duas áreas ficam liberadas para não descartar links diretos.
  // Ao sair, as telas autenticadas saem do histórico: o botão Voltar não retorna a elas.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={state.status !== 'signedIn'} redirectTo="/home">
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={state.status !== 'signedOut'} redirectTo="/login">
        <Stack.Screen name="home" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="professor" />
        <Stack.Screen name="student" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="users" />
        <Stack.Screen name="students/[id]" />
        <Stack.Screen name="classes/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
