import { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles, formatAcademicNumber } from '@/demo/academic-ui';
import type { AcademicFile, AcademicSnapshot, AttendanceStatus } from '@/services/academic';
import type { UserSummary } from '@/services/api';
import { Editor, type EditorConfig, type Field } from './editor';
import { chooseFile, saveFile } from './files';
import { AcademicFeed } from './feed';
import { MlEnrollments } from './ml-enrollment';
import { canReadMl } from '@/services/ml';

const text = (key: string, label: string): Field => ({ key, label });
const number = (key: string, label: string, initial = '10'): Field => ({ key, label, type: 'number', initial });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', initial: new Date().toISOString().slice(0, 10) });
const numeric = (value: string) => Number(value.replace(',', '.'));
const sections = ['Resumo', 'Estrutura', 'Frequência', 'Notas', 'Atividades', 'Materiais', 'Calendário', 'Avisos', 'ML'] as const;
type Section = typeof sections[number];

export default function Workspace() {
  const { state, request } = useSession();
  const [snapshot, setSnapshot] = useState<AcademicSnapshot | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<string>();
  const [section, setSection] = useState<Section>('Resumo');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const sequence = useRef(0);
  const role = state.status === 'signedIn' ? state.user.perfil : null;
  const real = state.status === 'signedIn' && state.mode === 'api';
  const load = useCallback(async () => {
    if (!real) return;
    const seq = ++sequence.current;
    setBusy(true); setError('');
    setNow(Date.now());
    try {
      const [data, people] = await Promise.all([
        request<AcademicSnapshot>(`/academico/resumo${selected ? `?turmaId=${encodeURIComponent(selected)}` : ''}`),
        role === 'ADMIN' ? request<UserSummary[]>('/usuarios') : Promise.resolve([]),
      ]);
      if (seq === sequence.current) { setSnapshot(data); setUsers(people); }
    } catch (cause) { if (seq === sequence.current) { setSnapshot(null); setError(cause instanceof Error ? cause.message : 'Falha ao carregar.'); } }
    finally { if (seq === sequence.current) setBusy(false); }
  }, [real, request, role, selected]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; sequence.current += 1; }; }, [load]);
  if (!real) return <Redirect href="/home" />;
  const turma = snapshot?.turmas.find((t) => t.id === snapshot.turmaId);
  const teacher = role === 'PROFESSOR' && !turma?.fechada;
  const subjectOptions = (snapshot?.disciplinas ?? []).map((s) => ({ id: s.id, label: s.nome }));
  const subject: Field = { key: 'disciplinaId', label: 'Disciplina', options: subjectOptions };
  const enrollmentOptions = (snapshot?.matriculas ?? []).map((m) => ({ id: m.id, label: `${m.aluno.nome} · ${m.registro}` }));
  const person = (perfil: UserSummary['perfil'], key: string): Field => ({ key, label: perfil === 'ALUNO' ? 'Aluno' : perfil === 'TUTOR' ? 'Tutor' : 'Professor', options: users.filter((u) => u.perfil === perfil && u.ativo).map((u) => ({ id: u.id, label: u.nome })) });
  const subjectName = (id: string) => snapshot?.disciplinas.find((s) => s.id === id)?.nome ?? 'Disciplina';
  const studentName = (id: string) => snapshot?.matriculas.find((m) => m.id === id)?.aluno.nome ?? 'Aluno';
  const open = (title: string, fields: Field[], path: string, body: (values: Record<string, string>) => object, method: 'POST' | 'PUT' | 'PATCH' = 'POST') => {
    setEditor({ title, fields, submit: async (values) => {
      await request(path, { method, body: body(values) }); setNotice('Alteração salva.'); await load();
    } });
  };
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); } finally { setBusy(false); }
  }
  async function upload() {
    const form = await chooseFile();
    return form ? request<AcademicFile>('/arquivos', { method: 'POST', body: form }) : null;
  }
  const download = (file: AcademicFile) => void run(async () => saveFile(file, await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true })));
  const visibleSections = sections.filter((s) => (s !== 'Estrutura' || role === 'ADMIN') && (s !== 'ML' || canReadMl(role)) && (s !== 'Materiais' || role !== 'TUTOR'));
  const slice = <T,>(items: T[]) => items.slice(page * 20, (page + 1) * 20);
  const rows = snapshot ? section === 'Frequência' ? snapshot.aulas.length : section === 'Notas' ? snapshot.avaliacoes.length : section === 'Atividades' ? snapshot.atividades.length : section === 'Materiais' ? snapshot.materiais.length : snapshot.matriculas.length : 0;
  return <Screen>
    <AcademicHeader title="Área acadêmica" subtitle={`${role} · ${turma ? `${turma.nome} / ${turma.periodo}` : 'Selecione ou cadastre uma turma'}`} />
    <View style={academicStyles.chips}>{visibleSections.map((s) => <Chip key={s} label={s} selected={section === s} onPress={() => { setSection(s); setPage(0); setEditor(null); }} />)}</View>
    <ActionButton title={busy ? 'Carregando…' : 'Atualizar'} disabled={busy} secondary onPress={() => void load()} />
    {!!error && <Feedback error message={error} />}{!!notice && <Feedback message={notice} />}
    {snapshot && <>
      <View style={academicStyles.chips}>{snapshot.turmas.map((t) => <Chip key={t.id} label={`${t.nome} · ${t.periodo}`} selected={snapshot.turmaId === t.id} onPress={() => { setSelected(t.id); setSnapshot(null); setEditor(null); setPage(0); }} />)}</View>
      {snapshot.truncated && <Feedback error message="Limite de consulta atingido. A lista está incompleta; indicadores foram suspensos." />}
      {turma?.fechada && <BodyText>Período fechado para alterações acadêmicas.</BodyText>}
      {editor ? <Editor key={editor.title} config={editor} close={() => setEditor(null)} /> : <>
      {section === 'Estrutura' && <Panel><PanelTitle>Administração</PanelTitle>
        <ActionButton title="Criar turma" onPress={() => open('Criar turma', [text('nome', 'Nome'), text('curso', 'Curso'), text('periodo', 'Período')], '/turmas', (v) => v)} />
        <ActionButton title="Criar usuário" onPress={() => open('Criar usuário', [text('nome', 'Nome'), text('email', 'E-mail'), { key: 'senha', label: 'Senha (mínimo 12 caracteres)', type: 'password' }, { key: 'perfil', label: 'Perfil', options: ['ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR', 'ALUNO'].map((p) => ({ id: p, label: p })) }], '/usuarios', (v) => v)} />
        {!!turma && <>
          <ActionButton disabled={turma.fechada} title="Adicionar disciplina" onPress={() => open('Adicionar disciplina', [text('nome', 'Nome')], '/disciplinas', (v) => ({ ...v, turmaId: turma.id }))} />
          <ActionButton disabled={turma.fechada} title="Matricular aluno" onPress={() => open('Matricular aluno', [person('ALUNO', 'alunoId'), text('registro', 'Registro da matrícula')], '/matriculas', (v) => ({ ...v, turmaId: turma.id }))} />
          <ActionButton disabled={turma.fechada} title="Vincular professor" onPress={() => open('Vincular professor', [subject, person('PROFESSOR', 'professorId')], '/lotacoes', (v) => v)} />
          <ActionButton disabled={turma.fechada} title="Vincular tutor" onPress={() => open('Vincular tutor', [{ key: 'matriculaId', label: 'Matrícula', options: enrollmentOptions }, person('TUTOR', 'tutorId')], '/tutorias', (v) => v)} />
          <ActionButton secondary title={turma.fechada ? 'Reabrir período' : 'Fechar período'} onPress={() => open(turma.fechada ? 'Confirmar reabertura' : 'Confirmar fechamento do período', [], `/turmas/${turma.id}/fechamento`, () => ({ fechada: !turma.fechada }), 'PATCH')} />
        </>}
      </Panel>}
      {section === 'Resumo' && <>
        <Panel><PanelTitle>{snapshot.disciplinas.length} disciplinas · {snapshot.matriculas.length} matrículas</PanelTitle><BodyText>{snapshot.disciplinas.map((s) => s.nome).join(' · ') || 'Nenhuma disciplina disponível.'}</BodyText></Panel>
        {!snapshot.turmas.length && <BodyText>{role === 'ADMIN' ? 'Cadastre a primeira turma em Estrutura.' : 'Você ainda não possui vínculos acadêmicos disponíveis.'}</BodyText>}
        {slice(snapshot.matriculas).map((m) => { const stats = snapshot.indicadores.find((i) => i.matriculaId === m.id); return <Panel key={m.id}><PanelTitle>{m.aluno.nome}</PanelTitle><BodyText>{m.registro}</BodyText><BodyText>Média publicada: {formatAcademicNumber(stats?.media ?? null)} / 10 · Frequência: {formatAcademicNumber(stats?.frequencia ?? null)}%</BodyText></Panel>; })}
      </>}
      {section === 'Frequência' && <>
        {teacher && <ActionButton title="Registrar aula" onPress={() => open('Registrar aula', [subject, date('data', 'Data'), text('tema', 'Tema')], '/aulas', (v) => ({ ...v, data: new Date(v.data).toISOString() }))} />}
        {slice(snapshot.aulas).map((a) => <Panel key={a.id}><PanelTitle>{a.tema}</PanelTitle><BodyText>{subjectName(a.disciplinaId)} · {a.data.slice(0, 10)}</BodyText>
          {snapshot.presencas.filter((p) => p.aulaId === a.id).map((p) => <BodyText key={p.matriculaId}>{studentName(p.matriculaId)}: {p.situacao.replaceAll('_', ' ')}</BodyText>)}
          {teacher && <ActionButton title="Lançar frequência" onPress={() => open('Lançar frequência', [{ key: 'matriculaId', label: 'Aluno', options: enrollmentOptions }, { key: 'situacao', label: 'Situação', options: ['PRESENTE', 'FALTA', 'FALTA_JUSTIFICADA'].map((s) => ({ id: s, label: s.replaceAll('_', ' ') })) }], `/aulas/${a.id}/frequencia`, (v) => ({ itens: [{ matriculaId: v.matriculaId, situacao: v.situacao as AttendanceStatus }] }), 'PUT')} />}
        </Panel>)}
      </>}
      {section === 'Notas' && <>
        {teacher && <ActionButton title="Criar avaliação" onPress={() => open('Criar avaliação', [subject, text('titulo', 'Título'), number('peso', 'Peso', '1'), number('notaMaxima', 'Nota máxima'), date('data', 'Data')], '/avaliacoes', (v) => ({ ...v, peso: numeric(v.peso), notaMaxima: numeric(v.notaMaxima), data: new Date(v.data).toISOString() }))} />}
        {slice(snapshot.avaliacoes).map((a) => <Panel key={a.id}><PanelTitle>{a.titulo}</PanelTitle><BodyText>{subjectName(a.disciplinaId)} · Máximo {a.notaMaxima} · Peso {a.peso} · {a.publicada ? 'Publicada' : 'Rascunho'}</BodyText>
          {snapshot.notas.filter((n) => n.avaliacaoId === a.id).map((n) => <BodyText key={n.matriculaId}>{studentName(n.matriculaId)}: {n.valor}</BodyText>)}
          {teacher && <><ActionButton title="Lançar nota" onPress={() => open('Lançar nota', [{ key: 'matriculaId', label: 'Aluno', options: enrollmentOptions }, number('valor', `Nota (0 a ${a.notaMaxima})`, '0')], `/avaliacoes/${a.id}/notas`, (v) => ({ itens: [{ matriculaId: v.matriculaId, valor: numeric(v.valor) }] }), 'PUT')} />
          {!a.publicada && <ActionButton secondary disabled={busy} title="Publicar notas" onPress={() => void run(() => request(`/avaliacoes/${a.id}/publicar`, { method: 'POST' }))} />}</>}
        </Panel>)}
      </>}
      {section === 'Atividades' && <>
        {teacher && <ActionButton title="Criar atividade" onPress={() => open('Criar atividade', [subject, text('titulo', 'Título'), text('descricao', 'Descrição'), date('prazo', 'Prazo futuro (AAAA-MM-DD)'), number('notaMaxima', 'Nota máxima')], '/atividades', (v) => ({ ...v, prazo: new Date(`${v.prazo}T23:59:59`).toISOString(), notaMaxima: numeric(v.notaMaxima), estado: 'RASCUNHO' }))} />}
        {slice(snapshot.atividades).map((a) => <Panel key={a.id}><PanelTitle>{a.titulo}</PanelTitle><BodyText>{subjectName(a.disciplinaId)} · {a.estado} · Prazo {new Date(a.prazo).toLocaleString('pt-BR')}</BodyText><BodyText>{a.descricao}</BodyText>
          {teacher && a.estado === 'RASCUNHO' && <ActionButton title="Publicar atividade" disabled={busy} onPress={() => void run(() => request(`/atividades/${a.id}/publicar`, { method: 'POST' }))} />}
          {role === 'ALUNO' && a.estado === 'PUBLICADA' && !turma?.fechada && new Date(a.prazo).getTime() > now && !snapshot.entregas.some((e) => e.atividadeId === a.id && e.corrigidaEm) && <ActionButton title="Enviar ou substituir entrega" disabled={busy} onPress={() => void run(async () => { const file = await upload(); if (file) await request(`/atividades/${a.id}/entrega`, { method: 'PUT', body: { arquivoId: file.id } }); })} />}
          {snapshot.entregas.filter((e) => e.atividadeId === a.id).map((e) => <View style={academicStyles.stack} key={e.matriculaId}><BodyText>{studentName(e.matriculaId)} · {e.arquivo.nome} · Nota: {e.nota ?? 'Aguardando correção'}</BodyText>{!!e.feedback && <BodyText>{e.feedback}</BodyText>}
            <ActionButton secondary title="Baixar entrega" disabled={busy} onPress={() => download(e.arquivo)} />
            {teacher && <ActionButton title="Corrigir entrega" onPress={() => open('Corrigir entrega', [number('nota', `Nota (0 a ${a.notaMaxima})`, String(e.nota ?? 0)), { key: 'feedback', label: 'Feedback', optional: true, initial: e.feedback ?? '' }], `/atividades/${a.id}/entregas/${e.matriculaId}/correcao`, (v) => ({ nota: numeric(v.nota), feedback: v.feedback }), 'PUT')} />}
          </View>)}
        </Panel>)}
      </>}
      {section === 'Materiais' && <>
        {teacher && <ActionButton title="Publicar material" onPress={() => setEditor({ title: 'Publicar material', fields: [subject, text('titulo', 'Título'), { key: 'descricao', label: 'Descrição', optional: true }], submit: async (v) => { const file = await upload(); if (!file) throw new Error('Selecione um arquivo para publicar.'); await request('/materiais', { method: 'POST', body: { ...v, arquivoId: file.id } }); await load(); } })} />}
        {slice(snapshot.materiais).map((m) => <Panel key={m.id}><PanelTitle>{m.titulo}</PanelTitle><BodyText>{subjectName(m.disciplinaId)} · {m.arquivo.nome}</BodyText><BodyText>{m.descricao}</BodyText><ActionButton title="Baixar material" disabled={busy} onPress={() => download(m.arquivo)} /></Panel>)}
      </>}
      {(section === 'Calendário' || section === 'Avisos') && <AcademicFeed key={`${section}:${snapshot.turmaId}`} kind={section === 'Calendário' ? 'calendario' : 'avisos'} turmaId={snapshot.turmaId} subjects={snapshot.disciplinas} />}
      {section === 'ML' && canReadMl(role) && <MlEnrollments key={snapshot.turmaId} matriculas={enrollmentOptions} />}
      {!['Estrutura', 'Calendário', 'Avisos', 'ML'].includes(section) && rows === 0 && <BodyText>Nenhum registro disponível nesta seção.</BodyText>}
      {!['Estrutura', 'Calendário', 'Avisos', 'ML'].includes(section) && rows > 20 && <View style={academicStyles.chips}><ActionButton title="Anterior" disabled={page === 0} onPress={() => setPage((p) => p - 1)} /><BodyText>Página {page + 1}</BodyText><ActionButton title="Próxima" disabled={(page + 1) * 20 >= rows} onPress={() => setPage((p) => p + 1)} /></View>}
      </>}
    </>}
  </Screen>;
}
