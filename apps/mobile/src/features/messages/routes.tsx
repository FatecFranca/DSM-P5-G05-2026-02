import { useSession } from '@/auth/session';
import { ApiChannelScreen, ApiConversationScreen, ApiThreadScreen } from './api-screens';
import { ChannelScreen } from './channel-screen';
import { ConversationScreen } from './conversation-screen';
import { ThreadScreen } from './thread-screen';

// As rotas /messages/* servem a demonstração e a versão com API. A sessão decide qual tela abre,
// para que dados de uma não apareçam na outra.
const useApiMode = () => {
  const { state } = useSession();
  return state.status === 'signedIn' && state.mode === 'api';
};

export function ConversationRoute() { return useApiMode() ? <ApiConversationScreen /> : <ConversationScreen />; }
export function ChannelRoute() { return useApiMode() ? <ApiChannelScreen /> : <ChannelScreen />; }
export function ThreadRoute() { return useApiMode() ? <ApiThreadScreen /> : <ThreadScreen />; }
