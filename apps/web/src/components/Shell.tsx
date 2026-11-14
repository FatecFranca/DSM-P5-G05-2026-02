import { useState, type ReactNode } from 'react';
import { useSession } from '../auth/Session';
import { navigationByRole } from '../auth/role-navigation';
import type { Perfil } from '../services/contracts';

const roleName: Record<Perfil, string> = { COORDENACAO: 'Coordenação', SECRETARIA: 'Secretaria', PROFESSOR: 'Docente', TUTOR: 'Tutoria', ALUNO: 'Estudante' };
const iconPaths: Record<string, string> = {
  '/': 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  '/turmas': 'M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z',
  '/pessoas': 'M15 21v-2a5 5 0 0 0-10 0v2M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 8M19 16a5 5 0 0 1 2 5',
  '/financeiro': 'M3 5h18v15H3zM3 9h18M6 13h4M6 16h2M15 13h3',
  '/conta': 'M4 21v-2a8 8 0 0 1 16 0v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  '/modelo': 'M4 3v18h17M8 16v-5M13 16V6M18 16v-8',
  '/cenarios': 'M5 3h10l4 4v14H5zM15 3v5h4M12 17V11M9 14l3-3 3 3',
  '/chamada': 'M4 4h16v17H4zM8 2v4M16 2v4M8 13l3 3 5-6',
};
function NavigationIcon({ path }: { path: string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[path] ?? 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5'} /></svg>;
}
export function Shell({ route, navigate, children }: { route: string; navigate: (path: string) => void; children: ReactNode }) {
  const { session, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!session) return null;
  const role = session.user.perfil;
  const active = (path: string) => path === '/' ? route === '/' : route === path || (path === '/turmas' && route.startsWith('/turmas/'));
  return <div className="app-layout">
    <a className="skip-link" href="#content">Ir para o conteúdo</a>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark">S</span><span><strong>SGEI</strong><small>Gestão acadêmica</small></span></div>
      <div className="sidebar-context"><span>Ambiente acadêmico</span><strong>{roleName[role]}</strong></div>
      <nav aria-label="Navegação principal">
        {navigationByRole[role].map((link) => <a key={link.path} href={link.path} className={`nav-link ${active(link.path) ? 'active' : ''}`} aria-current={active(link.path) ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate(link.path); setMenuOpen(false); }}><NavigationIcon path={link.path} />{link.label}</a>)}
      </nav>
      <div className="sidebar-bottom"><span className="avatar">{roleName[role].slice(0, 1)}</span><div><strong>{roleName[role]}</strong><small>Sessão ativa</small></div><button type="button" onClick={() => void signOut()} aria-label="Sair">Sair</button></div>
    </aside>
    <div className="main-column">
      <header className="mobile-header"><button type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>☰</button><strong>SGEI</strong><span>{roleName[role]}</span></header>
      {menuOpen && <button type="button" className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <main id="content" className="content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
