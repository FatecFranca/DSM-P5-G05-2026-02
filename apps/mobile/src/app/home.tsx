import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { homeForRole } from '@/auth/roles';
export default function Home() {
  const { state } = useSession();
  if (state.status === 'loading') return null;
  return <Redirect href={state.status === 'signedIn' ? homeForRole(state.user.perfil) : '/login'} />;
}
