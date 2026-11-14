import type { Perfil } from '../services/contracts';

export interface NavigationItem { label: string; path: string; icon: string }

const account: NavigationItem = { label: 'Minha conta', path: '/conta', icon: '◌' };
const finance: NavigationItem = { label: 'Financeiro', path: '/financeiro', icon: '$' };

export const navigationByRole: Record<Perfil, readonly NavigationItem[]> = {
  COORDENACAO: [
    { label: 'Painel', path: '/', icon: '⌂' },
    { label: 'Turmas', path: '/turmas', icon: '▦' },
    { label: 'Pessoas', path: '/pessoas', icon: '◯' },
    { label: 'Cenários', path: '/cenarios', icon: '⇧' },
    { label: 'Modelo', path: '/modelo', icon: '◫' },
    finance,
    account,
  ],
  SECRETARIA: [
    { label: 'Secretaria', path: '/', icon: '⌂' },
    { label: 'Turmas', path: '/turmas', icon: '▦' },
    { label: 'Pessoas', path: '/pessoas', icon: '◯' },
    finance,
    account,
  ],
  PROFESSOR: [
    { label: 'Início', path: '/', icon: '⌂' },
    { label: 'Turmas', path: '/turmas', icon: '▦' },
    { label: 'Chamada', path: '/chamada', icon: '✓' },
    { label: 'Notas', path: '/notas', icon: '▤' },
    { label: 'Atividades', path: '/atividades', icon: '☷' },
    account,
  ],
  TUTOR: [
    { label: 'Acompanhamento', path: '/', icon: '⌂' },
    { label: 'Turmas', path: '/turmas', icon: '▦' },
    { label: 'Frequência', path: '/frequencia', icon: '✓' },
    { label: 'Notas', path: '/notas', icon: '▤' },
    { label: 'Atividades', path: '/atividades', icon: '☷' },
    account,
  ],
  ALUNO: [
    { label: 'Meu início', path: '/', icon: '⌂' },
    { label: 'Minhas turmas', path: '/turmas', icon: '▦' },
    { label: 'Minhas notas', path: '/notas', icon: '▤' },
    { label: 'Minha frequência', path: '/frequencia', icon: '✓' },
    { label: 'Atividades', path: '/atividades', icon: '☷' },
    { ...finance, label: 'Mensalidades' },
    account,
  ],
};

export function canVisit(role: Perfil, route: string): boolean {
  if (route.startsWith('/turmas/')) return /^\/turmas\/[^/]+$/.test(route) || (role !== 'SECRETARIA' && /^\/turmas\/[^/]+\/atividades\/[^/]+$/.test(route));
  return navigationByRole[role].some((item) => item.path === route);
}
