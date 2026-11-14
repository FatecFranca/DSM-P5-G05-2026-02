import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../auth/Session';
import { publicApi } from '../services/api';
import type { Institution } from '../services/contracts';

export function Login() {
  const { signIn } = useSession();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    publicApi.institutions().then((items) => { if (active) setInstitutions(items); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as instituições.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try { await signIn(institutionId, email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }

  return <main className="login-layout">
    <section className="login-hero">
      <div className="brand brand-light"><span className="brand-mark">S</span><span><strong>SGEI</strong><small>Sistema de Gestão do Ensino Superior</small></span></div>
      <div className="login-copy"><span className="hero-line" aria-hidden="true" /><h1>Seu campus, em uma só visão.</h1><p>Acompanhe turmas, registros e atividades acadêmicas com as informações da sua instituição.</p></div>
      <div className="login-foot">Gestão acadêmica com acesso por perfil e vínculo.</div>
    </section>
    <section className="login-side" aria-labelledby="login-title">
      <div className="login-card">
        <p className="login-overline">Acesso institucional</p>
        <h2 id="login-title">Entre na sua conta</h2>
        <p className="muted">Use as credenciais fornecidas pela sua instituição.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="institution">Instituição</label>
          <select id="institution" required value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} disabled={loading || busy}>
            <option value="">{loading ? 'Carregando instituições…' : 'Selecione a instituição'}</option>
            {institutions.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
          <label htmlFor="email">E-mail institucional</label>
          <input id="email" type="email" autoComplete="username" placeholder="voce@instituicao.edu" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <div className="form-error" role="alert">{error}{!institutions.length && <button type="button" className="text-button" onClick={() => { setError(''); setRevision((value) => value + 1); }}>Tentar novamente</button>}</div>}
          <button className="primary-button" type="submit" disabled={busy || loading || !institutions.length}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="login-note">Dados e ações disponíveis dependem do seu perfil e vínculo acadêmico.</p>
      </div>
    </section>
  </main>;
}
