import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import type { EnrollmentMl } from '@/services/ml';

export function MlEnrollments({ matriculas }: { matriculas: { id: string; label: string }[] }) {
  const [selected, setSelected] = useState('');
  const id = matriculas.some((item) => item.id === selected) ? selected : matriculas[0]?.id;
  return <View style={academicStyles.stack}>
    <Panel><PanelTitle>Análise acadêmica</PanelTitle>
      <BodyText>Os resultados só serão exibidos depois da validação do modelo para alunos das Fatecs. A avaliação usa dados registrados e nunca preenche valores ausentes por suposição.</BodyText>
      <View style={academicStyles.chips}>{matriculas.map((item) => <Chip key={item.id} label={item.label} selected={item.id === id} onPress={() => setSelected(item.id)} />)}</View>
      {!id && <BodyText>Nenhum aluno matriculado nesta turma.</BodyText>}
    </Panel>
    {id && <EnrollmentReadiness key={id} id={id} />}
  </View>;
}

function EnrollmentReadiness({ id }: { id: string }) {
  const { request } = useSession();
  const [profile, setProfile] = useState<EnrollmentMl | null>(null);
  const [impedimentos, setImpedimentos] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const path = `/ml/matriculas/${encodeURIComponent(id)}`;

  useEffect(() => {
    let active = true;
    void request<EnrollmentMl>(path)
      .then((value) => { if (active) setProfile(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a matrícula.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [path, request, revision]);

  async function check() {
    setBusy(true); setError(''); setImpedimentos([]);
    try {
      const result = await request<EnrollmentMl>(`${path}/analisar`, { method: 'POST' });
      setProfile(result);
      setImpedimentos(result.impedimentos ?? []);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar a análise.');
    } finally { setBusy(false); }
  }

  return <Panel>
    <PanelTitle>{profile ? `${profile.aluno} · ${profile.registro}` : 'Matrícula'}</PanelTitle>
    {busy && <BodyText>Carregando dados…</BodyText>}
    {!!error && <Feedback error message={error} />}
    {profile && <>
      <BodyText>{profile.faltantes.length ? 'Ainda há informações de ingresso e histórico semestral não registradas ou sem equivalência validada.' : 'Dados cadastrados; validação institucional do modelo ainda necessária.'}</BodyText>
      {impedimentos.map((item) => <Feedback key={item} message={item} error />)}
      <ActionButton title="Verificar disponibilidade da análise" disabled={busy} onPress={() => void check()} />
    </>}
    <ActionButton title="Atualizar dados" secondary disabled={busy} onPress={() => { setBusy(true); setError(''); setRevision((value) => value + 1); }} />
  </Panel>;
}
