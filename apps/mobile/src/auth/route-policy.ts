import type { Perfil } from '../services/api.ts';

/**
 * Mensagens: estudante e docente conversam; a tutoria só lê canais; docente é quem publica.
 * Segue as mesmas regras do backend (messages.policy.ts), que é quem de fato decide.
 */
function canSendMessage(perfil: Perfil, method: string, route: string): boolean {
  const chat = perfil === 'ALUNO' || perfil === 'PROFESSOR';
  const channels = chat || perfil === 'TUTOR';
  if (route === '/mensagens/resumo' || route === '/mensagens/canais') return method === 'GET' && channels;
  if (/^\/mensagens\/canais\/[^/]+\/publicacoes$/.test(route)) return (method === 'GET' && channels) || (method === 'POST' && perfil === 'PROFESSOR');
  if (/^\/mensagens\/canais\/[^/]+\/leitura$/.test(route)) return method === 'PUT' && channels;
  if (/^\/mensagens\/publicacoes\/[\w-]+$/.test(route)) return method === 'GET' && channels;
  if (/^\/mensagens\/publicacoes\/[\w-]+\/respostas$/.test(route)) return method === 'POST' && chat;
  if (route === '/mensagens/contatos') return method === 'GET' && chat;
  if (route === '/mensagens/conversas') return chat && ['GET', 'POST'].includes(method);
  if (/^\/mensagens\/conversas\/[\w-]+$/.test(route)) return chat && method === 'GET';
  if (/^\/mensagens\/conversas\/[\w-]+\/mensagens$/.test(route)) return chat && ['GET', 'POST'].includes(method);
  if (/^\/mensagens\/conversas\/[\w-]+\/leitura$/.test(route)) return chat && method === 'PUT';
  if (route === '/mensagens/curtidas') return chat && method === 'POST';
  return false;
}

// UX filtering only. Every operation is authenticated and authorized again by the API.
export function canSend(perfil: Perfil, method: string, path: string): boolean {
  const route = path.split('?')[0];
  if (route === '/auth/trocar-senha') return method === 'POST';
  if (route === '/academico/avisos/leitura') return perfil !== 'SECRETARIA' && ['GET', 'PUT'].includes(method);
  if (route.startsWith('/mensagens/')) return canSendMessage(perfil, method, route);
  // Gestão de contas: coordenação (qualquer pessoa) e secretaria (estudantes; o servidor confere).
  const manager = perfil === 'COORDENACAO' || perfil === 'SECRETARIA';
  if (route === '/usuarios/importacoes/modelo') return method === 'GET' && manager;
  if (route === '/usuarios/importacoes') return method === 'POST' && manager;
  if (/^\/usuarios\/[\w-]+$/.test(route) && method === 'PATCH') return manager;
  if (/^\/usuarios\/[\w-]+\/redefinir-senha$/.test(route)) return method === 'POST' && manager;
  if (route.startsWith('/ml/')) {
    if (route === '/ml/fontes/importacoes/semestres/modelo') return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (route === '/ml/fontes/importacoes/semestres') return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && method === 'POST';
    if (route === '/ml/fontes/importacoes/macro/modelo') return perfil === 'COORDENACAO' && method === 'GET';
    if (route === '/ml/fontes/importacoes/macro') return perfil === 'COORDENACAO' && method === 'POST';
    if (route === '/ml/ingressos/pendentes') return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (route === '/ml/ingressos/matriculas') return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (/^\/ml\/matriculas\/[\w-]+\/autodeclaracao$/.test(route)) return perfil === 'ALUNO' && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/declaracao-ingresso$/.test(route)) return perfil === 'ALUNO' && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/ingresso$/.test(route)) return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/semestres\/[12]$/.test(route)) return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/coorte-macro$/.test(route)) return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/fontes\/macro\/[A-Z]{2}\/\d{4}$/.test(route)) return (method === 'GET' && ['COORDENACAO', 'SECRETARIA'].includes(perfil)) || (method === 'PUT' && perfil === 'COORDENACAO');
    if (route === '/ml/importacoes/modelo') return perfil === 'COORDENACAO' && method === 'GET';
    if (route === '/ml/importacoes') return perfil === 'COORDENACAO' && ['GET', 'POST'].includes(method);
    if (route === '/ml/previsoes-automaticas') return perfil === 'COORDENACAO' && method === 'GET';
    const editor = perfil === 'COORDENACAO';
    const reader = editor || perfil === 'PROFESSOR' || perfil === 'TUTOR';
    if (/^\/ml\/matriculas\/[\w-]+$/.test(route)) return (method === 'GET' && reader) || (method === 'PUT' && editor);
    if (/^\/ml\/matriculas\/[\w-]+\/demonstracao$/.test(route)) return method === 'GET' && reader;
    if (/^\/ml\/matriculas\/[\w-]+\/analisar$/.test(route)) return method === 'POST' && reader;
    if (route === '/ml/schema') return method === 'GET' && (editor || perfil === 'SECRETARIA');
    return perfil === 'COORDENACAO' && ((method === 'GET' && route === '/ml/status') || (method === 'POST' && route === '/ml/preview'));
  }
  if (route === '/faturas/matriculas') return method === 'GET' && ['COORDENACAO', 'SECRETARIA'].includes(perfil);
  if (/^\/faturas\/matriculas\/[\w-]+\/semestres$/.test(route)) return method === 'GET' && ['COORDENACAO', 'SECRETARIA', 'ALUNO'].includes(perfil);
  if (/^\/faturas\/[\w-]+\/simular-pagamento$/.test(route)) return method === 'POST' && perfil === 'ALUNO';
  if (/^\/turmas\/[\w-]+\/duracao$/.test(route)) return method === 'PUT' && perfil === 'COORDENACAO';
  // Montar a turma: quem vê os participantes, e quem vincula ou desvincula (o servidor decide de fato).
  if (/^\/turmas\/[\w-]+\/participantes$/.test(route)) return method === 'GET' && perfil !== 'ALUNO';
  if (/^\/matriculas\/[\w-]+$/.test(route)) return method === 'DELETE' && manager;
  if (/^\/(lotacoes|tutorias)\/[\w-]+\/[\w-]+$/.test(route)) return method === 'DELETE' && perfil === 'COORDENACAO';
  if (/^\/faturas\/matriculas\/[\w-]+\/plano$/.test(route)) return ['COORDENACAO', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
  if (/^\/faturas\/matriculas\/[\w-]+$/.test(route)) return method === 'GET' && ['COORDENACAO', 'SECRETARIA', 'ALUNO'].includes(perfil);
  if (/^\/faturas\/[\w-]+\/pagamentos$/.test(route)) return method === 'POST' && ['COORDENACAO', 'SECRETARIA'].includes(perfil);
  if (route === '/faturas') return method === 'POST' && ['COORDENACAO', 'SECRETARIA'].includes(perfil);
  if (/^\/bolsas\/matriculas\/[\w-]+$/.test(route)) return ['COORDENACAO', 'SECRETARIA', 'ALUNO'].includes(perfil) && (method === 'GET' || (method === 'PUT' && perfil !== 'ALUNO'));
  if (method === 'GET') return (perfil !== 'SECRETARIA' || ['/turmas', '/usuarios'].includes(route) || /^\/usuarios\/[\w-]+$/.test(route)) && (['/academico/resumo', '/academico/calendario', '/academico/avisos', '/turmas', '/usuarios'].includes(route) || /^\/usuarios\/[\w-]+$/.test(route) || /^\/arquivos\/[\w-]+$/.test(route));
  if (perfil === 'COORDENACAO') return (method === 'POST' && ['/usuarios', '/turmas', '/disciplinas', '/matriculas', '/lotacoes', '/tutorias'].includes(route)) || (method === 'PATCH' && /^\/turmas\/[\w-]+\/fechamento$/.test(route));
  if (perfil === 'SECRETARIA') return method === 'POST' && ['/usuarios', '/matriculas'].includes(route);
  if (perfil === 'PROFESSOR') return (method === 'POST' && (['/aulas', '/avaliacoes', '/atividades', '/materiais', '/arquivos'].includes(route) || /^\/(avaliacoes|atividades)\/[\w-]+\/publicar$/.test(route))) || (method === 'PUT' && (/^\/aulas\/[\w-]+\/frequencia$/.test(route) || /^\/avaliacoes\/[\w-]+\/notas$/.test(route) || /^\/atividades\/[\w-]+\/entregas\/[\w-]+\/correcao$/.test(route)));
  return perfil === 'ALUNO' && ((method === 'POST' && route === '/arquivos') || (method === 'PUT' && /^\/atividades\/[\w-]+\/entrega$/.test(route)));
}
