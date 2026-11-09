import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from './auth/Session';
import { Login } from './components/Login';
import { Shell } from './components/Shell';
import { StateMessage } from './components/UI';
import { ActivitiesPage, ClassDetail, ClassesPage, HomePage, PeoplePage, SecretaryPage } from './features/academic/Pages';
import { useOverview } from './features/academic/overview';

function useRoute() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => { const onPop = () => setRoute(window.location.pathname); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const navigate = (path: string) => { if (window.location.pathname !== path) window.history.pushState({}, '', path); setRoute(path); window.scrollTo(0, 0); };
  return { route, navigate };
}

function AccountPage() {
  const { session, changePassword, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try { await changePassword(current, next); setCurrent(''); setNext(''); setNotice('Senha alterada.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><p className="section-label">Configurações</p><h1>Minha conta</h1><p>Seu acesso à instituição.</p></div></div><div className="two-columns"><section className="panel account-panel"><h2>Dados da sessão</h2><dl><dt>Perfil</dt><dd>{session?.user.perfil}</dd><dt>Instituição</dt><dd>{session?.user.instituicaoId}</dd></dl><button type="button" className="secondary-button" onClick={() => void signOut()}>Sair da conta</button></section><section className="panel account-panel"><h2>Alterar senha</h2><form onSubmit={(event) => void submit(event)}><label>Senha atual<input type="password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} /></label><label>Nova senha<input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(event) => setNext(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}<button type="submit" className="primary-button compact" disabled={busy}>{busy ? 'Salvando…' : 'Alterar senha'}</button></form></section></div></>;
}

function SignedInApp() {
  const { session } = useSession();
  const { route, navigate } = useRoute();
  const role = session!.user.perfil;
  const secretary = role === 'SECRETARIA';
  const overview = useOverview(!secretary && !session!.user.trocaSenhaObrigatoria);
  let content;
  if (session!.user.trocaSenhaObrigatoria || route === '/conta') content = <AccountPage />;
  else if (secretary) content = <SecretaryPage route={route} navigate={navigate} />;
  else if (route === '/pessoas' && role === 'COORDENACAO') content = <PeoplePage />;
  else if (route === '/pessoas') content = <div className="state-message" role="alert">Área indisponível para este perfil.</div>;
  else if (overview.loading || overview.error || !overview.data) content = <StateMessage loading={overview.loading} error={overview.error} retry={overview.refresh} />;
  else if (route === '/turmas') content = <ClassesPage data={overview.data} navigate={navigate} refresh={overview.refresh} />;
  else if (route.startsWith('/turmas/')) {
    const item = overview.data.classes.find((value) => value.id === route.slice('/turmas/'.length));
    content = item ? <ClassDetail item={item} navigate={navigate} refresh={overview.refresh} /> : <div className="state-message" role="alert">Turma não encontrada ou indisponível para sua conta.</div>;
  } else if (route === '/atividades') content = <ActivitiesPage data={overview.data} navigate={navigate} refresh={overview.refresh} />;
  else content = <HomePage data={overview.data} navigate={navigate} refresh={overview.refresh} />;
  return <Shell route={route} navigate={navigate}>{content}</Shell>;
}

export function App() {
  const { session } = useSession();
  return session ? <SignedInApp /> : <Login />;
}
