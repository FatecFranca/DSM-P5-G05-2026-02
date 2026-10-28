import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, ActionButton, BodyText, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import type { AcademicSnapshot } from '@/services/academic';

type Turno = 'DIURNO' | 'NOTURNO';
interface SelfReport {
  matriculaId: string;
  idadeNoIngresso: number | null;
  turno: Turno | null;
  informacao: string;
}

export default function SelfReportScreen() {
  const { state, request } = useSession();
  const [matriculas, setMatriculas] = useState<AcademicSnapshot['matriculas']>([]);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<SelfReport | null>(null);
  const [age, setAge] = useState('');
  const [turno, setTurno] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (state.status !== 'signedIn' || state.mode !== 'api' || state.user.perfil !== 'ALUNO') return;
    let active = true;
    void request<AcademicSnapshot>('/academico/resumo')
      .then(async (first) => {
        const snapshots = await Promise.all(first.turmas.map((item) => item.id === first.turmaId ? Promise.resolve(first) : request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(item.id)}`)));
        if (!active) return;
        if (snapshots.some((item) => item.truncated)) throw new Error('A lista de matrículas está incompleta.');
        const items = snapshots.flatMap((item) => item.matriculas);
        setMatriculas(items);
        setSelected(items[0]?.id ?? '');
        if (!items.length) setLoading(false);
      })
      .catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar suas matrículas.'); setLoading(false); } });
    return () => { active = false; };
  }, [request, state]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void request<SelfReport>(`/ml/matriculas/${encodeURIComponent(selected)}/autodeclaracao`)
      .then((value) => { if (active) { setReport(value); setAge(value.idadeNoIngresso === null ? '' : String(value.idadeNoIngresso)); setTurno(value.turno); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o formulário.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, selected]);

  if (state.status === 'loading') return null;
  if (state.status !== 'signedIn' || state.mode !== 'api' || state.user.perfil !== 'ALUNO') return <Redirect href="/home" />;

  async function save() {
    const value = Number(age);
    if (!Number.isInteger(value) || value < 14 || value > 100 || !turno) {
      setError('Informe a idade ao iniciar o curso e selecione o turno das aulas.');
      return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const next = await request<SelfReport>(`/ml/matriculas/${encodeURIComponent(selected)}/autodeclaracao`, {
        method: 'PUT', body: { idadeNoIngresso: value, turno },
      });
      setReport(next);
      setNotice('Suas respostas foram salvas nesta matrícula.');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    } finally { setSaving(false); }
  }

  return <Screen>
    <AcademicHeader title="Minha situação" subtitle="Informações sobre seu ingresso e seus estudos" />
    {loading && <ActivityIndicator />}
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {!loading && !matriculas.length && !error && <Panel><PanelTitle>Nenhuma matrícula disponível</PanelTitle><BodyText>Peça à administração para vincular sua conta a uma turma.</BodyText></Panel>}
    {!!matriculas.length && <View style={academicStyles.chips}>{matriculas.map((item) => <Chip key={item.id} label={item.registro} selected={selected === item.id} onPress={() => { setLoading(true); setSelected(item.id); setReport(null); setError(''); }} />)}</View>}
    {report && <Panel>
      <PanelTitle>Conte sobre seu ingresso</PanelTitle>
      <BodyText>Informe apenas o que você sabe. Sua idade ao iniciar este curso e o turno das aulas ainda não constam no cadastro acadêmico.</BodyText>
      <FormField label="Com quantos anos você iniciou este curso?" value={age} onChangeText={setAge} keyboardType="numeric" placeholder="Sua idade na época" />
      <BodyText>Em qual turno você estuda?</BodyText>
      <View style={academicStyles.chips}>
        <Chip label="Durante o dia" selected={turno === 'DIURNO'} onPress={() => setTurno('DIURNO')} />
        <Chip label="À noite" selected={turno === 'NOTURNO'} onPress={() => setTurno('NOTURNO')} />
      </View>
      <ActionButton title={saving ? 'Salvando…' : 'Salvar respostas'} disabled={saving} onPress={() => void save()} />
      <BodyText>{report.informacao}</BodyText>
    </Panel>}
  </Screen>;
}
