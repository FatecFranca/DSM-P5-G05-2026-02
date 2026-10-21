import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/auth/session';
import { AcademicDemoProvider } from '@/demo/academic-store';
import { palette } from '@/constants/design';

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
  if (state.status === 'loading') return null;
  const signedIn = state.status === 'signedIn';
  const demo = signedIn && state.mode === 'demo';
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="home" />
    <Stack.Protected guard={!signedIn}><Stack.Screen name="login" /></Stack.Protected>
    <Stack.Protected guard={signedIn}><Stack.Screen name="profile" /></Stack.Protected>
    <Stack.Protected guard={signedIn && !demo}><Stack.Screen name="workspace" /></Stack.Protected>
    <Stack.Protected guard={signedIn && !demo && state.user.perfil === 'ADMIN'}><Stack.Screen name="users" /></Stack.Protected>
    <Stack.Protected guard={demo}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="professor" /><Stack.Screen name="student" />
      <Stack.Screen name="students/[id]" /><Stack.Screen name="classes/[id]" />
    </Stack.Protected>
  </Stack>;
}
