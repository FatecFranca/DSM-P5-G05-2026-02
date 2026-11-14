import assert from 'node:assert/strict';
import test from 'node:test';
import { countParticipants, isEmptyClass, namesLabel, pickCandidates, studentMeta, type ParticipantPerson, type ParticipantStudent, type ParticipantSubject } from './participants-model.ts';

const person = (id: string, nome: string, extra: Partial<ParticipantPerson> = {}): ParticipantPerson => ({ id, nome, email: `${id}@fatec.sp.gov.br`, ativo: true, ...extra });
const subject = (id: string, docentes: ParticipantPerson[]): ParticipantSubject => ({ id, nome: `Disciplina ${id}`, docentes });
const student = (id: string, tutores: { id: string; nome: string }[] = []): ParticipantStudent => ({ matriculaId: `m-${id}`, registro: `RA-${id}`, aluno: person(id, `Aluno ${id}`), tutores });

test('conta docentes distintos e as disciplinas ainda sem docente', () => {
  const ana = person('ana', 'Ana');
  const counts = countParticipants({
    disciplinas: [subject('a', [ana]), subject('b', [ana, person('caio', 'Caio')]), subject('c', [])],
    estudantes: [student('1'), student('2')],
  });
  assert.deepEqual(counts, { disciplinas: 3, semDocente: 1, docentes: 2, estudantes: 2 });
});

test('turma vazia e turma só com disciplinas', () => {
  assert.equal(isEmptyClass({ disciplinas: [], estudantes: [] }), true);
  assert.equal(isEmptyClass({ disciplinas: [subject('a', [])], estudantes: [] }), false);
  assert.equal(isEmptyClass({ disciplinas: [], estudantes: [student('1')] }), false);
  assert.deepEqual(countParticipants({ disciplinas: [], estudantes: [] }), { disciplinas: 0, semDocente: 0, docentes: 0, estudantes: 0 });
});

test('rótulos de nomes e de estudante', () => {
  assert.equal(namesLabel([], 'Sem docente'), 'Sem docente');
  assert.equal(namesLabel([{ nome: 'Ana' }, { nome: 'Caio' }], 'Sem docente'), 'Ana, Caio');
  assert.equal(studentMeta(student('1')), 'RA-1');
  assert.equal(studentMeta(student('1', [{ id: 't', nome: 'Tânia' }, { id: 'u', nome: 'Ulisses' }])), 'RA-1 · Tutoria: Tânia, Ulisses');
});

test('seletor: só contas ativas e ainda não vinculadas, por nome ou e-mail sem acento', () => {
  const people = [
    person('1', 'Álvaro Lima'), person('2', 'Beatriz Souza'), person('3', 'Alvina Costa', { ativo: false }),
    person('4', 'Carlos Alves'), person('5', 'alvaro.dias', { }),
  ];
  const all = pickCandidates(people, new Set());
  assert.deepEqual(all.items.map((item) => item.id).sort(), ['1', '2', '4', '5']);
  assert.equal(all.total, 4);
  const names = all.items.map((item) => item.nome);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  assert.equal(pickCandidates(people, new Set(['1'])).items.some((item) => item.id === '1'), false);
  assert.deepEqual(pickCandidates(people, new Set(), 'alvaro').items.map((item) => item.id).sort(), ['1', '5']);
  assert.deepEqual(pickCandidates(people, new Set(), '  BEATRIZ ').items.map((item) => item.id), ['2']);
  assert.deepEqual(pickCandidates(people, new Set(), '4@fatec').items.map((item) => item.id), ['4']);
  assert.equal(pickCandidates(people, new Set(), 'zzz').total, 0);
});

test('seletor: limita a lista mas informa o total', () => {
  const many = Array.from({ length: 30 }, (_, index) => person(String(index), `Pessoa ${String(index).padStart(2, '0')}`));
  const result = pickCandidates(many, new Set(), '', 8);
  assert.equal(result.items.length, 8);
  assert.equal(result.total, 30);
  assert.equal(result.items[0].nome, 'Pessoa 00');
});
