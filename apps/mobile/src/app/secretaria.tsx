import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { TopBar } from '@/components/top-bar';
import { ActionButton, BodyText, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { Editor, type EditorConfig } from '@/features/academic/editor';
import type { UserSummary } from '@/services/api';
import { ML_FIELD_LABELS, parsePartialMlFields, type MlSchema } from '@/services/ml';
import { chooseMlWorkbook, saveFile } from '@/features/academic/files';

type Enrollment = { id: string; registro: string; aluno: { nome: string } };
type Pending = { matriculaId: string; revisao: number; atualizadoEm: string; matricula: { registro: string; aluno: { nome: string } } };
type Ingress = {
  official: { revisao: number; fonteRef: string; features: Record<string, number> } | null;
  declaration: { revisao: number; pendente: boolean; dados: Record<string, string | boolean> } | null;
};
type Semester = { revisao: number; creditadas: number; matriculadas: number; avaliacoes: number; aprovadas: number; nota: number; semAvaliacao: number; fonteRef: string } | null;
type Cohort = { macroPais: string | null; macroAno: number | null; macroPendente: boolean };
type MacroSource = { desemprego: number; inflacao: number; pib: number; fonteUrl: string } | null;
type ImportReport = { total: number; salvos: number; repetidos: number; erros: { linha: number; registro: string; motivo: string }[] };

const INGRESS = [
  'estado_civil', 'modo_candidatura', 'ordem_candidatura', 'curso', 'qualif_anterior',
  'nota_qual_anterior', 'nacionalidade', 'qualif_mae', 'qualif_pai', 'ocupacao_mae',
  'ocupacao_pai', 'nota_admissao', 'deslocado', 'necessidades_especiais', 'genero', 'internacional',
] as const;

export default function SecretaryScreen() {
  const { state, request } = useSession();
  const router = useRouter();
  const admin = state.status === 'signedIn' && state.user.perfil === 'COORDENACAO';
  const [pending, setPending] = useState<Pending[]>([]);
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [classes, setClasses] = useState<{ id: string; nome: string; periodo: string }[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<UserSummary[]>([]);
  const [chosenStudent, setChosenStudent] = useState<UserSummary | null>(null);
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [editorScope, setEditorScope] = useState<'cadastro' | 'fonte'>('cadastro');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [ingress, setIngress] = useState<Ingress | null>(null);
  const [reference, setReference] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [sourceReport, setSourceReport] = useState<ImportReport | null>(null);

  async function downloadSourceTemplate(kind: 'semestres' | 'macro') {
    setBusy(true); setError('');
    try {
      const bytes = await request<ArrayBuffer>(`/ml/fontes/importacoes/${kind}/modelo`, { binary: true });
      const name = kind === 'semestres' ? 'modelo-resumos-semestrais.xlsx' : 'modelo-indicadores-macro.xlsx';
      await saveFile({ id: kind, nome: name, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamanho: bytes.byteLength }, bytes);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o modelo.'); }
    finally { setBusy(false); }
  }

  async function importSource(kind: 'semestres' | 'macro') {
    setSourceReport(null); setError(''); setNotice('');
    try {
      const form = await chooseMlWorkbook();
      if (!form) return;
      setBusy(true);
      const result = await request<ImportReport>(`/ml/fontes/importacoes/${kind}`, { method: 'POST', body: form });
      setSourceReport(result);
      setRevision((value) => value + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível importar a fonte.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([request<Pending[]>('/ml/ingressos/pendentes'), request<MlSchema>('/ml/schema')])
      .then(([items, nextSchema]) => { if (active) { setPending(items); setSchema(nextSchema); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a fila de ingresso.'); });
    return () => { active = false; };
  }, [request, revision]);

  useEffect(() => {
    let active = true;
    void request<{ id: string; nome: string; periodo: string }[]>('/turmas')
      .then((items) => { if (active) setClasses(items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as turmas.'); });
    return () => { active = false; };
  }, [request]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void request<Ingress>(`/ml/matriculas/${selected.id}/ingresso`)
      .then((result) => {
        if (!active) return;
        setIngress(result);
        setReference(result.official?.fonteRef ?? '');
        setFields(Object.fromEntries(Object.entries(result.official?.features ?? {}).map(([key, value]) => [key, String(value)])));
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o ingresso.'); });
    return () => { active = false; };
  }, [request, selected, revision]);

  async function search() {
    if (query.trim().length < 2) { setError('Informe ao menos 2 caracteres do registro.'); return; }
    setBusy(true); setError('');
    try {
      setMatches(await request<Enrollment[]>(`/ml/ingressos/matriculas?registro=${encodeURIComponent(query.trim())}`));
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Busca indisponível.'); }
    finally { setBusy(false); }
  }

  async function searchStudents() {
    if (studentSearch.trim().length < 2) { setError('Informe ao menos 2 caracteres do nome ou e-mail do aluno.'); return; }
    setBusy(true); setError('');
    try {
      const results = await request<UserSummary[]>(`/usuarios?perfil=ALUNO&busca=${encodeURIComponent(studentSearch.trim())}`);
      setStudents(results);
      setChosenStudent(null);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível buscar alunos.'); }
    finally { setBusy(false); }
  }

  function openStudent() {
    setEditorScope('cadastro');
    setEditor({ title: 'Criar conta de aluno', fields: [
      { key: 'nome', label: 'Nome completo' }, { key: 'email', label: 'E-mail' },
      { key: 'senha', label: 'Senha inicial (mínimo 12 caracteres)', type: 'password' },
    ], submit: async (values) => {
      const created = await request<UserSummary>('/usuarios', { method: 'POST', body: { nome: values.nome.trim(), email: values.email.trim(), senha: values.senha, perfil: 'ALUNO' } });
      setStudents([created]); setChosenStudent(created);
      setNotice('Conta de aluno criada. Agora registre sua matrícula.');
    } });
  }

  function openEnrollment() {
    if (!chosenStudent) return;
    setEditorScope('cadastro');
    setEditor({ title: `Matricular ${chosenStudent.nome}`, fields: [
      { key: 'turmaId', label: 'Turma', options: classes.map((item) => ({ id: item.id, label: `${item.nome} · ${item.periodo}` })) },
      { key: 'registro', label: 'Registro acadêmico' },
    ], submit: async (values) => {
      await request('/matriculas', { method: 'POST', body: { turmaId: values.turmaId, alunoId: chosenStudent.id, registro: values.registro.trim() } });
      setNotice('Matrícula criada. O aluno já pode enviar sua declaração de ingresso.');
      setChosenStudent(null);
    } });
  }

  async function openSemester(semester: 1 | 2) {
    if (!selected) return;
    setEditorScope('fonte');
    setBusy(true); setError('');
    try {
      const current = await request<Semester>(`/ml/matriculas/${selected.id}/semestres/${semester}`);
      const numeric = (key: keyof NonNullable<Semester>, label: string) => ({ key, label, type: 'number' as const, initial: String(current?.[key] ?? '') });
      setEditor({ title: `Resumo homologado · ${semester}º semestre`, fields: [
        numeric('creditadas', 'Unidades creditadas'), numeric('matriculadas', 'Unidades matriculadas'),
        numeric('avaliacoes', 'Avaliações'), numeric('aprovadas', 'Unidades aprovadas'),
        numeric('nota', 'Média das notas (0–20)'), numeric('semAvaliacao', 'Unidades sem avaliação'),
        { key: 'fonteRef', label: 'Documento ou referência da fonte', initial: current?.fonteRef ?? '' },
      ], submit: async (values) => {
        const payload = {
          versao: current?.revisao ?? 0,
          creditadas: Number(values.creditadas), matriculadas: Number(values.matriculadas),
          avaliacoes: Number(values.avaliacoes), aprovadas: Number(values.aprovadas),
          nota: Number(values.nota.replace(',', '.')), semAvaliacao: Number(values.semAvaliacao),
          fonteRef: values.fonteRef.trim(),
        };
        if (['creditadas', 'matriculadas', 'avaliacoes', 'aprovadas', 'semAvaliacao'].some((key) => !Number.isInteger(payload[key as keyof typeof payload]))) throw new Error('As contagens do semestre devem ser inteiras.');
        await request(`/ml/matriculas/${selected.id}/semestres/${semester}`, { method: 'PUT', body: payload });
        setNotice(`Resumo do ${semester}º semestre homologado; os seis atributos foram atualizados.`);
      } });
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o resumo semestral.'); }
    finally { setBusy(false); }
  }

  async function openCohort() {
    if (!selected) return;
    setEditorScope('fonte');
    setBusy(true); setError('');
    try {
      const current = await request<Cohort>(`/ml/matriculas/${selected.id}/coorte-macro`);
      setEditor({ title: 'País e ano da coorte', fields: [
        { key: 'pais', label: 'País (código ISO de 2 letras)', initial: current.macroPais ?? 'PT' },
        { key: 'ano', label: 'Ano de referência', type: 'number', initial: String(current.macroAno ?? new Date().getFullYear()) },
      ], submit: async (values) => {
        const pais = values.pais.trim().toUpperCase();
        const ano = Number(values.ano);
        if (!/^[A-Z]{2}$/.test(pais) || !Number.isInteger(ano) || ano < 1990 || ano > 2100) throw new Error('Informe país com 2 letras e ano entre 1990 e 2100.');
        const source = await request<MacroSource>(`/ml/fontes/macro/${pais}/${ano}`);
        await request(`/ml/matriculas/${selected.id}/coorte-macro`, { method: 'PUT', body: { pais, ano } });
        setNotice(source ? 'Coorte vinculada; desemprego, inflação e PIB foram reconciliados.' : 'Coorte vinculada. Os indicadores aguardam publicação oficial pela coordenação.');
      } });
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a coorte.'); }
    finally { setBusy(false); }
  }

  async function openMacroSource() {
    if (!selected || !admin) return;
    setEditorScope('fonte');
    setBusy(true); setError('');
    try {
      const cohort = await request<Cohort>(`/ml/matriculas/${selected.id}/coorte-macro`);
      const source = cohort.macroPais && cohort.macroAno
        ? await request<MacroSource>(`/ml/fontes/macro/${cohort.macroPais}/${cohort.macroAno}`) : null;
      setEditor({ title: 'Publicar indicadores macroeconômicos', fields: [
        { key: 'pais', label: 'País (2 letras)', initial: cohort.macroPais ?? 'PT' },
        { key: 'ano', label: 'Ano', type: 'number', initial: String(cohort.macroAno ?? new Date().getFullYear()) },
        { key: 'desemprego', label: 'Desemprego (%)', initial: String(source?.desemprego ?? '') },
        { key: 'inflacao', label: 'Inflação (%)', initial: String(source?.inflacao ?? '') },
        { key: 'pib', label: 'Variação do PIB (%)', initial: String(source?.pib ?? '') },
        { key: 'fonteUrl', label: 'URL HTTPS da fonte oficial', initial: source?.fonteUrl ?? '' },
      ], submit: async (values) => {
        const pais = values.pais.trim().toUpperCase();
        const ano = Number(values.ano);
        if (!/^[A-Z]{2}$/.test(pais) || !Number.isInteger(ano) || ano < 1990 || ano > 2100) throw new Error('País ou ano inválido.');
        const desemprego = Number(values.desemprego.replace(',', '.'));
        const inflacao = Number(values.inflacao.replace(',', '.'));
        const pib = Number(values.pib.replace(',', '.'));
        if (![desemprego, inflacao, pib].every(Number.isFinite)) throw new Error('Informe os três indicadores numéricos.');
        await request(`/ml/fontes/macro/${pais}/${ano}`, { method: 'PUT', body: { desemprego, inflacao, pib, fonteUrl: values.fonteUrl.trim() } });
        setNotice('Fonte publicada; as matrículas da coorte serão reconciliadas automaticamente.');
      } });
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir os indicadores.'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!selected || !ingress || !schema) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const fonteRef = reference.trim();
      if (!fonteRef) throw new Error('Informe o documento ou referência institucional da conferência.');
      const features = parsePartialMlFields(fields, { ...schema, features: [...INGRESS] });
      if (!Object.keys(features).length) throw new Error('Informe pelo menos um atributo de ingresso conferido.');
      await request(`/ml/matriculas/${selected.id}/ingresso`, {
        method: 'PUT', body: { versao: ingress.official?.revisao ?? 0, fonteRef, features },
      });
      setNotice('Dados oficiais salvos; a declaração foi conferida e o perfil atualizado.');
      setRevision((value) => value + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Não foi possível homologar os dados.'); }
    finally { setBusy(false); }
  }

  return <Screen>
    <TopBar />
    <Panel><PanelTitle>Financeiro</PanelTitle><BodyText>Mensalidades, pagamentos e bolsas da instituição.</BodyText><ActionButton title="Abrir financeiro" onPress={() => router.push('/financeiro')} /></Panel>
    <Panel><PanelTitle>Cadastro acadêmico</PanelTitle>
      <BodyText>Crie uma conta de aluno ou localize uma existente e vincule-a a uma turma da instituição.</BodyText>
      <ActionButton title="Criar conta de aluno" onPress={openStudent} />
      <FormField label="Buscar aluno por nome ou e-mail" value={studentSearch} onChangeText={setStudentSearch} />
      <ActionButton title="Buscar aluno" secondary disabled={busy} onPress={() => void searchStudents()} />
      <View style={academicStyles.chips}>{students.slice(0, 20).map((item) => <Chip key={item.id} label={item.nome} selected={chosenStudent?.id === item.id} onPress={() => setChosenStudent(item)} />)}</View>
      {chosenStudent && <ActionButton title={`Matricular ${chosenStudent.nome}`} disabled={!classes.length} onPress={openEnrollment} />}
      {!classes.length && <BodyText>Nenhuma turma disponível para matrícula.</BodyText>}
    </Panel>
    {editor && editorScope === 'cadastro' && <Editor config={editor} close={() => setEditor(null)} />}
    <Panel><PanelTitle>Importar fontes oficiais</PanelTitle>
      <BodyText>Envie até 100 registros por planilha. O resumo semestral atualiza os atributos acadêmicos; o indicador macroeconômico atualiza as coortes vinculadas. Guarde a referência da fonte em cada linha.</BodyText>
      <ActionButton title="Baixar modelo de resumos semestrais" secondary disabled={busy} onPress={() => void downloadSourceTemplate('semestres')} />
      <ActionButton title="Importar resumos semestrais" disabled={busy} onPress={() => void importSource('semestres')} />
      {admin && <>
        <ActionButton title="Baixar modelo macroeconômico" secondary disabled={busy} onPress={() => void downloadSourceTemplate('macro')} />
        <ActionButton title="Importar indicadores macroeconômicos" disabled={busy} onPress={() => void importSource('macro')} />
      </>}
      {sourceReport && <>
        <Feedback message={`${sourceReport.salvos} registros salvos, ${sourceReport.repetidos} repetidos e ${sourceReport.erros.length} erros de ${sourceReport.total} linhas.`} />
        {sourceReport.erros.map((item) => <Feedback key={`${item.linha}-${item.registro}`} error message={`Linha ${item.linha} (${item.registro}): ${item.motivo}`} />)}
      </>}
    </Panel>
    <Panel><PanelTitle>Secretaria · ingresso</PanelTitle>
      <BodyText>Confira a declaração do aluno com a documentação institucional e registre os códigos equivalentes ao modelo português. Dados declarados não substituem a fonte oficial.</BodyText>
      <ActionButton title="Atualizar fila" secondary onPress={() => setRevision((value) => value + 1)} />
      <BodyText>{pending.length ? `${pending.length} declaração(ões) aguardando conferência.` : 'Nenhuma declaração pendente.'}</BodyText>
      {pending.map((item) => <Chip key={item.matriculaId} label={`${item.matricula.aluno.nome} · ${item.matricula.registro}`} selected={selected?.id === item.matriculaId} onPress={() => { setError(''); setNotice(''); setIngress(null); setSelected({ id: item.matriculaId, ...item.matricula }); }} />)}
    </Panel>
    <Panel><PanelTitle>Localizar matrícula</PanelTitle>
      <FormField label="Registro do aluno" value={query} onChangeText={setQuery} placeholder="Digite ao menos 2 caracteres" />
      <ActionButton title="Buscar registro" disabled={busy} onPress={() => void search()} />
      <View style={academicStyles.chips}>{matches.map((item) => <Chip key={item.id} label={`${item.aluno.nome} · ${item.registro}`} selected={selected?.id === item.id} onPress={() => { setError(''); setNotice(''); setIngress(null); setSelected(item); }} />)}</View>
      {matches.length === 20 && <BodyText>Mostrando os 20 primeiros registros. Refine a busca.</BodyText>}
    </Panel>
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {selected && <Panel><PanelTitle>{selected.aluno.nome} · {selected.registro}</PanelTitle>
      <BodyText>Fontes acadêmicas oficiais: atualize somente após conferir os documentos e a escala do dataset português.</BodyText>
      <ActionButton title="Homologar 1º semestre" secondary disabled={busy} onPress={() => void openSemester(1)} />
      <ActionButton title="Homologar 2º semestre" secondary disabled={busy} onPress={() => void openSemester(2)} />
      <ActionButton title="Vincular país e ano da coorte" secondary disabled={busy} onPress={() => void openCohort()} />
      {admin && <ActionButton title="Publicar indicadores macroeconômicos" secondary disabled={busy} onPress={() => void openMacroSource()} />}
      {editor && editorScope === 'fonte' && <Editor config={editor} close={() => setEditor(null)} />}
      {!ingress && !error && <BodyText>Carregando dados de ingresso…</BodyText>}
      {ingress && <>
        <BodyText>{ingress.declaration?.pendente ? 'Declaração do aluno aguardando conferência:' : 'Nenhuma declaração pendente nesta matrícula.'}</BodyText>
        {ingress.declaration?.pendente && Object.entries(ingress.declaration.dados).map(([key, value]) => <BodyText key={key}>{key}: {typeof value === 'boolean' ? value ? 'Sim' : 'Não' : value}</BodyText>)}
        <FormField label="Documento ou referência da fonte oficial" value={reference} onChangeText={setReference} placeholder="Ex.: ficha de ingresso, processo 2026/123" />
        {INGRESS.map((key) => <View key={key} style={academicStyles.stack}>
          <FormField label={ML_FIELD_LABELS[key] ?? key} value={fields[key] ?? ''} onChangeText={(value) => setFields((current) => ({ ...current, [key]: value }))} keyboardType="decimal-pad" />
          {schema?.categories[key] && <BodyText>Códigos aceitos: {schema.categories[key].join(', ')}</BodyText>}
        </View>)}
        <ActionButton title={busy ? 'Salvando…' : 'Homologar dados oficiais'} disabled={busy || !schema} onPress={() => void save()} />
      </>}
    </Panel>}
  </Screen>;
}
