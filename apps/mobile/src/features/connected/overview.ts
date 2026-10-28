import { useEffect, useState } from 'react';
import { useSession } from '@/auth/session';
import type { AcademicSnapshot } from '@/services/academic';
import type { InstituicaoOption, UserSummary } from '@/services/api';
import { api } from '@/services/api-config';

import type { EnrollmentView } from './summary';
export { summarizeEnrollments } from './summary';
export type { EnrollmentView } from './summary';

export interface ClassView {
  id: string;
  name: string;
  course: string;
  period: string;
  closed: boolean;
  snapshot: AcademicSnapshot;
}

export interface OverviewData {
  classes: ClassView[];
  enrollments: EnrollmentView[];
  users: UserSummary[];
}

export function useAcademicOverview() {
  const { state, request } = useSession();
  const admin = state.status === 'signedIn' && state.user.perfil === 'ADMIN';
  const [institutions, setInstitutions] = useState<InstituicaoOption[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (state.status !== 'signedIn' || state.mode !== 'api') return;
    let active = true;
    let awaitingInstitution = false;
    void (async () => {
      try {
        if (admin && !institutionId) {
          const options = await api.listInstituicoes();
          if (!active) return;
          setInstitutions(options);
          const initial = options.find((item) => item.codigoCps === '109') ?? options[0];
          if (initial) { awaitingInstitution = true; setInstitutionId(initial.id); return; }
        }
        const query = institutionId ? `?instituicaoId=${encodeURIComponent(institutionId)}` : '';
        const [first, users] = await Promise.all([
          request<AcademicSnapshot>(`/academico/resumo${query}`),
          request<UserSummary[]>('/usuarios'),
        ]);
        const snapshots = await Promise.all(first.turmas.map((item) => {
          const params = new URLSearchParams({ turmaId: item.id });
          if (institutionId) params.set('instituicaoId', institutionId);
          return first.turmaId === item.id ? Promise.resolve(first) : request<AcademicSnapshot>(`/academico/resumo?${params}`);
        }));
        if (!active) return;
        if (snapshots.some((item) => item.truncated)) throw new Error('A consulta acadêmica está incompleta. Os indicadores foram suspensos.');
        const classes = first.turmas.map((item, index) => ({
          id: item.id, name: item.nome, course: item.curso, period: item.periodo,
          closed: item.fechada, snapshot: snapshots[index],
        }));
        const enrollments = classes.flatMap((item) => item.snapshot.matriculas.map((enrollment) => {
          const indicator = item.snapshot.indicadores.find((value) => value.matriculaId === enrollment.id);
          return {
            id: enrollment.id, userId: enrollment.alunoId, name: enrollment.aluno.nome,
            registration: enrollment.registro, classId: item.id, className: item.name,
            course: item.course, average: indicator?.media ?? null, attendance: indicator?.frequencia ?? null,
          };
        }));
        setData({ classes, enrollments, users });
      } catch (cause) {
        if (active) { setData(null); setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o panorama acadêmico.'); }
      } finally { if (active && !awaitingInstitution) setLoading(false); }
    })();
    return () => { active = false; };
  }, [admin, institutionId, reload, request, state]);

  return {
    data, institutions, institutionId,
    selectInstitution: (id: string) => { setData(null); setLoading(true); setError(''); setInstitutionId(id); },
    loading, error, refresh: () => { setLoading(true); setError(''); setReload((value) => value + 1); },
  };
}
