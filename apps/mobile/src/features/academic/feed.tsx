import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';

interface EventItem { id: string; tipo: string; titulo: string; data: string; disciplina: string }
interface FeedPage { itens: EventItem[]; pagina: number; temMais: boolean; limiteAtingido: boolean }
const labels: Record<string, string> = { AULA: 'Aula', AVALIACAO: 'Avaliação', ENTREGA: 'Prazo de entrega', MATERIAL: 'Material disponível', ATIVIDADE: 'Atividade publicada', NOTAS: 'Notas publicadas', CORRECAO: 'Correção disponível' };

export function AcademicFeed({ kind, turmaId, subjects }: { kind: 'calendario' | 'avisos'; turmaId: string | null; subjects: { id: string; nome: string }[] }) {
  const { request } = useSession();
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<FeedPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    const params = new URLSearchParams({ pagina: String(page), tamanho: '20' });
    if (turmaId) params.set('turmaId', turmaId);
    if (subject) params.set('disciplinaId', subject);
    if (kind === 'calendario') {
      params.set('inicio', month.toISOString());
      params.set('fim', new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString());
    }
    return request<FeedPage>(`/academico/${kind}?${params}`);
  }, [kind, month, page, request, subject, turmaId]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setBusy(true); setError(''); setResult(null);
      try { const data = await load(); if (active) setResult(data); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar.'); }
      finally { if (active) setBusy(false); }
    });
    return () => { active = false; };
  }, [load, revision]);
  function changeMonth(offset: number) { setResult(null); setBusy(true); setPage(1); setMonth((m) => new Date(m.getFullYear(), m.getMonth() + offset, 1)); }
  return <View style={academicStyles.stack}>
    <Panel><PanelTitle>{kind === 'calendario' ? 'Calendário acadêmico' : 'Avisos acadêmicos'}</PanelTitle>
      <BodyText>{kind === 'calendario' ? 'Aulas, avaliações e prazos das disciplinas disponíveis para você.' : 'Publicações e correções disponíveis para seus vínculos. Este painel não envia notificações push.'}</BodyText>
      {kind === 'calendario' && <><PanelTitle>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</PanelTitle><View style={academicStyles.chips}><ActionButton title="Mês anterior" disabled={busy} onPress={() => changeMonth(-1)} /><ActionButton title="Próximo mês" disabled={busy} onPress={() => changeMonth(1)} /></View></>}
      <View style={academicStyles.chips}><Chip label="Todas as disciplinas" selected={!subject} onPress={() => { setSubject(''); setPage(1); setResult(null); }} />{subjects.map((s) => <Chip key={s.id} label={s.nome} selected={subject === s.id} onPress={() => { setSubject(s.id); setPage(1); setResult(null); }} />)}</View>
      <ActionButton title={busy ? 'Carregando…' : 'Atualizar lista'} disabled={busy} secondary onPress={() => { setPage(1); setRevision((r) => r + 1); }} />
    </Panel>
    {!!error && <Feedback error message={error} />}
    {result?.itens.map((item) => <Panel key={item.id}><BodyText>{labels[item.tipo] ?? item.tipo}</BodyText><PanelTitle>{item.titulo}</PanelTitle><BodyText>{item.disciplina} · {new Date(item.data).toLocaleString('pt-BR')}</BodyText></Panel>)}
    {result && !result.itens.length && <BodyText>Nenhum registro disponível para os filtros selecionados.</BodyText>}
    {result?.limiteAtingido && <Feedback error message="Limite de páginas atingido. Filtre por disciplina para restringir a consulta." />}
    {result && (page > 1 || result.temMais) && <View style={academicStyles.chips}><ActionButton title="Página anterior" disabled={busy || page === 1} onPress={() => { setResult(null); setPage((p) => p - 1); }} /><BodyText>Página {page}</BodyText><ActionButton title="Próxima página" disabled={busy || !result.temMais} onPress={() => { setResult(null); setPage((p) => p + 1); }} /></View>}
  </View>;
}
