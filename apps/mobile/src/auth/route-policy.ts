import type { Perfil } from '../services/api.ts';

// UX filtering only. Every operation is authenticated and authorized again by the API.
export function canSend(perfil: Perfil, method: string, path: string): boolean {
  const route = path.split('?')[0];
  if (route.startsWith('/ml/')) {
    if (route === '/ml/fontes/importacoes/semestres/modelo') return ['ADMIN', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (route === '/ml/fontes/importacoes/semestres') return ['ADMIN', 'SECRETARIA'].includes(perfil) && method === 'POST';
    if (route === '/ml/fontes/importacoes/macro/modelo') return perfil === 'ADMIN' && method === 'GET';
    if (route === '/ml/fontes/importacoes/macro') return perfil === 'ADMIN' && method === 'POST';
    if (route === '/ml/ingressos/pendentes') return ['ADMIN', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (route === '/ml/ingressos/matriculas') return ['ADMIN', 'SECRETARIA'].includes(perfil) && method === 'GET';
    if (/^\/ml\/matriculas\/[\w-]+\/autodeclaracao$/.test(route)) return perfil === 'ALUNO' && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/declaracao-ingresso$/.test(route)) return perfil === 'ALUNO' && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/ingresso$/.test(route)) return ['ADMIN', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/semestres\/[12]$/.test(route)) return ['ADMIN', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/matriculas\/[\w-]+\/coorte-macro$/.test(route)) return ['ADMIN', 'SECRETARIA'].includes(perfil) && ['GET', 'PUT'].includes(method);
    if (/^\/ml\/fontes\/macro\/[A-Z]{2}\/\d{4}$/.test(route)) return (method === 'GET' && ['ADMIN', 'SECRETARIA'].includes(perfil)) || (method === 'PUT' && perfil === 'ADMIN');
    if (route === '/ml/importacoes/modelo') return perfil === 'ADMIN' && method === 'GET';
    if (route === '/ml/importacoes') return perfil === 'ADMIN' && ['GET', 'POST'].includes(method);
    if (route === '/ml/previsoes-automaticas') return perfil === 'ADMIN' && method === 'GET';
    const editor = perfil === 'ADMIN' || perfil === 'COORDENACAO';
    const reader = editor || perfil === 'PROFESSOR' || perfil === 'TUTOR';
    if (/^\/ml\/matriculas\/[\w-]+$/.test(route)) return (method === 'GET' && reader) || (method === 'PUT' && editor);
    if (/^\/ml\/matriculas\/[\w-]+\/demonstracao$/.test(route)) return method === 'GET' && reader;
    if (/^\/ml\/matriculas\/[\w-]+\/analisar$/.test(route)) return method === 'POST' && reader;
    if (route === '/ml/schema') return method === 'GET' && (editor || perfil === 'SECRETARIA');
    return perfil === 'ADMIN' && ((method === 'GET' && route === '/ml/status') || (method === 'POST' && route === '/ml/preview'));
  }
  if (route === '/faturas/matriculas') return method === 'GET' && ['ADMIN', 'FINANCEIRO'].includes(perfil);
  if (/^\/faturas\/matriculas\/[\w-]+\/semestres$/.test(route)) return method === 'GET' && ['ADMIN', 'FINANCEIRO', 'ALUNO'].includes(perfil);
  if (/^\/faturas\/[\w-]+\/simular-pagamento$/.test(route)) return method === 'POST' && perfil === 'ALUNO';
  if (/^\/turmas\/[\w-]+\/duracao$/.test(route)) return method === 'PUT' && perfil === 'ADMIN';
  if (/^\/faturas\/matriculas\/[\w-]+\/plano$/.test(route)) return ['ADMIN', 'FINANCEIRO'].includes(perfil) && ['GET', 'PUT'].includes(method);
  if (/^\/faturas\/matriculas\/[\w-]+$/.test(route)) return method === 'GET' && ['ADMIN', 'FINANCEIRO', 'ALUNO'].includes(perfil);
  if (/^\/faturas\/[\w-]+\/pagamentos$/.test(route)) return method === 'POST' && ['ADMIN', 'FINANCEIRO'].includes(perfil);
  if (route === '/faturas') return method === 'POST' && ['ADMIN', 'FINANCEIRO'].includes(perfil);
  if (/^\/bolsas\/matriculas\/[\w-]+$/.test(route)) return ['ADMIN', 'FINANCEIRO', 'ALUNO'].includes(perfil) && (method === 'GET' || (method === 'PUT' && perfil !== 'ALUNO'));
  if (method === 'GET') return perfil !== 'FINANCEIRO' && (['/academico/resumo', '/academico/calendario', '/academico/avisos', '/turmas', '/usuarios'].includes(route) || /^\/usuarios\/[\w-]+$/.test(route) || /^\/arquivos\/[\w-]+$/.test(route));
  if (perfil === 'ADMIN') return (method === 'POST' && ['/usuarios', '/turmas', '/disciplinas', '/matriculas', '/lotacoes', '/tutorias'].includes(route)) || (method === 'PATCH' && /^\/turmas\/[\w-]+\/fechamento$/.test(route));
  if (perfil === 'SECRETARIA') return method === 'POST' && ['/usuarios', '/matriculas'].includes(route);
  if (perfil === 'PROFESSOR') return (method === 'POST' && (['/aulas', '/avaliacoes', '/atividades', '/materiais', '/arquivos'].includes(route) || /^\/(avaliacoes|atividades)\/[\w-]+\/publicar$/.test(route))) || (method === 'PUT' && (/^\/aulas\/[\w-]+\/frequencia$/.test(route) || /^\/avaliacoes\/[\w-]+\/notas$/.test(route) || /^\/atividades\/[\w-]+\/entregas\/[\w-]+\/correcao$/.test(route)));
  return perfil === 'ALUNO' && ((method === 'POST' && route === '/arquivos') || (method === 'PUT' && /^\/atividades\/[\w-]+\/entrega$/.test(route)));
}
