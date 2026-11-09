import { useState, type ReactNode } from 'react';
import { useSession } from '../auth/Session';
import type { Perfil } from '../services/contracts';

const roleName: Record<Perfil, string> = { COORDENACAO: 'Coordenação', SECRETARIA: 'Secretaria', PROFESSOR: 'Docente', TUTOR: 'Tutoria', ALUNO: 'Estudante' };
const links: { label: string; path: string; roles: Perfil[]; icon: string }[] = [
  { label: 'Início', path: '/', roles: ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR', 'ALUNO'], icon: '⌂' },
  { label: 'Turmas', path: '/turmas', roles: ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR', 'ALUNO'], icon: '▦' },
  { label: 'Atividades', path: '/atividades', roles: ['COORDENACAO', 'PROFESSOR', 'TUTOR', 'ALUNO'], icon: '☷' },
  { label: 'Pessoas', path: '/pessoas', roles: ['COORDENACAO', 'SECRETARIA'], icon: '◯' },
  { label: 'Minha conta', path: '/conta', roles: ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR', 'ALUNO'], icon: '◌' },
];

export function Shell({ route, navigate, children }: { route: string; navigate: (path: string) => void; children: ReactNode }) {
  const { session, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!session) return null;
  const role = session.user.perfil;
  const active = (path: string) => path === '/' ? route === '/' : route.startsWith(path);
  return <div className="app-layout">
    <a className="skip-link" href="#content">Ir para o conteúdo</a>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark">S</span><span><strong>SGEI</strong><small>Gestão acadêmica</small></span></div>
      <div className="sidebar-context"><span>Ambiente acadêmico</span><strong>{roleName[role]}</strong></div>
      <nav aria-label="Navegação principal">
        {links.filter((link) => link.roles.includes(role)).map((link) => <a key={link.path} href={link.path} className={`nav-link ${active(link.path) ? 'active' : ''}`} aria-current={active(link.path) ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate(link.path); setMenuOpen(false); }}><span aria-hidden="true" className="nav-icon">{link.icon}</span>{link.label}</a>)}
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
