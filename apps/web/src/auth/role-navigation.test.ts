import assert from 'node:assert/strict';
import test from 'node:test';
import { canVisit, navigationByRole } from './role-navigation.ts';

test('cada perfil recebe suas próprias funções no menu', () => {
  assert.deepEqual(navigationByRole.COORDENACAO.map((item) => item.path), ['/', '/turmas', '/pessoas', '/cenarios', '/modelo', '/financeiro', '/conta']);
  assert.deepEqual(navigationByRole.SECRETARIA.map((item) => item.path), ['/', '/turmas', '/pessoas', '/financeiro', '/conta']);
  assert.deepEqual(navigationByRole.PROFESSOR.map((item) => item.path), ['/', '/turmas', '/chamada', '/notas', '/atividades', '/conta']);
  assert.deepEqual(navigationByRole.TUTOR.map((item) => item.path), ['/', '/turmas', '/frequencia', '/notas', '/atividades', '/conta']);
  assert.deepEqual(navigationByRole.ALUNO.map((item) => item.path), ['/', '/turmas', '/notas', '/frequencia', '/atividades', '/financeiro', '/conta']);
});

test('URL direta não abre área de outro perfil', () => {
  assert.equal(canVisit('ALUNO', '/modelo'), false);
  assert.equal(canVisit('ALUNO', '/cenarios'), false);
  assert.equal(canVisit('SECRETARIA', '/cenarios'), false);
  assert.equal(canVisit('ALUNO', '/pessoas'), false);
  assert.equal(canVisit('SECRETARIA', '/turmas/turma-1'), true);
  assert.equal(canVisit('SECRETARIA', '/turmas/turma-1/atividades/atividade-1'), false);
  assert.equal(canVisit('TUTOR', '/chamada'), false);
  assert.equal(canVisit('PROFESSOR', '/modelo'), false);
  assert.equal(canVisit('COORDENACAO', '/notas'), false);
  assert.equal(canVisit('ALUNO', '/turmas/turma-1'), true);
  assert.equal(canVisit('PROFESSOR', '/turmas/turma-1'), true);
  assert.equal(canVisit('ALUNO', '/turmas/turma-1/atividades/atividade-1'), true);
});

test('financeiro segue os perfis autorizados no backend', () => {
  for (const role of ['COORDENACAO', 'SECRETARIA', 'ALUNO'] as const) assert.equal(canVisit(role, '/financeiro'), true);
  for (const role of ['PROFESSOR', 'TUTOR'] as const) assert.equal(canVisit(role, '/financeiro'), false);
});
