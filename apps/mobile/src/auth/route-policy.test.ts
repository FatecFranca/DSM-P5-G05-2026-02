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

test('mensagens: estudante e docente conversam, tutoria só lê canais, gestão fica de fora', () => {
  const canal = '/mensagens/canais/turma%3Ageral';
  for (const perfil of ['ALUNO', 'PROFESSOR'] as const) {
    assert.equal(canSend(perfil, 'GET', '/mensagens/resumo'), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/contatos?q=ana'), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/conversas'), true);
    assert.equal(canSend(perfil, 'POST', '/mensagens/conversas'), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/conversas/abc'), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/conversas/abc/mensagens?limite=50&antes=def'), true);
    assert.equal(canSend(perfil, 'POST', '/mensagens/conversas/abc/mensagens'), true);
    assert.equal(canSend(perfil, 'PUT', '/mensagens/conversas/abc/leitura'), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/canais'), true);
    assert.equal(canSend(perfil, 'GET', `${canal}/publicacoes?limite=50`), true);
    assert.equal(canSend(perfil, 'PUT', `${canal}/leitura`), true);
    assert.equal(canSend(perfil, 'GET', '/mensagens/publicacoes/abc'), true);
    assert.equal(canSend(perfil, 'POST', '/mensagens/publicacoes/abc/respostas'), true);
    assert.equal(canSend(perfil, 'POST', '/mensagens/curtidas'), true);
  }
  assert.equal(canSend('PROFESSOR', 'POST', `${canal}/publicacoes`), true);
  assert.equal(canSend('ALUNO', 'POST', `${canal}/publicacoes`), false, 'só docentes publicam');
  assert.equal(canSend('TUTOR', 'GET', '/mensagens/canais'), true);
  assert.equal(canSend('TUTOR', 'GET', `${canal}/publicacoes`), true);
  assert.equal(canSend('TUTOR', 'GET', '/mensagens/publicacoes/abc'), true);
  assert.equal(canSend('TUTOR', 'PUT', `${canal}/leitura`), true);
  for (const [method, path] of [['GET', '/mensagens/conversas'], ['POST', '/mensagens/conversas'], ['GET', '/mensagens/contatos'], ['POST', '/mensagens/curtidas'], ['POST', '/mensagens/publicacoes/abc/respostas'], ['POST', `${canal}/publicacoes`]] as const) {
    assert.equal(canSend('TUTOR', method, path), false, `tutoria não: ${method} ${path}`);
  }
  for (const perfil of ['COORDENACAO', 'SECRETARIA'] as const) {
    assert.equal(canSend(perfil, 'GET', '/mensagens/resumo'), false);
    assert.equal(canSend(perfil, 'GET', '/mensagens/canais'), false);
  }
  assert.equal(canSend('ALUNO', 'DELETE', '/mensagens/conversas/abc'), false);
  assert.equal(canSend('ALUNO', 'GET', '/mensagens/desconhecida'), false);
});

test('avisos: leitura no servidor para quem acompanha turmas, não para a secretaria', () => {
  for (const perfil of ['ALUNO', 'PROFESSOR', 'TUTOR', 'COORDENACAO'] as const) {
    assert.equal(canSend(perfil, 'GET', '/academico/avisos/leitura'), true);
    assert.equal(canSend(perfil, 'PUT', '/academico/avisos/leitura'), true);
  }
  assert.equal(canSend('SECRETARIA', 'GET', '/academico/avisos/leitura'), false);
  assert.equal(canSend('ALUNO', 'POST', '/academico/avisos/leitura'), false);
});

test('gestão de contas: coordenação e secretaria; estudante, professor e tutoria não', () => {
  for (const perfil of ['COORDENACAO', 'SECRETARIA'] as const) {
    assert.equal(canSend(perfil, 'PATCH', '/usuarios/abc'), true);
    assert.equal(canSend(perfil, 'POST', '/usuarios/abc/redefinir-senha'), true);
    assert.equal(canSend(perfil, 'POST', '/usuarios/importacoes?perfil=ALUNO&simular=true'), true);
    assert.equal(canSend(perfil, 'GET', '/usuarios/importacoes/modelo?perfil=ALUNO'), true);
  }
  for (const perfil of ['ALUNO', 'PROFESSOR', 'TUTOR'] as const) {
    assert.equal(canSend(perfil, 'PATCH', '/usuarios/abc'), false);
    assert.equal(canSend(perfil, 'POST', '/usuarios/abc/redefinir-senha'), false);
    assert.equal(canSend(perfil, 'POST', '/usuarios/importacoes'), false);
    assert.equal(canSend(perfil, 'GET', '/usuarios/importacoes/modelo'), false);
  }
  assert.equal(canSend('COORDENACAO', 'DELETE', '/usuarios/abc'), false);
  assert.equal(canSend('COORDENACAO', 'POST', '/usuarios/importacoes/outra'), false);
});

test('montar a turma: participantes para quem trabalha na turma; vínculos só para a gestão', () => {
  for (const perfil of ['COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR'] as const) {
    assert.equal(canSend(perfil, 'GET', '/turmas/abc/participantes'), true);
  }
  assert.equal(canSend('ALUNO', 'GET', '/turmas/abc/participantes'), false);
  assert.equal(canSend('COORDENACAO', 'POST', '/turmas/abc/participantes'), false);
  // Matrícula: coordenação e secretaria. Docente e tutor: só a coordenação.
  assert.equal(canSend('COORDENACAO', 'DELETE', '/matriculas/abc'), true);
  assert.equal(canSend('SECRETARIA', 'DELETE', '/matriculas/abc'), true);
  for (const perfil of ['ALUNO', 'PROFESSOR', 'TUTOR'] as const) assert.equal(canSend(perfil, 'DELETE', '/matriculas/abc'), false);
  for (const path of ['/lotacoes/disc/prof', '/tutorias/mat/tutor']) {
    assert.equal(canSend('COORDENACAO', 'DELETE', path), true);
    for (const perfil of ['SECRETARIA', 'ALUNO', 'PROFESSOR', 'TUTOR'] as const) assert.equal(canSend(perfil, 'DELETE', path), false);
  }
  // Faltando um dos identificadores, a rota não existe.
  assert.equal(canSend('COORDENACAO', 'DELETE', '/lotacoes/disc'), false);
  assert.equal(canSend('COORDENACAO', 'GET', '/lotacoes/disc/prof'), false);
});
