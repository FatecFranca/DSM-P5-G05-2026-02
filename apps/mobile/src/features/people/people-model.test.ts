import assert from 'node:assert/strict';
import test from 'node:test';
import { countByRole, filterPeople, initialRole, matchesQuery, resolveRole, sortPeople, visibleRoles } from './people-model.ts';

type P = Parameters<typeof matchesQuery>[0] & { perfil: 'ALUNO' | 'PROFESSOR' | 'TUTOR' | 'COORDENACAO' | 'SECRETARIA'; criadoEm: string };
const person = (nome: string, perfil: P['perfil'] = 'ALUNO', criadoEm = '2026-11-01T10:00:00Z'): P => ({ nome, email: `${nome.split(' ')[0].toLowerCase()}@escola.edu`, perfil, criadoEm });
const people = [person('José Almeida'), person('Ana Lima'), person('Marina Souza', 'PROFESSOR'), person('Ana Paula Reis', 'PROFESSOR'), person('Carla Tutora', 'TUTOR')];

test('busca ignora acento, maiúsculas e ordem dos termos', () => {
  assert.equal(matchesQuery(people[0], 'JOSE'), true);
  assert.equal(matchesQuery(people[0], 'almeida jose'), true);
  assert.equal(matchesQuery(people[0], 'josé@escola'), true);
  assert.equal(matchesQuery(people[0], 'maria'), false);
  assert.equal(matchesQuery(people[0], '   '), true, 'busca vazia não filtra');
});

test('contagem por perfil: total sem busca, só os que casam com busca', () => {
  assert.deepEqual(countByRole(people), { ALUNO: 2, PROFESSOR: 2, TUTOR: 1, COORDENACAO: 0, SECRETARIA: 0 });
  assert.deepEqual(countByRole(people, 'ana'), { ALUNO: 1, PROFESSOR: 1, TUTOR: 0, COORDENACAO: 0, SECRETARIA: 0 });
});

test('abas: perfis com gente, mais Estudantes e Docentes; a aba aberta nunca some', () => {
  assert.deepEqual(visibleRoles(countByRole(people), 'ALUNO'), ['ALUNO', 'PROFESSOR', 'TUTOR']);
  assert.deepEqual(visibleRoles(countByRole([]), 'ALUNO'), ['ALUNO', 'PROFESSOR']);
  assert.deepEqual(visibleRoles(countByRole([]), 'SECRETARIA'), ['ALUNO', 'PROFESSOR', 'SECRETARIA']);
});

test('aba inicial: Estudantes se houver, senão o primeiro perfil com gente', () => {
  assert.equal(initialRole(countByRole(people)), 'ALUNO');
  assert.equal(initialRole(countByRole(people.filter((item) => item.perfil !== 'ALUNO'))), 'PROFESSOR');
  assert.equal(initialRole(countByRole([])), 'ALUNO');
});

test('filtra pelo perfil da aba e pela busca', () => {
  assert.deepEqual(filterPeople(people, 'PROFESSOR', '').map((item) => item.nome), ['Marina Souza', 'Ana Paula Reis']);
  assert.deepEqual(filterPeople(people, 'PROFESSOR', 'ana').map((item) => item.nome), ['Ana Paula Reis']);
  assert.deepEqual(filterPeople(people, 'COORDENACAO', ''), []);
});

test('ordena por nome (pt-BR, com acento) ou por cadastro mais recente', () => {
  const list = [person('Zélia', 'ALUNO', '2026-11-03T00:00:00Z'), person('Álvaro', 'ALUNO', '2026-11-01T00:00:00Z'), person('Bia', 'ALUNO', '2026-11-03T00:00:00Z')];
  assert.deepEqual(sortPeople(list, 'nome').map((item) => item.nome), ['Álvaro', 'Bia', 'Zélia']);
  assert.deepEqual(sortPeople(list, 'recentes').map((item) => item.nome), ['Bia', 'Zélia', 'Álvaro'], 'empate de data desempata por nome');
  assert.equal(list[0].nome, 'Zélia', 'não altera a lista original');
});

test('busca abre o perfil que tem resultado quando a aba aberta não tem nenhum', () => {
  const counts = countByRole(people, 'marina');
  assert.equal(resolveRole('ALUNO', counts, 'marina'), 'PROFESSOR');
  assert.equal(resolveRole('PROFESSOR', counts, 'marina'), 'PROFESSOR', 'resultado na própria aba: mantém');
  assert.equal(resolveRole('ALUNO', countByRole(people), ''), 'ALUNO', 'sem busca: vale a escolha da pessoa');
  assert.equal(resolveRole('ALUNO', countByRole(people, 'zzz'), 'zzz'), 'ALUNO', 'sem resultado em lugar nenhum: fica onde está');
  assert.equal(resolveRole('TUTOR', countByRole(people, 'ana'), 'ana'), 'ALUNO', 'escolhe o primeiro perfil na ordem fixa');
});
