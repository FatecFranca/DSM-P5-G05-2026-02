import assert from 'node:assert/strict';
import test from 'node:test';
import { canSend } from './route-policy.ts';

test('troca de senha temporária é permitida a qualquer perfil autenticado', () => {
  for (const role of ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR', 'ALUNO'] as const) {
    assert.equal(canSend(role, 'POST', '/auth/trocar-senha'), true);
    assert.equal(canSend(role, 'GET', '/auth/trocar-senha'), false);
  }
});

test('aluno consulta somente sua pessoa e envia autodeclaração; bloqueia notas e administração', () => {
  assert.equal(canSend('ALUNO', 'PUT', '/atividades/abc/entrega'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/avaliacoes/abc/notas'), false);
  assert.equal(canSend('ALUNO', 'GET', '/usuarios'), true);
  assert.equal(canSend('ALUNO', 'GET', '/ml/matriculas/abc/autodeclaracao'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/ml/matriculas/abc/autodeclaracao'), true);
  assert.equal(canSend('PROFESSOR', 'PUT', '/ml/matriculas/abc/autodeclaracao'), false);
  assert.equal(canSend('ALUNO', 'PUT', '/ml/matriculas/abc/declaracao-ingresso'), true);
  assert.equal(canSend('COORDENACAO', 'POST', '/ml/importacoes'), true);
  assert.equal(canSend('COORDENACAO', 'GET', '/ml/previsoes-automaticas'), true);
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
test('professor lança notas e coordenação gerencia a estrutura', () => {
  assert.equal(canSend('PROFESSOR', 'PUT', '/avaliacoes/abc/notas'), true);
  assert.equal(canSend('PROFESSOR', 'POST', '/usuarios'), false);
  assert.equal(canSend('COORDENACAO', 'POST', '/usuarios'), true);
  assert.equal(canSend('COORDENACAO', 'PUT', '/avaliacoes/abc/notas'), false);
});

test('prévia ML é enviada somente pela coordenação e nunca libera rotas de treino', () => {
  for (const role of ['COORDENACAO', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'TUTOR'] as const) {
    assert.equal(canSend(role, 'POST', '/ml/preview'), role === 'COORDENACAO');
    assert.equal(canSend(role, 'GET', '/ml/schema'), role === 'COORDENACAO' || role === 'SECRETARIA');
    assert.equal(canSend(role, 'POST', '/ml/treinos'), false);
  }
});

test('análise usa a matrícula; cadastro limitado à coordenação', () => {
  for (const role of ['COORDENACAO', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'TUTOR'] as const) {
    assert.equal(canSend(role, 'GET', '/ml/matriculas/abc'), ['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role));
    assert.equal(canSend(role, 'GET', '/ml/matriculas/abc/demonstracao'), ['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role));
    assert.equal(canSend(role, 'POST', '/ml/matriculas/abc/analisar'), ['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(role));
    assert.equal(canSend(role, 'PUT', '/ml/matriculas/abc'), role === 'COORDENACAO');
    assert.equal(canSend(role, 'POST', '/ml/matriculas/abc/treinar'), false);
  }
});

test('secretaria homologa ingresso e opera cobrança', () => {
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/ingressos/pendentes'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/ingressos/matriculas?registro=123'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/schema'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/ingresso'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/semestres/1'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/matriculas/abc/coorte-macro'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/ml/fontes/macro/PT/2026'), false);
  assert.equal(canSend('SECRETARIA', 'POST', '/ml/fontes/importacoes/semestres'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/ml/fontes/importacoes/macro'), false);
  assert.equal(canSend('COORDENACAO', 'POST', '/ml/fontes/importacoes/macro'), true);
  assert.equal(canSend('COORDENACAO', 'PUT', '/ml/fontes/macro/PT/2026'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/usuarios'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/matriculas'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/turmas'), false);
  assert.equal(canSend('SECRETARIA', 'GET', '/faturas/matriculas?registro=123'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/faturas/matriculas/abc/plano'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/faturas/matriculas/abc/plano'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/faturas/abc/pagamentos'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/bolsas/matriculas/abc'), true);
  assert.equal(canSend('SECRETARIA', 'GET', '/academico/resumo'), false);
  assert.equal(canSend('SECRETARIA', 'GET', '/ml/matriculas/abc/ingresso'), true);
  assert.equal(canSend('ALUNO', 'PUT', '/faturas/matriculas/abc/plano'), false);
  assert.equal(canSend('ALUNO', 'GET', '/faturas/matriculas/abc'), true);
  assert.equal(canSend('ALUNO', 'GET', '/faturas/matriculas/abc/semestres'), true);
  assert.equal(canSend('ALUNO', 'POST', '/faturas/abc/simular-pagamento'), true);
  assert.equal(canSend('SECRETARIA', 'POST', '/faturas/abc/simular-pagamento'), false);
  assert.equal(canSend('COORDENACAO', 'PUT', '/turmas/abc/duracao'), true);
  assert.equal(canSend('SECRETARIA', 'PUT', '/turmas/abc/duracao'), false);
});
