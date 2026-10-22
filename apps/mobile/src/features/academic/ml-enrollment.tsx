import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';
import { canEditMl, ML_FIELD_LABELS, parsePartialMlFields, type EnrollmentMl, type MlSchema } from '@/services/ml';

const labels = { Dropout: 'Evasão', Enrolled: 'Permanência na matrícula', Graduate: 'Conclusão' };

export function MlEnrollments({ matriculas }: { matriculas: { id: string; label: string }[] }) {
  const [selected, setSelected] = useState('');
  const id = matriculas.some((m) => m.id === selected) ? selected : matriculas[0]?.id;
  return <View style={academicStyles.stack}>
    <Panel><PanelTitle>Previsão de evasão por aluno</PanelTitle>
      <BodyText>Selecione uma matrícula para consultar os dados salvos e executar a análise.</BodyText>
      <View style={academicStyles.chips}>{matriculas.map((m) => <Chip key={m.id} label={m.label} selected={m.id === id} onPress={() => setSelected(m.id)} />)}</View>
      {!id && <BodyText>Nenhum aluno matriculado nesta turma.</BodyText>}
    </Panel>
    {id && <EnrollmentAnalysis key={id} id={id} />}
  </View>;
}

function EnrollmentAnalysis({ id }: { id: string }) {
  const { state, request } = useSession();
  const editable = canEditMl(state.status === 'signedIn' ? state.user.perfil : null);
  const [profile, setProfile] = useState<EnrollmentMl | null>(null);
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const path = `/ml/matriculas/${encodeURIComponent(id)}`;
  function receive(next: EnrollmentMl) {
    setProfile(next);
    setFields(Object.fromEntries(Object.entries(next.features ?? {}).map(([name, value]) => [name, String(value)])));
    setDirty(false);
  }
  useEffect(() => {
    const current = ++epoch.current;
    void Promise.resolve().then(async () => {
      if (epoch.current !== current) return;
      setBusy(true); setError(''); setProfile(null);
      try {
        const [next, contract] = await Promise.all([
          request<EnrollmentMl>(path),
          editable ? request<MlSchema>('/ml/schema') : Promise.resolve(null),
        ]);
        if (epoch.current === current) { receive(next); setSchema(contract); }
      } catch (cause) { if (epoch.current === current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a matrícula.'); }
      finally { if (epoch.current === current) setBusy(false); }
    });
    return () => { epoch.current = current + 1; };
  }, [path, request, editable, revision]);

  async function execute(save: boolean) {
    if (!profile || busy || (save && (!editable || !schema)) || (!save && dirty)) return;
    const current = epoch.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const next = save
        ? await request<EnrollmentMl>(path, { method: 'PUT', body: { versao: profile.versao, features: parsePartialMlFields(fields, schema!) } })
        : await request<EnrollmentMl>(`${path}/analisar`, { method: 'POST' });
      if (epoch.current === current) {
        receive(next);
        setNotice(save ? 'Cadastro salvo. Calcule a previsão com os dados atualizados.' : next.status === 'CALCULADO' ? 'Previsão calculada e salva nesta matrícula.' : 'Complete os atributos listados para calcular a previsão.');
        if (save) setEditing(false);
      }
    } catch (cause) { if (epoch.current === current) setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a análise.'); }
    finally { if (epoch.current === current) setBusy(false); }
  }

  return <View style={academicStyles.stack}>
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    <ActionButton title={busy ? 'Aguarde…' : 'Recarregar cadastro'} disabled={busy} secondary onPress={() => { setNotice(''); setRevision((v) => v + 1); }} />
    {profile && <>
      <Panel><PanelTitle>{profile.aluno} · {profile.registro}</PanelTitle>
        <BodyText>Origem: {profile.fonte}</BodyText>
        <BodyText>{profile.faltantes.length ? `${profile.faltantes.length} atributos precisam ser cadastrados.` : 'Cadastro completo para análise dos dois primeiros semestres.'}</BodyText>
        {!!profile.faltantes.length && <BodyText>{profile.faltantes.map((name) => ML_FIELD_LABELS[name] ?? name).join(' · ')}</BodyText>}
        {!!profile.faltantes.length && !editable && <BodyText>Solicite à administração ou coordenação o preenchimento do cadastro.</BodyText>}
        {editable && <ActionButton title={editing ? 'Fechar formulário' : 'Cadastrar / editar dados do aluno'} disabled={busy} secondary onPress={() => setEditing((v) => !v)} />}
        {dirty && <BodyText>Salve ou recarregue o cadastro antes de calcular.</BodyText>}
        <ActionButton title={busy ? 'Aguarde…' : 'Calcular previsão'} disabled={busy || dirty || profile.faltantes.length > 0} onPress={() => void execute(false)} />
      </Panel>
      {editing && editable && schema && <Panel><PanelTitle>Dados desta matrícula</PanelTitle>
        <BodyText>Deixe em branco o que ainda não foi cadastrado. Use os agregados dos dois semestres concluídos; a normalização é feita pelo servidor.</BodyText>
        {schema.features.map((name) => <View key={name}>
          <FormField label={ML_FIELD_LABELS[name] ?? name} value={fields[name] ?? ''} placeholder="Não cadastrado" onChangeText={(text) => { if (!busy) { setFields((v) => ({ ...v, [name]: text })); setDirty(true); setNotice(''); } }} />
          {schema.categories[name] && <BodyText>Códigos aceitos: {schema.categories[name].join(', ')}</BodyText>}
        </View>)}
        <ActionButton title="Salvar cadastro" disabled={busy} onPress={() => void execute(true)} />
      </Panel>}
      {profile.resultado && !dirty && <Panel><PanelTitle>Probabilidade estimada de evasão: {(profile.resultado.probabilities.Dropout * 100).toFixed(1)}%</PanelTitle>
        <BodyText>Classe estimada: {labels[profile.resultado.predictedClass]}</BodyText>
        {(['Dropout', 'Enrolled', 'Graduate'] as const).map((key) => <BodyText key={key}>{labels[key]}: {(profile.resultado!.probabilities[key] * 100).toFixed(1)}%</BodyText>)}
        <BodyText>Modelo: {profile.resultado.modelVersion} · Cadastro v{profile.resultado.perfilVersao}</BodyText>
        <BodyText>Calculado em {new Date(profile.resultado.calculadoEm).toLocaleString('pt-BR')}</BodyText>
        <BodyText>Estimativa do modelo, não uma certeza ou decisão automática. “Matriculado” não significa reprovação.</BodyText>
      </Panel>}
    </>}
  </View>;
}
