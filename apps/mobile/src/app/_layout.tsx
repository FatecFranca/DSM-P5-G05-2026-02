import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '@/auth/session';
import { AcademicDemoProvider } from '@/demo/academic-store';
import { palette } from '@/constants/design';

export default function RootLayout() {
  return (
    <SessionProvider>
      <AcademicDemoProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
      </AcademicDemoProvider>
    </SessionProvider>
  );
}
