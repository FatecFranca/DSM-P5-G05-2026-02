import assert from 'node:assert/strict';
import test from 'node:test';
import { canSend } from './route-policy.ts';

test('aluno consulta somente sua pessoa e envia autodeclaração; bloqueia notas e administração', () => {
  assert.equal(canSend('ALUNO', 'PUT', '/atividades/abc/entrega'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/avaliacoes/abc/notas'), false);
  assert.equal(canSend('ALUNO', 'GET', '/usuarios'), true);
  assert.equal(canSend('ALUNO', 'GET', '/ml/matriculas/abc/autodeclaracao'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/ml/matriculas/abc/autodeclaracao'), true);
  assert.equal(canSend('PROFESSOR', 'PUT', '/ml/matriculas/abc/autodeclaracao'), false);
  assert.equal(canSend('ALUNO', 'PUT', '/ml/matriculas/abc/declaracao-ingresso'), true);
  assert.equal(canSend('ADMIN', 'POST', '/ml/importacoes'), true);
  assert.equal(canSend('ADMIN', 'GET', '/ml/previsoes-automaticas'), true);
  assert.equal(canSend('ALUNO', 'GET', '/ml/previsoes-automaticas'), false);
  assert.equal(canSend('ALUNO', 'POST', '/ml/importacoes'), false);
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

test('prévia ML é enviada somente por ADMIN e nunca libera rotas de treino', () => {
  for (const role of ['ADMIN', 'PROFESSOR', 'ALUNO', 'COORDENACAO', 'TUTOR'] as const) {
    assert.equal(canSend(role, 'POST', '/ml/preview'), role === 'ADMIN');
    assert.equal(canSend(role, 'GET', '/ml/schema'), role === 'ADMIN' || role === 'COORDENACAO');
    assert.equal(canSend(role, 'POST', '/ml/treinos'), false);
  }
});

test('análise usa a matrícula; cadastro limitado a administração e coordenação', () => {
  for (const role of ['ADMIN', 'PROFESSOR', 'ALUNO', 'COORDENACAO', 'TUTOR'] as const) {
    assert.equal(canSend(role, 'GET', '/ml/matriculas/abc'), role !== 'ALUNO');
    assert.equal(canSend(role, 'GET', '/ml/matriculas/abc/demonstracao'), role !== 'ALUNO');
    assert.equal(canSend(role, 'POST', '/ml/matriculas/abc/analisar'), role !== 'ALUNO');
    assert.equal(canSend(role, 'PUT', '/ml/matriculas/abc'), role === 'ADMIN' || role === 'COORDENACAO');
    assert.equal(canSend(role, 'POST', '/ml/matriculas/abc/treinar'), false);
  }
});

test('secretaria homologa ingresso e financeiro opera somente cobrança', () => {
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/ingressos/pendentes'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/ingressos/matriculas?registro=123'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/schema'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/ingresso'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/semestres/1'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/coorte-macro'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/fontes/macro/PT/2026'), false);
  assert.equal(canSend('SECRETARIA', 'POST', '/ml/fontes/importacoes/semestres'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/ml/fontes/importacoes/macro'), false);
  assert.equal(canSend('ADMIN', 'POST', '/ml/fontes/importacoes/macro'), true);
  assert.equal(canSend('ADMIN', 'PUT', '/ml/fontes/macro/PT/2026'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/usuarios'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/matriculas'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/turmas'), false);
  assert.equal(canSend('SECRETARIA', 'GET', '/faturas/matriculas?registro=123'), false);
  assert.equal(canSend('FINANCEIRO', 'GET', '/faturas/matriculas?registro=123'), true);
  assert.equal(canSend('FINANCEIRO', 'PUT', '/faturas/matriculas/abc/plano'), true);
  assert.equal(canSend('FINANCEIRO', 'GET', '/faturas/matriculas/abc/plano'), true);
  assert.equal(canSend('FINANCEIRO', 'POST', '/faturas/abc/pagamentos'), true);
  assert.equal(canSend('FINANCEIRO', 'PUT', '/bolsas/matriculas/abc'), true);
  assert.equal(canSend('FINANCEIRO', 'GET', '/academico/resumo'), false);
  assert.equal(canSend('FINANCEIRO', 'GET', '/ml/matriculas/abc/ingresso'), false);
  assert.equal(canSend('ALUNO', 'PUT', '/faturas/matriculas/abc/plano'), false);
  assert.equal(canSend('ALUNO', 'GET', '/faturas/matriculas/abc'), true);
  assert.equal(canSend('ALUNO', 'GET', '/faturas/matriculas/abc/semestres'), true);
  assert.equal(canSend('ALUNO', 'POST', '/faturas/abc/simular-pagamento'), true);
  assert.equal(canSend('FINANCEIRO', 'POST', '/faturas/abc/simular-pagamento'), false);
  assert.equal(canSend('ADMIN', 'PUT', '/turmas/abc/duracao'), true);
  assert.equal(canSend('FINANCEIRO', 'PUT', '/turmas/abc/duracao'), false);
});
