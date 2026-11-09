import { useEffect, useState } from 'react';
import { useSession } from '../../auth/Session';
import { academicApi } from '../../services/api';
import { buildOverview, type Overview } from './overview-model';

export function useOverview(enabled = true) {
  const { request, session } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!session || !enabled) return;
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const first = await academicApi.snapshot(request);
        const snapshots = await Promise.all(first.turmas.map((turma) => first.turmaId === turma.id ? first : academicApi.snapshot(request, turma.id)));
        if (active) setData(buildOverview(first, snapshots));
      } catch (cause) {
        if (active) { setData(null); setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados.'); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [enabled, request, revision, session?.user.id]);

  return { data, error, loading, refresh: () => setRevision((value) => value + 1) };
}
