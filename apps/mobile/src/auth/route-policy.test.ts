import assert from 'node:assert/strict';
import test from 'node:test';
import { canSend } from './route-policy.ts';

test('aluno só envia arquivos e a própria entrega; bloqueia notas e administração', () => {
  assert.equal(canSend('ALUNO', 'PUT', '/atividades/abc/entrega'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/avaliacoes/abc/notas'), false);
  assert.equal(canSend('ALUNO', 'GET', '/usuarios'), false);
  assert.equal(canSend('ALUNO', 'POST', '/ml/preview'), false);
});
test('coordenação e tutor consultam sem liberar mutações', () => {
  for (const role of ['COORDENACAO', 'TUTOR'] as const) {
    assert.equal(canSend(role, 'GET', '/academico/resumo?turmaId=abc'), true);
    assert.equal(canSend(role, 'GET', '/academico/calendario?inicio=2026-10-01&fim=2026-11-01'), true);
    assert.equal(canSend(role, 'GET', '/academico/avisos?pagina=2'), true);
    assert.equal(canSend(role, 'POST', '/aulas'), false);
  }
});
test('professor lança notas e admin gerencia a estrutura', () => {
  assert.equal(canSend('PROFESSOR', 'PUT', '/avaliacoes/abc/notas'), true);
  assert.equal(canSend('PROFESSOR', 'POST', '/usuarios'), false);
  assert.equal(canSend('ADMIN', 'POST', '/usuarios'), true);
  assert.equal(canSend('ADMIN', 'PUT', '/avaliacoes/abc/notas'), false);
});
