// Participantes de uma turma (resposta de GET /turmas/:id/participantes) e as contas que a tela mostra
// a partir dela. Sem React: o que depende só dos dados fica aqui, onde dá para testar.

export interface ParticipantPerson {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface ParticipantSubject {
  id: string;
  nome: string;
  docentes: ParticipantPerson[];
}

export interface ParticipantStudent {
  matriculaId: string;
  registro: string;
  aluno: ParticipantPerson;
  tutores: { id: string; nome: string }[];
}

/** O que o perfil pode fazer nesta turma. Vem da API, que também confere cada ação: o app não repete a regra. */
export interface ParticipantPermissions {
  criarDisciplina: boolean;
  vincularDocente: boolean;
  vincularTutor: boolean;
  matricular: boolean;
  removerMatricula: boolean;
}

export interface Participants {
  turma: { id: string; nome: string; curso: string; periodo: string; fechada: boolean };
  disciplinas: ParticipantSubject[];
  estudantes: ParticipantStudent[];
  permissoes: ParticipantPermissions;
}

export interface ParticipantCounts {
  disciplinas: number;
  semDocente: number;
  docentes: number;
  estudantes: number;
}

/** Contagens do cabeçalho. Um docente que leciona duas disciplinas conta uma vez. */
export function countParticipants(data: Pick<Participants, 'disciplinas' | 'estudantes'>): ParticipantCounts {
  const teachers = new Set<string>();
  let semDocente = 0;
  for (const subject of data.disciplinas) {
    if (!subject.docentes.length) semDocente += 1;
    for (const teacher of subject.docentes) teachers.add(teacher.id);
  }
  return { disciplinas: data.disciplinas.length, semDocente, docentes: teachers.size, estudantes: data.estudantes.length };
}

/** Nomes separados por vírgula, ou `empty` quando não há ninguém. */
export function namesLabel(people: { nome: string }[], empty: string): string {
  return people.length ? people.map((person) => person.nome).join(', ') : empty;
}

/** Linha de apoio do estudante: registro e, quando houver, quem o acompanha. */
export function studentMeta(student: ParticipantStudent): string {
  return student.tutores.length ? `${student.registro} · Tutoria: ${namesLabel(student.tutores, '')}` : student.registro;
}

/** True quando a turma ainda não tem nada: o app mostra o roteiro de montagem em vez de listas vazias. */
export function isEmptyClass(data: Pick<Participants, 'disciplinas' | 'estudantes'>): boolean {
  return data.disciplinas.length === 0 && data.estudantes.length === 0;
}

export interface PickerPerson {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Quem pode ser escolhido no seletor: contas ativas que ainda não estão vinculadas, filtradas por nome ou
 * e-mail (sem acento e sem diferenciar maiúsculas). Devolve só os primeiros `limit` e o total, para a
 * tela dizer que há mais e pedir uma busca mais específica.
 */
export function pickCandidates<T extends PickerPerson>(people: T[], exclude: ReadonlySet<string>, query = '', limit = 8): { items: T[]; total: number } {
  const needle = fold(query.trim());
  const matches = people
    .filter((person) => person.ativo && !exclude.has(person.id) && (!needle || fold(person.nome).includes(needle) || fold(person.email).includes(needle)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { items: matches.slice(0, limit), total: matches.length };
}
