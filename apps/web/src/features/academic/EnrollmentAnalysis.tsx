import { useEffect, useState } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Panel, StateMessage } from '../../components/UI';
import type { AcademicSnapshot } from '../../services/contracts';

interface EnrollmentMl {
  matriculaId: string; aluno: string; registro: string; fonte: string; faltantes: string[]; versao: number;
  status?: 'CALCULADO' | 'INSUFICIENTE'; impedimentos?: string[];
  resultado: { modelVersion: string; predictedClass: 'Dropout' | 'Enrolled' | 'Graduate'; probabilities: { Dropout: number; Graduate: number; Enrolled?: number }; calculadoEm: string; perfilVersao: number } | null;
}
const classNames = { Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Conclusão' };

export function EnrollmentAnalysis({ enrollments }: { enrollments: AcademicSnapshot['matriculas'] }) {
  const { request, session } = useSession();
  const [id, setId] = useState(enrollments[0]?.id ?? '');
  const [profile, setProfile] = useState<EnrollmentMl | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const authorized = session && ['COORDENACAO', 'PROFESSOR', 'TUTOR'].includes(session.user.perfil);

  useEffect(() => {
    if (!id || !authorized) return;
    let active = true; setLoading(true); setError(''); setProfile(null);
    void request<EnrollmentMl>(`/ml/matriculas/${encodeURIComponent(id)}`).then((value) => { if (active) setProfile(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados da matrícula.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authorized, id, request, revision]);

  if (!authorized) return null;
  async function analyze() {
    setBusy(true); setError('');
    try { setProfile(await request<EnrollmentMl>(`/ml/matriculas/${encodeURIComponent(id)}/analisar`, { method: 'POST' })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível calcular a previsão.'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="model-notice">Previsões são estimativas para apoio humano. Fatores associados não indicam causa. Estudantes não têm acesso a esta área.</div>
    <Panel title="Análise por matrícula"><div className="panel-body"><label className="analysis-picker">Estudante<select value={id} onChange={(event) => setId(event.target.value)}>{enrollments.map((item) => <option key={item.id} value={item.id}>{item.aluno.nome} · {item.registro}</option>)}</select></label>{!enrollments.length && <Empty title="Nenhuma matrícula" detail="Cadastre estudantes na turma para analisar." />}</div></Panel>
    <StateMessage loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {profile && <Panel title={`${profile.aluno} · ${profile.registro}`}><div className="panel-body"><p>{profile.faltantes.length ? `${profile.faltantes.length} informações ainda não preenchidas.` : 'As informações necessárias estão preenchidas.'}</p>{profile.impedimentos?.length ? <ul>{profile.impedimentos.map((item) => <li key={item}>{item}</li>)}</ul> : null}<button type="button" className="primary-button" disabled={busy} onClick={() => void analyze()}>{busy ? 'Calculando…' : 'Calcular previsão com dados da matrícula'}</button>{profile.resultado && <div className="analysis-result"><h3>Resultado do modelo</h3><p>Classe prevista: {classNames[profile.resultado.predictedClass]}</p><p>Probabilidade de evasão: {(profile.resultado.probabilities.Dropout * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p><small>Modelo {profile.resultado.modelVersion} · perfil v{profile.resultado.perfilVersao} · {new Date(profile.resultado.calculadoEm).toLocaleString('pt-BR')}</small></div>}</div></Panel>}
  </>;
}
