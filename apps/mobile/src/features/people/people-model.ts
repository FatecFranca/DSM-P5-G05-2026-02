import type { Perfil, UserSummary } from '../../services/api.ts';

// Regras da lista de pessoas sem tela: contagem por perfil, busca, ordenação e quais abas aparecem.

export const ROLE_ORDER: Perfil[] = ['ALUNO', 'PROFESSOR', 'TUTOR', 'COORDENACAO', 'SECRETARIA'];
export const ROLE_TAB_LABEL: Record<Perfil, string> = {
  ALUNO: 'Estudantes', PROFESSOR: 'Docentes', TUTOR: 'Tutoria', COORDENACAO: 'Coordenação', SECRETARIA: 'Secretaria',
};
export type SortKey = 'nome' | 'recentes';
type Person = Pick<UserSummary, 'nome' | 'email' | 'perfil' | 'criadoEm'>;

/** Sem acento, minúsculo e sem espaços nas pontas: "JOSE" encontra "José". */
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();

/** Todos os termos digitados precisam aparecer no nome ou no e-mail, em qualquer ordem. */
export function matchesQuery(person: Pick<Person, 'nome' | 'email'>, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(`${person.nome} ${person.email}`);
  return terms.every((term) => haystack.includes(term));
}

const emptyCounts = (): Record<Perfil, number> => ({ ALUNO: 0, PROFESSOR: 0, TUTOR: 0, COORDENACAO: 0, SECRETARIA: 0 });

/** Quantas pessoas de cada perfil casam com a busca (sem busca, o total da instituição). */
export function countByRole(people: Person[], query = ''): Record<Perfil, number> {
  const counts = emptyCounts();
  for (const person of people) if (matchesQuery(person, query)) counts[person.perfil] += 1;
  return counts;
}

/**
 * Abas mostradas: perfis que têm gente, mais Estudantes e Docentes, que são o uso diário e precisam
 * existir mesmo numa instituição nova (para explicar o vazio). A aba aberta nunca some.
 */
export function visibleRoles(totals: Record<Perfil, number>, selected: Perfil): Perfil[] {
  return ROLE_ORDER.filter((role) => totals[role] > 0 || role === 'ALUNO' || role === 'PROFESSOR' || role === selected);
}

/** Estudantes, se houver; senão o primeiro perfil com gente. */
export function initialRole(totals: Record<Perfil, number>): Perfil {
  return ROLE_ORDER.find((role) => totals[role] > 0) ?? 'ALUNO';
}

/**
 * Com busca, a aba aberta não pode esconder o resultado: se ela não tem nenhum, mostra o primeiro perfil
 * que tem. Sem busca, ou com resultado na própria aba, vale a escolha da pessoa.
 */
export function resolveRole(selected: Perfil, counts: Record<Perfil, number>, query: string): Perfil {
  if (!query.trim() || counts[selected] > 0) return selected;
  return ROLE_ORDER.find((role) => counts[role] > 0) ?? selected;
}

export function filterPeople<T extends Person>(people: T[], role: Perfil, query: string): T[] {
  return people.filter((person) => person.perfil === role && matchesQuery(person, query));
}

export function sortPeople<T extends Person>(people: T[], sort: SortKey): T[] {
  const list = [...people];
  return sort === 'nome'
    ? list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    : list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
