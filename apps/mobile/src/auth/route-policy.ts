import type { Perfil } from '../services/api.ts';

// UX filtering only. Every operation is authenticated and authorized again by the API.
export function canSend(perfil: Perfil, method: string, path: string): boolean {
  const route = path.split('?')[0];
  if (route.startsWith('/ml/')) {
    const editor = perfil === 'ADMIN' || perfil === 'COORDENACAO';
    const reader = editor || perfil === 'PROFESSOR' || perfil === 'TUTOR';
    if (/^\/ml\/matriculas\/[\w-]+$/.test(route)) return (method === 'GET' && reader) || (method === 'PUT' && editor);
    if (/^\/ml\/matriculas\/[\w-]+\/analisar$/.test(route)) return method === 'POST' && reader;
    if (route === '/ml/schema') return method === 'GET' && editor;
    return perfil === 'ADMIN' && ((method === 'GET' && route === '/ml/status') || (method === 'POST' && route === '/ml/preview'));
  }
  if (method === 'GET') return ['/academico/resumo', '/academico/calendario', '/academico/avisos', '/turmas'].includes(route) || /^\/arquivos\/[\w-]+$/.test(route) || (perfil === 'ADMIN' && route === '/usuarios');
  if (perfil === 'ADMIN') return (method === 'POST' && ['/usuarios', '/turmas', '/disciplinas', '/matriculas', '/lotacoes', '/tutorias'].includes(route)) || (method === 'PATCH' && /^\/turmas\/[\w-]+\/fechamento$/.test(route));
  if (perfil === 'PROFESSOR') return (method === 'POST' && (['/aulas', '/avaliacoes', '/atividades', '/materiais', '/arquivos'].includes(route) || /^\/(avaliacoes|atividades)\/[\w-]+\/publicar$/.test(route))) || (method === 'PUT' && (/^\/aulas\/[\w-]+\/frequencia$/.test(route) || /^\/avaliacoes\/[\w-]+\/notas$/.test(route) || /^\/atividades\/[\w-]+\/entregas\/[\w-]+\/correcao$/.test(route)));
  return perfil === 'ALUNO' && ((method === 'POST' && route === '/arquivos') || (method === 'PUT' && /^\/atividades\/[\w-]+\/entrega$/.test(route)));
}
