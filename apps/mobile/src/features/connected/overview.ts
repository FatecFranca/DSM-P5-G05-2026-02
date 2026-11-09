import { useEffect, useState } from 'react';
import { useSession } from '@/auth/session';
import type { AcademicSnapshot } from '@/services/academic';
import type { UserSummary } from '@/services/api';

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

/**
 * Panorama acadêmico da instituição da sessão. Não há escolha de Fatec: a API atende apenas a da conta
 * (outra Fatec responde "não encontrada"), e o login já é feito por Fatec.
 */
export function useAcademicOverview() {
  const { state, request } = useSession();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (state.status !== 'signedIn' || state.mode !== 'api') return;
    let active = true;
    void (async () => {
      try {
        const [first, users] = await Promise.all([
          request<AcademicSnapshot>('/academico/resumo'),
          request<UserSummary[]>('/usuarios'),
        ]);
        const snapshots = await Promise.all(first.turmas.map((item) => first.turmaId === item.id
          ? Promise.resolve(first)
          : request<AcademicSnapshot>(`/academico/resumo?turmaId=${encodeURIComponent(item.id)}`)));
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
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reload, request, state]);

  return {
    data, loading, error,
    refresh: () => { setLoading(true); setError(''); setReload((value) => value + 1); },
  };
}
