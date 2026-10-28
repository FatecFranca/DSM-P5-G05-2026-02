import { useSession } from '@/auth/session';
import { ConnectedDashboard } from '@/features/connected/dashboard';
import { ConnectedHome } from '@/features/connected/home';

export default function ConnectedIndex() {
  const { state } = useSession();
  return state.status === 'signedIn' && ['ALUNO', 'PROFESSOR', 'TUTOR'].includes(state.user.perfil) ? <ConnectedHome /> : <ConnectedDashboard />;
}
