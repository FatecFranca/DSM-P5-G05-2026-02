import { useEffect, useState } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Panel, StateMessage } from '../../components/UI';
import type { AcademicSnapshot } from '../../services/contracts';

interface EventItem { id: string; tipo: string; titulo: string; data: string; disciplina: string }
interface FeedPage { itens: EventItem[]; pagina: number; temMais: boolean; limiteAtingido: boolean }
interface Props { kind: 'calendario' | 'avisos'; turmaId: string; subjects: AcademicSnapshot['disciplinas'] }
const labels: Record<string, string> = { AULA: 'Aula', AVALIACAO: 'Avaliação', ENTREGA: 'Prazo de entrega', MATERIAL: 'Material disponível', ATIVIDADE: 'Atividade publicada', NOTAS: 'Notas publicadas', CORRECAO: 'Correção disponível' };

export function AcademicFeed({ kind, turmaId, subjects }: Props) {
  const { request } = useSession();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<FeedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setResult(null);
    const params = new URLSearchParams({ pagina: String(page), tamanho: '20', turmaId });
    if (subject) params.set('disciplinaId', subject);
    if (kind === 'calendario') {
      params.set('inicio', month.toISOString());
      params.set('fim', new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString());
    }
    void request<FeedPage>(`/academico/${kind}?${params}`).then((value) => { if (active) setResult(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os eventos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, month, page, request, revision, subject, turmaId]);

  return <>
    <Panel title={kind === 'calendario' ? 'Calendário acadêmico' : 'Avisos acadêmicos'}><div className="panel-body"><p>{kind === 'calendario' ? 'Aulas, avaliações e prazos da turma.' : 'Publicações e correções da turma. Este painel não envia notificações push.'}</p>
      {kind === 'calendario' && <div className="inline-actions"><button type="button" className="secondary-button" disabled={loading} onClick={() => { setPage(1); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}>Mês anterior</button><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><button type="button" className="secondary-button" disabled={loading} onClick={() => { setPage(1); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}>Próximo mês</button></div>}
      <div className="inline-actions"><label>Disciplina<select value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1); }}><option value="">Todas</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><button type="button" className="text-button" onClick={() => setRevision((value) => value + 1)}>Atualizar</button></div>
    </div></Panel>
    <StateMessage loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {!loading && !error && (result?.itens.length ? <Panel title={`Eventos · página ${result.pagina}`}><div className="rows">{result.itens.map((item) => <div className="plain-row" key={item.id}><span className="date-tile"><strong>{new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit' })}</strong><small>{new Date(item.data).toLocaleDateString('pt-BR', { month: 'short' })}</small></span><span className="row-copy"><strong>{item.titulo}</strong><small>{labels[item.tipo] ?? item.tipo} · {item.disciplina} · {new Date(item.data).toLocaleString('pt-BR')}</small></span></div>)}</div></Panel> : <Empty title="Nenhum evento" detail="Não há registros para os filtros selecionados." />)}
    {result?.limiteAtingido && <p className="state-message" role="status">Limite de páginas atingido. Filtre por disciplina para restringir a consulta.</p>}
    {(page > 1 || result?.temMais) && <div className="inline-actions feed-pagination"><button type="button" className="secondary-button" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Página anterior</button><span>Página {page}</span><button type="button" className="secondary-button" disabled={loading || !result?.temMais} onClick={() => setPage((value) => value + 1)}>Próxima página</button></div>}
  </>;
}
